<template>
  <div class="competition-admin md-scroll-frame">
    <div v-if="currentSection" class="md-scroll-frame">
      <div v-if="hasPermission('competitions:data', $route.params.competitionId, currentSection[idKey])" class="md-scroll-frame">
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
            <form v-if="currentSection.form" class="md-padding">
              <div v-for="field in currentSection.form.fields" :key="field.data">
                <md-datepicker
                  v-if="field.type === 'datetime'"
                  v-model="competition[field.data]"
                  md-immediately
                  @input="handleFormInputChange(currentSection[idKey], field.data, $event)"
                  :class="{ 'md-required': field.required }"
                >
                  <label>{{ field.title }}</label>
                </md-datepicker>

                <md-checkbox
                  v-else-if="field.type === 'checkbox'"
                  v-model="competition[field.data]"
                  @change="handleFormInputChange(currentSection[idKey], field.data, $event)"
                  :required="field.required"
                >
                  {{ field.title }}
                </md-checkbox>

                <md-field v-else>
                  <label>{{ field.title }}</label>
                  <md-input
                    v-model="competition[field.data]"
                    @change="handleFormInputChange(currentSection[idKey], field.data, $event.target.value)"
                    :required="field.required"
                  />
                </md-field>
              </div>
            </form>

            <HotTable v-else-if="currentSection.hot" :settings="currentSection.hot" class="fullscreen" />

            <keep-alive v-else>
              <router-view v-bind="$props" @change="handleChanges" />
            </keep-alive>

            <footer v-if="inTabs('info')" class="md-layout md-alignment-center" style="margin-top: auto;">
              <md-button @click="confirmRemove = true" class="md-accent">
                Delete Competition
              </md-button>
            </footer>
          </div>
        </div>
      </div>
      <div v-else-if="!me">
        <md-empty-state md-icon="block" md-label="Login required" />
      </div>
      <div v-else-if="!me.admin">
        <md-empty-state md-icon="block" md-label="Access denied" />
      </div>

      <md-dialog :md-active.sync="showImport" class="import-dialog">
        <admin-import
          :competition-data-ref="competitionDataRef"
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
      <md-dialog-confirm
        :md-active.sync="confirmRemove"
        md-title="Delete competition"
        md-content="Are you sure you want to permanently delete this competition?"
        md-confirm-text="Yes"
        md-cancel-text="No"
        @md-confirm="remove"
      />
    </div>
    <div v-else class="md-scroll-frame spinner-container">
      <mi-md-spinner />
    </div>

    <md-bottom-bar ref="bottomBar"
        class="md-accent">
      <md-bottom-bar-item
        v-for="section of sections"
        :key="section[idKey]"
        @click="goToTab(section[idKey])"
        :id="`tab-admin-${section[idKey]}`"
      >
        <md-icon :class="section.icon"></md-icon>
        <span class="md-bottom-bar-label">{{ section.name }}</span>
      </md-bottom-bar-item>
    </md-bottom-bar>
  </div>
</template>

<script>
import {
  mapState,
  mapGetters,
} from 'vuex';
import {
  HotTable,
  makeKeyValuePairColumn,
} from '@/helpers/admin';
import {
  danceExtender,
} from '@/helpers/competition';
import {
  idKey,
  db,
} from '@/helpers/firebase';
import AdminImport from '@/components/competition/admin/utility/import';
import AdminImportResults from '@/components/competition/admin/utility/import-results';
import PresetPicker from '@/components/competition/admin/utility/preset-picker';
import AdminResults from '@/components/competition/admin/results';
import MdSpunnable from '@/components/utility/md-spunnable';

export default {
  name: 'competition-admin',
  props: {
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
      confirmRemove: false,

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
    ...mapState([
      'me',
    ]),

    currentTab() {
      return this.$route.params.tab || this.$route.name.split('.')[2] || 'info';
    },
    currentSection() {
      return this.getSection(this.currentTab);
    },

    sections() {
      return this.sectionsRaw
        .map((sectionData) => {
          const section = {
            ...sectionData,
          };
          const data = [].concat(this[section[idKey]]);

          if (section.hot) {
            section.hot = {
              colHeaders: true,
              rowHeaders: true,
              stretchH: 'all',
              minSpareRows: 1,
              contextMenu: [
                'remove_row',
              ],
              sortIndicator: true,
              columnSorting: true,
              manualColumnResize: true,

              ...section.hot,

              data,

              afterChange: (changes, source) => {
                if (source !== 'loadData') {
                  changes.forEach(([row, prop, oldVal, newVal]) => { // eslint-disable-line no-unused-vars
                    // add key if new entry
                    if (!data[row][idKey]) {
                      data[row][idKey] = db.push().key;
                    }

                    // queue up a save
                    const path = `${section[idKey]}/${data[row][idKey]}/${prop.replace('.', '/')}`;
                    this.save(path, newVal);
                  });
                }
              },
              beforeRemoveRow: (index, amount) => {
                for (let i = 0; i < amount; i += 1) {
                  const path = `${section[idKey]}/${data[index + i][idKey]}`;
                  this.save(path, null);
                }
              },
            };
            section.hot.columns = section.hot.columns.map((column) => {
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
            });
          }
          return section;
        });
    },
  },
  watch: {
    currentTab() {
      this.syncBottomBar();
    },
  },
  methods: {
    danceExtender,

    ...mapGetters([
      'hasPermission',
    ]),

    async syncBottomBar() {
      await this.$nextTick(); // await md-bottom-bar's internally queued $nextTick
      const adminTabId = `tab-admin-${this.currentTab}`;
      this.$refs.bottomBar.MdBottomBar.activeItem = adminTabId;
    },

    goToTab(tab) {
      switch (tab) {
        case 'schedule':
        case 'results':
        case 'dance-groups': {
          this.$router.push({
            name: `competition.admin.${tab}`,
          });
          break;
        }
        default: {
          this.$router.push({
            name: 'competition.admin.tab',
            params: {
              tab,
            },
          });
          break;
        }
      }
    },
    inTabs(...tabs) {
      return tabs.some(tab => (this.currentTab) === tab);
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
    async save(path, value) {
      const ref = /^info\//.test(path) ? this.competitionRef : this.competitionDataRef;
      await this.awaitSave(ref.update({
        [path.replace(/^info\//, '')]: value || null,
      }));
    },
    async remove() {
      await this.awaitSave(
        this.competitionRef.remove(),
        this.competitionDataRef.remove(),
      );
      this.$router.replace('/');
    },

    addPresets(presets, tab = this.currentTab) {
      // append
      return Promise.all(presets.map((preset) => {
        return this.save(`${tab}/${db.push().key}`, preset);
      }));
    },

    handleFormInputChange(section, field, value) {
      return this.save(`${section}/${field}`, value);
    },
    handleChanges(changes) {
      return Object.entries(changes).map(([path, value]) => {
        return this.save(path, value);
      });
    },
  },
  mounted() {
    this.syncBottomBar();
  },
  components: {
    HotTable,
    AdminImport,
    AdminImportResults,
    AdminResults,
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
