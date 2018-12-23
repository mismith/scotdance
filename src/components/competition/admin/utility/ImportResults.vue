<template>
  <md-steppers :md-active-step.sync="step" md-linear class="admin-import-results">
    <md-step id="upload" md-label="Upload" md-description="Select a file to import">
      <div class="app-scroll-frame app-scroll pa-3">
        <h2>Instructions</h2>
        <ol>
          <li>Select the <strong>HTML file(s)</strong> below that contain(s) the exported values from Highland Scrutineer.</li>
          <li>Ensure all the imported values correlate to existing data&mdash;the defaults may not always be correct&mdash;then click <strong>Next</strong>.</li>
          <li>Double-check that all values were parsed properly&mdash;this is how data will be imported, so if anything is missing or looks broken, it will likely fail to import properly. When sure, click <strong>Import</strong>.</li>
        </ol>
      </div>
      <md-toolbar class="md-layout">
        <md-field class="md-layout-item">
          <label>HTML file(s)</label>
          <md-file
            @md-change="handleUpload($event)"
            accept="text/html"
            multiple
          />
        </md-field>
      </md-toolbar>
    </md-step>
    <md-step id="choose" md-label="Choose" md-description="Pick which data to use">
      <form class="app-scroll-frame app-scroll">
        <v-subheader>Group(s)</v-subheader>
        <div v-for="datum in imported" :key="datum.file" class="md-layout md-gutter md-layout-nowrap pa-3">
          <div class="md-layout-item md-size-45">{{ datum.group }}</div>
          <span class="md-layout-item md-size-5">&rarr;</span>
          <div class="md-layout-item md-size-50">
            <md-field md-dense>
              <md-select v-model="mapped[datum.group]">
                <md-option v-for="group in groups" :key="group[idKey]" :value="group[idKey]">{{ group.$name }}</md-option>
              </md-select>
            </md-field>
          </div>
        </div>

        <v-subheader>Dance(s)</v-subheader>
        <div v-for="danceName in getUniqueDances(imported)" :key="danceName" class="md-layout md-gutter md-layout-nowrap pa-3">
          <div class="md-layout-item md-size-45">{{ danceName }}</div>
          <span class="md-layout-item md-size-5">&rarr;</span>
          <div class="md-layout-item md-size-50">
            <md-field md-dense>
              <md-select v-model="mapped[danceName]">
                <md-option v-for="dance in dances" :key="dance[idKey]" :value="dance[idKey]">{{ dance.$name }}</md-option>
              </md-select>
            </md-field>
          </div>
        </div>
      </form>
      <md-toolbar class="md-layout">
        <div class="md-layout-item" />
        <footer>
          <v-btn
            colo="primary"
            @click="handleChoose()"
          >
            Next
          </v-btn>
        </footer>
      </md-toolbar>
    </md-step>
    <md-step id="review" md-label="Review" md-description="Ensure values look correct">
      <blades>
        <blade class="xs12 md6 app-scroll alt">
          <results-list
            :groups="groups.filter(group => Object.keys(results).includes(group[idKey]))"
            :dances="dances"
            :dancers="dancers"
            :results="results"
          />
        </blade>
        <blade class="xs12 md6 app-scroll">
          <placed-dancer-list
            v-if="placedDancers.length"
            :dance="currentDance"
            :dancers="placedDancers"
          />
          <div v-else>
            <empty-state
              icon="vertical_split"
              md-label="Placed dancers"
              md-description="Double-check the results to import"
            />
          </div>
        </blade>
      </blades>
      <md-toolbar class="md-layout">
        <div class="md-layout-item" />
        <footer>
          <v-btn
            color="primary"
            :disabled="importing"
            :loading="importing"
            @click="handleReview()"
          >
            Import
          </v-btn>
        </footer>
      </md-toolbar>
    </md-step>
  </md-steppers>
</template>

<script>
import HTMLParser from 'fast-html-parser';
import Fuse from 'fuse.js';
import ResultsList from '@/components/competition/admin/utility/ResultsList.vue';
import PlacedDancerList from '@/components/utility/PlacedDancerList.vue';
import { idKey } from '@/helpers/firebase';
import { findByIdKey } from '@/helpers/competition';
import {
  overall,
  callbacks,
  getPlaceholderDancer,
  findPlacedDancers,
} from '@/helpers/results';

export default {
  name: 'admin-import-results',
  props: {
    groupId: String,
    danceId: String,

    competitionDataRef: {
      type: Object,
      required: true,
    },
    groups: Array,
    dances: Array,
    dancers: Array,
  },
  data() {
    return {
      idKey,

      step: 'upload',

      imported: [],
      mapped: {},
      results: {},

      importing: false,
    };
  },
  computed: {
    currentGroup() {
      const { groupId } = this.$route.params;
      if (groupId) {
        return findByIdKey(this.groups, groupId);
      }
      return null;
    },
    currentDance() {
      const { danceId } = this.$route.params;
      if (danceId) {
        if (danceId === overall[idKey]) {
          return overall;
        } else if (danceId === callbacks[idKey]) {
          return callbacks;
        }
        return findByIdKey(this.dances, danceId);
      }
      return null;
    },
    placedDancers() {
      if (this.currentGroup && this.currentDance) {
        const sortByNumber = this.currentDance[idKey] === callbacks[idKey];
        return findPlacedDancers(this.currentGroup, this.currentDance, this.dancers, this.results, sortByNumber);
      }
      return [];
    },
  },
  methods: {
    parseHTML(html) {
      const doc = HTMLParser.parse(html, { lowerCaseTagName: true });
      const strings = Array.from(doc.querySelectorAll('table tr') || [])
        .map(tr => Array.from(tr.querySelectorAll('td'))
          .map(td => td.structuredText)
          .filter(cell => cell))
        .filter(rows => rows.length)
        .reduce((acc, arr) => acc.concat(arr), []);
      const parseDancers = string => string
        .split('\n')
        .map(line => line.match(/^\d+\s*(=)?\s+(\d+)\s+(.+?)(?:,\s*(.*?))$/))
        .filter(v => v)
        .map(([, tie, number, $name, $location]) => ({
          number,
          $tie: !!tie,
          $name,
          $location,
        }));

      const name = strings.shift();
      const date = strings.shift();
      const group = strings.shift();

      // eslint-disable-next-line no-shadow
      const callbacks = strings.find(string => /Callbacks/.test(string))
        .split(':')[1]
        .trim()
        .split(' ')
        .map(number => ({
          number,
        }));
      // eslint-disable-next-line no-shadow
      const overall = parseDancers(strings.find(string => /Overall Winner/.test(string))
        .split('\n')[1]);

      // clean up remaining strings
      const endIndex = strings.indexOf(name); // trim things we've already parsed
      if (endIndex >= 0) {
        strings.splice(endIndex);
      }
      strings.shift(); // remove (unused/extraneous) dance results title

      const dances = [];
      const dancers = [];
      strings.forEach((string) => {
        const parsed = parseDancers(string);
        if (parsed.length) {
          dancers.push(parsed);
        } else {
          dances.push(string);
        }
      });

      return {
        name,
        date,
        group,
        callbacks,
        dances,
        dancers,
        overall,
      };
    },
    async handleUpload(files) {
      this.imported = await Promise.all(Array.from(files).map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const datum = this.parseHTML(event.target.result);
          return resolve({
            file: file.name,
            ...datum,
          });
        };
        reader.onerror = err => reject(err);
        reader.readAsBinaryString(file);
      })));

      const groupFuse = new Fuse(this.groups, {
        keys: ['$name', 'name'],
        shouldSort: true,
      });
      const danceFuse = new Fuse(this.dances, {
        keys: ['$name', 'name', '$shortName', 'shortName'],
        shouldSort: true,
      });
      this.imported.forEach((datum) => {
        // pre-select default picks, if possible, based on fuzzy string matches
        const [group] = groupFuse.search(datum.group);
        if (group) this.mapped[datum.group] = group[idKey];

        datum.dances.forEach((danceName) => {
          const [dance] = danceFuse.search(danceName);
          if (dance) this.mapped[danceName] = dance[idKey];
        });
      });

      // move to next step
      this.step = 'choose';
    },

    getUniqueDances(imported) {
      return imported.reduce((dances, datum) => dances.concat(datum.dances), [])
        .filter((v, i, a) => a.indexOf(v) === i);
    },
    parseData(imported) {
      const results = {};
      imported.forEach((datum) => {
        const getResultKey = (entry) => {
          const dancer = this.dancers.find(d => d.number === entry.number);
          const dancerId = (dancer || getPlaceholderDancer())[idKey];
          return `${dancerId}${entry.$tie ? ':tie' : ''}`;
        };

        const groupId = this.mapped[datum.group];
        const danceIds = datum.dances.map(name => this.mapped[name]);
        const dances = {};
        datum.dancers.forEach((placedDancers, index) => {
          const danceId = danceIds[index];
          if (danceId) {
            dances[danceId] = placedDancers.map(getResultKey);
          }
        });

        results[groupId] = {
          ...dances,
          [callbacks[idKey]]: datum.callbacks.map(getResultKey),
          [overall[idKey]]: datum.overall.map(getResultKey),
        };
      });
      return results;
    },
    handleChoose() {
      this.results = this.parseData(this.imported);

      // move to next step
      this.step = 'review';
    },

    async importData() {
      this.importing = true;
      await this.$nextTick();

      await Promise.all(Object.entries(this.results).map(async ([groupId, result]) => {
        // save to db
        return this.competitionDataRef.child('results').child(groupId).set(result);
      }));

      this.$emit('done');
      this.importing = false;
    },
    handleReview() {
      this.importData();
    },
  },
  components: {
    ResultsList,
    PlacedDancerList,
  },
};
</script>

<style lang="scss">
.admin-import-results {
  .md-steppers-wrapper,
  .md-steppers-container,
  .md-stepper {
    height: 100% !important;
  }
  form {
    .md-layout {
      align-items: center;
      flex-shrink: 0;

      .md-field {
        margin-top: -16px;
        margin-bottom: 0;
      }
    }
  }
}
</style>
