<template>
  <div class="competition-admin md-scroll-frame">
    <requires-permission :permission="hasPermission" class="md-scroll-frame">
      <div v-if="currentSection" class="md-scroll-frame">
        <div class="md-scroll-frame">
          <md-toolbar class="md-dense">
            <div v-if="inTabs('info', 'categories', 'dancers', 'groups')">
              <md-button @click="showImport = true">Import</md-button>
            </div>
            <div v-if="inTabs('results')">
              <md-button @click="showImportResults = true">Import</md-button>
            </div>

            <div v-if="currentSection">
              <preset-picker
                v-if="currentSection.presets"
                :presets="currentSection.presets"
                :prop="currentSection[idKey] === 'dances' ? p => danceExtender(p).$name : 'name'"
                @select="addPresets"
              />
            </div>

            <span style="flex-grow: 1;"></span>

            <md-spunnable :md-spinning="saving" />
          </md-toolbar>
          <div class="md-scroll-frame md-scroll">
            <mi-hot-table
              v-if="currentSection.hot"
              :settings="currentSection.hot"
              :data="this[$root.currentTab]"
              class="fullscreen"
              @change="handleHotChanges"
            />
            <keep-alive v-else>
              <router-view
                v-bind="$props"
                :section="currentSection"
                @change="handleDataChanges"
                @info-change="handleInfoChanges"
              />
            </keep-alive>
          </div>
        </div>
      </div>

      <md-dialog :md-active.sync="showImport" class="import-dialog">
        <admin-import
          :competition-data-ref="competitionDataRef"
          :groups="groups"
          :categories="categories"
          :dancers="dancers"
          @done="showImport = false"
        />
      </md-dialog>
      <md-dialog :md-active.sync="showImportResults" class="import-results-dialog">
        <admin-import-results
          :competition-data-ref="competitionDataRef"
          :groups="groups"
          :dances="dances"
          :dancers="dancers"
          @done="showImportResults = false"
        />
      </md-dialog>
    </requires-permission>

    <md-bottom-bar
      ref="bottomBar"
      v-show="hasPermission"
      class="md-accent"
    >
      <md-bottom-bar-item
        v-for="section of sections"
        :key="section[idKey]"
        :id="`tab-competition-admin-${section[idKey]}`"
        @click="goToTab(section[idKey])"
      >
        <md-icon :class="section.icon"></md-icon>
        <span class="md-bottom-bar-label">{{ section.name }}</span>
      </md-bottom-bar-item>
    </md-bottom-bar>
  </div>
</template>

<script>
import { makeKeyValuePairColumn } from '@/helpers/admin';
import { danceExtender } from '@/helpers/competition';
import {
  idKey,
  db,
} from '@/helpers/firebase';
import { getFirstExisting } from '@/helpers/router';
import RequiresPermission from '@/components/utility/RequiresPermission.vue';
import MiHotTable from '@/components/admin/utility/MiHotTable.vue';
import PresetPicker from '@/components/competition/admin/utility/PresetPicker.vue';
import MdSpunnable from '@/components/utility/MdSpunnable.vue';

export default {
  name: 'competition-admin',
  props: {
    competitionId: String,
    competitionRef: {
      type: Object,
      required: true,
    },
    competitionDataRef: {
      type: Object,
      required: true,
    },
    competition: Object,
    dancers: Array,
    groups: Array,
    categories: Array,
    dances: Array,
    staff: Array,
    platforms: Array,
    draws: Object,
    schedule: Object,
    results: Object,
  },
  data() {
    return {
      idKey,

      showImport: false,
      showImportResults: false,

      saving: false,
      savingPromises: [],
    };
  },
  firebase() {
    return {
      sectionsRaw: db.child('sections'),
    };
  },
  computed: {
    hasPermission() {
      return this.$store.getters.hasPermission(`competitions/${this.competitionId}`);
    },

    currentSection() {
      return this.getSection(this.$root.currentTab);
    },

    sections() {
      return this.sectionsRaw
        .map((section) => {
          if (section.hot) {
            // eslint-disable-next-line no-param-reassign
            section.hot = {
              ...section.hot,

              columns: section.hot.columns && section.hot.columns.map((column) => {
                if (column.data === 'categoryId') {
                  // eslint-disable-next-line no-param-reassign
                  column.source = this.categories;
                  return makeKeyValuePairColumn(column, 'name');
                }
                if (column.data === 'groupId') {
                  // eslint-disable-next-line no-param-reassign
                  column.source = this.groups;
                  return makeKeyValuePairColumn(column);
                }
                return column;
              }),
            };
          }
          return section;
        });
    },
  },
  watch: {
    '$root.currentTab'() { // eslint-disable-line object-shorthand
      this.syncBottomBar();
    },
  },
  methods: {
    danceExtender,

    async syncBottomBar() {
      await this.$nextTick(); // await md-bottom-bar's internally queued $nextTick
      const adminTabId = `tab-competition-admin-${this.$root.currentTab}`;
      this.$refs.bottomBar.MdBottomBar.activeItem = adminTabId;
    },

    goToTab(tab) {
      const params = {
        competitionId: this.$route.params.competitionId,
      };
      this.$router.push(getFirstExisting({
        name: `competition.admin.${tab}`,
        params,
      }, {
        name: 'competition.admin.tab',
        params: {
          ...params,
          tab,
        },
      }));
    },
    inTabs(...tabs) {
      return tabs.some(tab => this.$root.currentTab === tab);
    },
    getSection(sectionId) {
      return this.sections.find(section => section[idKey] === sectionId);
    },

    awaitSave(...promises) {
      return new Promise((resolve, reject) => {
        this.savingPromises.push(...promises);

        if (this.saving) {
          clearTimeout(this.saving);
        }
        this.saving = setTimeout(() => {
          Promise.all(this.savingPromises)
            .then(() => {
              this.saving = false;
              resolve();
            })
            .catch((err) => {
              this.saving = false;
              reject(err);
            });
        }, 1000);
      });
    },
    handleInfoChanges(changes) {
      this.awaitSave(this.competitionRef.update(changes));
    },
    handleDataChanges(changes) {
      this.awaitSave(this.competitionDataRef.update(changes));
    },
    handleHotChanges(changes) {
      Object.entries(changes).forEach(([path, change]) => {
        this.handleDataChanges({
          [`${this.$root.currentTab}/${path}`]: change,
        });
      });
    },
    addPresets(presets, tab = this.$root.currentTab) {
      presets.forEach((preset) => {
        this.handleDataChanges({
          [`${tab}/${db.push().key}`]: preset,
        });
      });
    },
  },
  mounted() {
    this.syncBottomBar();
  },
  components: {
    RequiresPermission,
    MiHotTable,
    AdminImport: () => import(/* webpackChunkName: "admin-import" */ '@/components/competition/admin/utility/Import.vue'),
    AdminImportResults: () => import(/* webpackChunkName: "admin-import" */ '@/components/competition/admin/utility/ImportResults.vue'),
    PresetPicker,
    MdSpunnable,
  },
};
</script>

<style lang="scss">
.competition-admin {
  .md-table-cell {
    vertical-align: top;
  }
  .handsontable {
    z-index: 90; // keep below sidebar, backdrop, modals

    &.fullscreen {
      height: 100%;
      min-height: 300px;
    }
  }
}

.import-dialog,
.import-results-dialog {
  &,
  .md-dialog-container {
    width: 100%;
    height: 100%;
  }
}
</style>
