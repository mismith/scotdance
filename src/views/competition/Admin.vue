<template>
  <RequiresPermission :permission="hasPermission" class="CompetitionAdmin app-scroll-frame">
    <v-toolbar dense class="flex-none">
      <div class="d-flex justify-start ml-n2" style="flex-basis: 33%;">
        <PresetPicker
          v-if="hasPresets"
          ref="presetPicker"
          :presets="currentSection.presets"
          :prop="currentSection[idKey] === 'dances' ? p => danceExtender(p).$name : 'name'"
          @select="addPresets"
        >
          <template #activator="{ on }">
            <v-btn
              v-on="on"
              v-test="'admin:toolbar.addPreset'"
              text
            >
              <v-icon class="mr-2">{{ mdiPlaylistPlus }}</v-icon>
              Add
            </v-btn>
          </template>
        </PresetPicker>

        <v-btn
          v-if="hasImport"
          v-test="'admin:toolbar.import'"
          text
          @click="showImport = true"
        >
          <v-icon class="mr-2">{{ mdiImport }}</v-icon>
          Import
        </v-btn>
      </div>
      <div class="d-flex justify-center mx-2" style="flex-basis: 33%;">
        <SearchField
          v-test="'admin:toolbar.hot-search'"
          v-if="hasHotData"
          v-model="searchQuery"
          :debounce="0"
          style="min-width: 128px; max-width: 300px;"
        />
      </div>
      <div class="d-flex justify-end mr-n2" style="flex-basis: 33%;">
        <v-btn
          v-if="hasExport"
          v-test="'admin:toolbar.export'"
          text
          @click="inTabs('results') ? exportResults() : exportHotTable()"
        >
          <v-icon class="mr-2">{{ mdiExport }}</v-icon>
          Export
        </v-btn>

        <v-tooltip bottom :color="savingError ? 'error' : undefined">
          <template #activator="{ on }">
            <v-btn
              v-test="'admin:toolbar.saved'"
              v-on="on"
              icon
              :color="savingError ? 'error' : 'primary'"
              :loading="saving"
            >
              <v-icon>
                {{ savingError ? mdiAlert : mdiCheck }}
              </v-icon>
            </v-btn>
          </template>
          <div v-if="savingError">{{ savingError.message }}</div>
          <span v-else>{{ saving ? 'Saving...' : 'Saved' }}</span>
        </v-tooltip>
      </div>
    </v-toolbar>

    <div v-if="currentSection" class="app-scroll-frame app-scroll" style="position: relative;">
      <template v-if="currentSection.hot">
        <MiHotTable
          v-if="!hasMissingPrereqs"
          v-test="'admin:hot'"
          ref="hot"
          :key="currentSection[idKey]"
          :settings="currentSection.hot"
          :data="hotData"
          @change="handleHotChanges"
        />
        <div
          v-if="!hasHotData"
          class="d-flex align-center justify-center pt-12 pb-16"
          style="position: absolute; width: 100%; height: 100%; pointer-events: none;"
        >
          <EmptyState
            v-test="'admin:hot.empty-state'"
            :icon="mdiTableAlert"
            :label="`No ${(currentSection.name || 'data').toLowerCase()} yet`"
            style="pointer-events: auto;"
          >
            <p
              v-if="hasMissingPrereqs && inTabs('groups')"
              v-test="'admin:hot.empty-state.groups'"
            >
              You need to have
              <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'categories' } }">
                <strong>categories</strong>
              </router-link>
              before you can add <strong>age groups</strong><!--
              --><span v-if="hasPresets || hasImport">, or you can:</span>
            </p>
            <p
              v-else-if="hasMissingPrereqs && inTabs('dancers')"
              v-test="'admin:hot.empty-state.dancers'"
            >
              You need to have
              <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'groups' } }">
                <strong>age groups</strong>
              </router-link>
              before you can add <strong>dancers</strong><!--
              --><span v-if="hasPresets || hasImport">, or you can:</span>
            </p>
            <p
              v-else
              v-test="'admin:hot.empty-state.other'"
            >
              <strong>Type</strong> and/or <strong>copy-paste</strong> data into the rows above<!--
              --><span v-if="hasPresets || hasImport">, or you can:</span><!--
              --><span v-else> to get started</span>
            </p>
            <div>
              <v-btn
                v-if="hasPresets"
                v-test="'admin:hot.empty-state.presets'"
                v-on="on"
                color="primary"
                class="ma-1"
                @click="$refs.presetPicker.show()"
              >
                <v-icon class="mr-2">{{ mdiPlaylistPlus }}</v-icon>
                Add preset(s)
              </v-btn>
              <v-btn
                v-if="hasImport"
                v-test="'admin:hot.empty-state.import'"
                v-on="on"
                color="primary"
                class="ma-1"
                @click="showImport = true"
              >
                <v-icon class="mr-2">{{ mdiImport }}</v-icon>
                Import spreadsheet
              </v-btn>
            </div>
          </EmptyState>
        </div>
      </template>
      <router-view
        v-else
        :section="currentSection"
        @change="handleDataChanges"
        @info-change="handleInfoChanges"
      />
    </div>

    <v-dialog
      v-model="showImport"
      content-class="v-dialog--full-height"
      @keydown.esc.stop="showImport = false"
    >
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
        :group-id="groupId"
        :dance-id="danceId"
        :competition-data-ref="competitionDataRef"
        :groups="groups"
        :dances="dances"
        :dancers="dancers"
        :points="points"
        @done="showImportResults = false"
      />
    </v-dialog> -->

    <v-bottom-navigation
      v-if="hasPermission"
      :value="$root.currentTab"
      class="listed-only"
    >
      <v-btn
        v-for="section in sections"
        :key="section[idKey]"
        :value="section[idKey]"
        :to="getTabRoute(section[idKey])"
        color="primary"
        text
        :class="section.className"
      >
        <span>{{ section.name }}</span>
        <v-icon :class="section.icon"></v-icon>
      </v-btn>
    </v-bottom-navigation>
  </RequiresPermission>
</template>

<script>
import saveCSV from 'save-csv';
import {
  mdiAlert,
  mdiCheck,
  mdiImport,
  mdiExport,
  mdiPlaylistPlus,
  mdiTableAlert,
} from '@mdi/js';
import {
  makeKeyValuePairColumn,
  accumulateKeys,
} from '@/helpers/admin';
import {
  findByIdKey,
  danceExtender,
  searchByKeys,
} from '@/helpers/competition';
import {
  pushidRegex,
  idKey,
  db,
  toOrderedArray,
} from '@/helpers/firebase';
import {
  getFirstExisting,
  // mapRouteParams,
} from '@/helpers/router';
import {
  callbacks,
  overall,
  getRows,
} from '@/helpers/results';
import competitionAdminSchema from '@/schemas/competition-admin';
import RequiresPermission from '@/components/RequiresPermission.vue';
import MiHotTable from '@/components/admin/MiHotTable.vue';
import PresetPicker from '@/components/admin/PresetPicker.vue';

const AdminImport = () => import('@/components/admin/Import.vue');
// const AdminImportResults = () => import('@/components/admin/ImportResults.vue');

export default {
  name: 'CompetitionAdmin',
  reactiveInject: {
    competitionBundle: [
      'competitionId',
      'competition',
      'competitionRef',
      'competitionDataRef',
      'dancers',
      'groups',
      'categories',
      'dances',
      'staff',
      'platforms',
      'draws',
      'schedule',
      'results',
      'points',
    ],
  },
  data() {
    return {
      idKey,
      mdiAlert,
      mdiCheck,
      mdiImport,
      mdiExport,
      mdiPlaylistPlus,
      mdiTableAlert,

      showImport: false,
      // showImportResults: false,
      searchQuery: '',

      saving: false,
      savingPromises: [],
      savingError: undefined,
    };
  },
  computed: {
    // ...mapRouteParams([
    //   'groupId',
    //   'danceId',
    // ]),

    hasPermission() {
      return this.$store.getters.hasPermission(`competitions/${this.competitionId}`);
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
                if (column.data === 'sponsor') {
                  // eslint-disable-next-line no-param-reassign
                  column.source = this.staff?.filter(({ type }) => type === 'Sponsor') || [];
                  return makeKeyValuePairColumn(column);
                }
                return column;
              }),
            };
          }
          return section;
        });
    },
    currentSection() {
      return this.getSection(this.$root.currentTab);
    },

    hotData() {
      const data = this[this.$root.currentTab];
      if (this.searchQuery && data?.[0]) {
        const searchKeys = accumulateKeys(data[0]);
        return searchByKeys(data, this.searchQuery, searchKeys);
      }
      return data;
    },
    hasHotData() {
      return Boolean(this[this.$root.currentTab]?.length);
    },
    hasMissingPrereqs() {
      return (this.inTabs('groups') && !this.categories.length && !this.groups.length)
        || (this.inTabs('dancers') && !this.groups.length);
    },
    hasPresets() {
      return Boolean(this.currentSection?.presets?.length) && !this.hasMissingPrereqs;
    },
    hasImport() {
      return this.inTabs('categories', 'groups', 'dancers') && this.$vuetify.breakpoint.smAndUp;
    },
    hasExport() {
      return (this.inTabs('results') || this.hasHotData) && this.$vuetify.breakpoint.smAndUp;
    },
  },
  watch: {
    async searchQuery(query) {
      await this.$nextTick();
      const { hotInstance } = this.$refs.hot || {};
      const search = hotInstance?.getPlugin('search');
      search?.query(query);
      hotInstance?.render();
    },
    '$root.currentTab': function currentTab() {
      this.searchQuery = '';
    },
  },
  methods: {
    danceExtender,

    getTabRoute(tab) {
      const params = {
        competitionId: this.competitionId,
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
      return tabs.some((tab) => this.$root.currentTab === tab);
    },
    getSection(sectionId) {
      return this.sections.find((section) => section[idKey] === sectionId);
    },

    awaitSave(promise) {
      this.savingError = null;

      return new Promise((resolve, reject) => {
        this.savingPromises.push(promise);

        if (this.saving) {
          clearTimeout(this.saving);
        }
        this.saving = setTimeout(() => {
          Promise.all(this.savingPromises)
            .then(resolve)
            .catch(reject)
            .finally(() => {
              this.saving = false;
            });
        }, 1000);
      })
        .catch((err) => {
          this.savingError = err;
        });
    },
    handleInfoChanges(changes) {
      this.awaitSave(this.competitionRef.update(changes));
    },
    handleDataChanges(changes) {
      this.awaitSave(this.competitionDataRef.update(changes));
    },
    handleHotChanges(changes) {
      const { currentTab } = this.$root;
      const dataChanges = Object.entries(changes).reduce((acc, [path, change]) => {
        acc[`${currentTab}/${path}`] = change;

        // make sure to remove dancer from any previously generated draws
        if (currentTab === 'dancers' && change === null && pushidRegex.test(path)) {
          const { number, groupId } = findByIdKey(this.dancers, path);
          const draws = this.draws?.[groupId] || {};
          Object.entries(draws).forEach(([danceId, dancerNumbers]) => {
            const index = dancerNumbers.indexOf(number);
            if (index >= 0) {
              const newDancerNumbers = [...dancerNumbers];
              newDancerNumbers.splice(index, 1);
              acc[`draws/${groupId}/${danceId}`] = newDancerNumbers;
            }
          });
        }

        return acc;
      }, {});

      this.handleDataChanges(dataChanges);
    },
    addPresets(presets, tab = this.$root.currentTab) {
      const dataChanges = presets.reduce((acc, preset) => {
        acc[`${tab}/${db.push().key}`] = preset;
        return acc;
      }, {});
      this.handleDataChanges(dataChanges);
    },
    saveCSV(arrayOfObjects) {
      return saveCSV(arrayOfObjects, {
        filename: `${this.currentSection.name} - ${this.competition.name}.csv`,
      });
    },
    exportHotTable() {
      const rows = this.$refs.hot?.hotInstance?.rootElement?.querySelector('table')?.querySelectorAll('tr');
      const textifier = document.createElement('div');
      const data = Array.from(rows || []).map((row) => {
        const cells = row.querySelectorAll('td:not(:first-child), th:not(:first-child)');
        return Array.from(cells || []).map((cell) => {
          const html = cell.innerHTML;
          const cleaned = html
            .replace(/<div class="ht.*?">.*?<\/div>/sig, '') // remove dropdown arrow
            .replace(/<a .*?href="(.*?)".*?>.*?<\/a>/sig, '$1'); // use img/link URL
          textifier.innerHTML = cleaned;
          return textifier.innerText.trim();
        });
      });
      const [colHeaders, ...rowData] = data;
      const exportedData = rowData.map((row) => row.reduce((acc, v, i) => {
        acc[colHeaders[i]] = v;
        return acc;
      }, {}));
      return this.saveCSV(exportedData);
    },
    exportResults() {
      const exportedData = getRows(this.groups, [callbacks, ...this.dances, overall], this.dancers, this.results);
      if (exportedData.length) {
        this.saveCSV(exportedData);
      } else {
        console.warn('No results to export.'); // eslint-disable-line no-console
      }
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

<style lang="scss">
.CompetitionAdmin > .v-toolbar .v-toolbar__content .v-btn.v-btn--icon.v-size--default {
  width: 36px;
  height: 36px;
}
</style>
