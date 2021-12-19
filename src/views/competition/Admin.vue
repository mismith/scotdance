<template>
  <RequiresPermission :permission="hasPermission" class="CompetitionAdmin app-scroll-frame">
    <v-toolbar dense class="flex-none">
      <v-tooltip right v-if="demo">
        <template #activator="{ on }">
          <v-btn
            v-on="on"
            text
            rounded
            outlined
            color="amber"
            :to="{ name: 'competitions.demo' }"
            class="mr-3"
          >
            <v-icon class="ml-n1 mr-3">{{ mdiMonitorEye }}</v-icon>
            <CountdownTicker
              :end-timestamp="demo.started + DEMO_DURATION"
              @end="handleDemoExpire"
            />
          </v-btn>
        </template>
        Demo expiry
      </v-tooltip>

      <template v-if="currentSection && currentSection.presets">
        <PresetPicker
          :presets="currentSection.presets"
          :prop="currentSection[idKey] === 'dances' ? p => danceExtender(p).$name : 'name'"
          @select="addPresets"
        />
      </template>
      <template v-if="inTabs('categories', 'groups', 'dancers')">
        <v-btn text @click="showImport = true" class="hidden-xs-only" v-test="'admin:import'">Import&hellip;</v-btn>
      </template>

      <v-spacer />

      <template v-if="inTabs('staff', 'dances', 'categories', 'groups', 'dancers', 'platforms')">
        <v-btn text @click="exportHotTable()" class="hidden-xs-only">Export CSV</v-btn>
      </template>
      <template v-if="inTabs('results')">
        <!-- <v-btn text @click="showImportResults = true" class="hidden-xs-only">Import&hellip;</v-btn> -->
        <v-btn text @click="exportResults()">Export CSV</v-btn>
      </template>

      <v-tooltip
        :left="!savingError"
        :bottom="!!savingError"
        :color="savingError ? 'error' : undefined"
      >
        <template #activator="{ on }">
          <v-btn
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
    </v-toolbar>

    <div v-if="currentSection" class="app-scroll-frame app-scroll">
      <template v-if="currentSection.hot">
        <EmptyState
          v-if="inTabs('groups') && !this.categories.length && !this.groups.length"
          :icon="mdiAlert"
          label="No categories found"
        >
          <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'categories' } }">
            <span class="subtitle-1">Add or import some first &rsaquo;</span>
          </router-link>
        </EmptyState>
        <EmptyState
          v-else-if="inTabs('dancers') && !this.groups.length"
          :icon="mdiAlert"
          label="No age groups found"
        >
          <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'groups' } }">
            <span class="subtitle-1">Add or import some first &rsaquo;</span>
          </router-link>
        </EmptyState>
        <MiHotTable
          v-else
          ref="hot"
          :settings="currentSection.hot"
          :data="this[$root.currentTab]"
          @change="handleHotChanges"
        />
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
import { mapState } from 'vuex';
import saveCSV from 'save-csv';
import {
  mdiAlert,
  mdiCheck,
  mdiMonitorEye,
} from '@mdi/js';
import {
  makeKeyValuePairColumn,
} from '@/helpers/admin';
import {
  findByIdKey,
  danceExtender,
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
  DEMO_DURATION,
  stopDemo,
} from '@/helpers/demos';
import {
  callbacks,
  overall,
  getRows,
} from '@/helpers/results';
import competitionAdminSchema from '@/schemas/competition-admin';
import RequiresPermission from '@/components/RequiresPermission.vue';
import MiHotTable from '@/components/admin/MiHotTable.vue';
import PresetPicker from '@/components/admin/PresetPicker.vue';
import CountdownTicker from '@/components/CountdownTicker.vue';

const AdminImport = () => import(/* webpackChunkName: "AdminImport" */ '@/components/admin/Import.vue');
// const AdminImportResults = () => import(/* webpackChunkName: "AdminImport" */ '@/components/admin/ImportResults.vue');

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
    ],
  },
  data() {
    return {
      idKey,
      mdiAlert,
      mdiCheck,
      mdiMonitorEye,

      showImport: false,
      // showImportResults: false,

      saving: false,
      savingPromises: [],
      savingError: undefined,

      DEMO_DURATION,
      demoRef: undefined,
    };
  },
  computed: {
    ...mapState([
      'me',
    ]),

    // ...mapRouteParams([
    //   'groupId',
    //   'danceId',
    // ]),

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
  },
  watch: {
    'competition.demo': {
      async handler(demo) {
        if (demo) { // @TODO: what if this.me is still undefined?
          this.demoRef = db.child('users:demos').child(this.me[idKey]).child(this.competitionId);
          if (this.demo) this.$unbind('demo');
          this.$bindAsObject('demo', this.demoRef);
        }
      },
      immediate: true,
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
      const { hotInstance } = this.$refs.hot.$refs.hot;
      const rows = hotInstance.rootElement?.querySelector('table')?.querySelectorAll('tr');
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

    async handleDemoExpire() {
      if (this.demoRef) {
        // @TODO: toast/alert user?
        await stopDemo(this.demoRef);
        this.$router.push({
          name: 'competitions.demo',
        });
      }
    },
  },
  components: {
    RequiresPermission,
    MiHotTable,
    AdminImport,
    // AdminImportResults,
    PresetPicker,
    CountdownTicker,
  },
};
</script>
