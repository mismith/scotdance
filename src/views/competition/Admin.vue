<template>
  <RequiresPermission :permission="hasPermission" class="CompetitionAdmin app-scroll-frame">
    <v-toolbar dense>
      <div v-if="inTabs('categories', 'dancers', 'groups')">
        <v-btn flat @click="showImport = true" class="hidden-xs-only">Import&hellip;</v-btn>
      </div>
      <div v-if="inTabs('results')">
        <!-- <v-btn flat @click="showImportResults = true" class="hidden-xs-only">Import&hellip;</v-btn> -->
        <v-btn flat @click="exportResults()">Export CSV</v-btn>
      </div>

      <div v-if="currentSection">
        <PresetPicker
          v-if="currentSection.presets"
          :presets="currentSection.presets"
          :prop="currentSection[idKey] === 'dances' ? p => danceExtender(p).$name : 'name'"
          @select="addPresets"
        />
      </div>

      <v-spacer />

      <v-tooltip left>
        <v-btn slot="activator" icon flat color="primary" :loading="saving">
          <v-icon>check</v-icon>
        </v-btn>
        <span>{{ saving ? 'Saving...' : 'Saved' }}</span>
      </v-tooltip>
    </v-toolbar>

    <div v-if="currentSection" class="app-scroll-frame app-scroll">
      <template v-if="currentSection.hot">
        <EmptyState
          v-if="inTabs('groups') && !this.categories.length"
          icon="warning"
          label="No categories found"
        >
          <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'categories' } }">
            <span class="subheading">Add or import some first &rsaquo;</span>
          </router-link>
        </EmptyState>
        <EmptyState
          v-else-if="inTabs('dancers') && !this.groups.length"
          icon="warning"
          label="No age groups found"
        >
          <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'groups' } }">
            <span class="subheading">Add or import some first &rsaquo;</span>
          </router-link>
        </EmptyState>
        <MiHotTable
          v-else
          :settings="currentSection.hot"
          :data="this[$root.currentTab]"
          @change="handleHotChanges"
        />
      </template>
      <router-view
        v-else
        v-bind="$props"
        :section="currentSection"
        @change="handleDataChanges"
        @info-change="handleInfoChanges"
      />
    </div>

    <v-dialog v-model="showImport" @keydown.esc.stop="showImport = false">
      <AdminImport
        :competition-data-ref="competitionDataRef"
        :groups="groups"
        :categories="categories"
        :dancers="dancers"
        @done="showImport = false"
      />
    </v-dialog>
    <!-- <v-dialog v-model="showImportResults" @keydown.esc.stop="showImportResults = false">
      <AdminImportResults
        :competition-data-ref="competitionDataRef"
        :groups="groups"
        :dances="dances"
        :dancers="dancers"
        @done="showImportResults = false"
      />
    </v-dialog> -->

    <v-bottom-nav
      v-if="hasPermission"
      :value="true"
      :active="$root.currentTab"
      class="listed-only"
      style="overflow-x: auto; -webkit-overflow-scrolling: touch; justify-content: unset;"
    >
      <v-btn
        v-for="section in sections"
        :key="section[idKey]"
        :value="section[idKey]"
        :to="getTabRoute(section[idKey])"
        color="primary"
        flat
        :class="section.className"
      >
        <span>{{ section.name }}</span>
        <v-icon :class="section.icon"></v-icon>
      </v-btn>
    </v-bottom-nav>
  </RequiresPermission>
</template>

<script>
import saveCSV from 'save-csv';
import { makeKeyValuePairColumn } from '@/helpers/admin';
import { danceExtender } from '@/helpers/competition';
import { idKey, db, toOrderedArray } from '@/helpers/firebase';
import { getFirstExisting } from '@/helpers/router';
import { getRows } from '@/helpers/results';
import competitionAdminSchema from '@/schemas/competition-admin';
import RequiresPermission from '@/components/RequiresPermission.vue';
import MiHotTable from '@/components/admin/MiHotTable.vue';
import PresetPicker from '@/components/admin/PresetPicker.vue';

const AdminImport = () => import(/* webpackChunkName: "AdminImport" */ '@/components/admin/Import.vue');
// const AdminImportResults = () => import(/* webpackChunkName: "AdminImport" */ '@/components/admin/ImportResults.vue');

export default {
  name: 'CompetitionAdmin',
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
      // showImportResults: false,

      saving: false,
      savingPromises: [],
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
      return toOrderedArray(competitionAdminSchema)
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
  methods: {
    danceExtender,

    getTabRoute(tab) {
      const params = {
        competitionId: this.$route.params.competitionId,
      };
      return getFirstExisting({
        name: `competition.admin.${tab}`,
        params,
      }, {
        name: 'competition.admin.tab',
        params: {
          ...params,
          tab,
        },
      });
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
    exportResults() {
      const exportedRows = getRows(this.groups, this.dances, this.dancers, this.results);
      saveCSV(exportedRows, { filename: `Results - ${this.competition.name}.csv` });
    },
  },
  components: {
    RequiresPermission,
    MiHotTable,
    AdminImport,
    // AdminImportResults,
    PresetPicker,
  },
};
</script>
