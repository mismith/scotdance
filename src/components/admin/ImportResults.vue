<template>
  <v-card class="AdminImportResults">
    <v-stepper v-model="step">
      <v-stepper-header>
        <v-stepper-step :editable="!!imported.length" :complete="step > 1" :step="1">
          Upload
          <small>Select files to import</small>
        </v-stepper-step>
        <v-divider />
        <v-stepper-step :editable="step > 2" :complete="step > 2" :step="2">
          Choose
          <small>Pick which data to use</small>
        </v-stepper-step>
        <v-divider />
        <v-stepper-step :step="3">
          Review
          <small>Ensure values look correct</small>
        </v-stepper-step>
      </v-stepper-header>
      <v-divider />

      <v-stepper-items>
        <v-stepper-content :step="1" class="pa-0">
          <div class="app-scroll-frame app-scroll pa-4 alt">
            <h3>Instructions</h3>
            <ol>
              <li>Select the <strong>HTML file(s)</strong> below that contain(s) the exported values from Highland Scrutineer.</li>
              <li>Ensure all the imported values correlate to existing data&mdash;the defaults may not always be correct&mdash;then click <strong>Next</strong>.</li>
              <li>Double-check that all values were parsed properly&mdash;this is how data will be imported, so if anything is missing or looks broken, it will likely fail to import properly. When sure, click <strong>Import</strong>.</li>
            </ol>
          </div>

          <v-divider />
          <v-card-actions class="justify-end flex-none">
            <v-btn text @click="handleCancel()">Cancel</v-btn>

            <v-file
              accept="text/html"
              multiple
              @change="handleUpload"
            >
              <v-btn text color="primary">Select File(s)</v-btn>
            </v-file>
          </v-card-actions>
        </v-stepper-content>
        <v-stepper-content :step="2" class="pa-0">
          <v-row class="flex-wrap app-scroll-frame app-scroll alt">
            <div class="d-flex col-6">
              <v-subheader>Group(s)</v-subheader>
              <div v-for="datum in imported" :key="datum.file" class="px-4">
                <v-select
                  v-model="mapped[datum.group]"
                  :label="datum.group"
                  :items="groups"
                  :item-value="idKey"
                  item-text="$name"
                  filled
                />
              </div>
            </div>
            <div class="d-flex col-6">
              <v-subheader>Dance(s)</v-subheader>
              <div v-for="danceName in getUniqueDances(imported)" :key="danceName" class="px-4">
                <v-select
                  v-model="mapped[danceName]"
                  :label="danceName"
                  :items="dances"
                  :item-value="idKey"
                  item-text="$name"
                  filled
                />
              </div>
            </div>
          </v-row>

          <v-divider />
          <v-card-actions class="justify-end flex-none">
            <v-btn text @click="handleCancel()">Cancel</v-btn>

            <v-btn
              text
              color="primary"
              @click="handleChoose()"
            >
              Next
            </v-btn>
          </v-card-actions>
        </v-stepper-content>
        <v-stepper-content :step="3" class="pa-0">
          <Blades class="stacks">
            <Blade class="col-12 col-md-6 app-scroll alt">
              <ResultsList
                :groups="groups.filter(group => Object.keys(results).includes(group[idKey]))"
                :dances="dances"
                :dancers="dancers"
                :results="results"
              />
            </Blade>
            <Blade class="col-12 col-md-6 app-scroll alt">
              <PlacedDancerList
                v-if="placedDancers.length"
                :dance="currentDance"
                :dancers="placedDancers"
              />
              <EmptyState
                v-else
                icon="mdi-view-split-vertical"
                label="Placed dancers"
                description="Double-check the results to import"
              />
            </Blade>
          </Blades>

          <v-divider />
          <v-card-actions class="justify-end flex-none">
            <v-btn text @click="handleCancel()">Cancel</v-btn>

            <v-btn
              text
              color="primary"
              :disabled="importing"
              :loading="importing"
              @click="handleReview()"
            >
              Import
            </v-btn>
          </v-card-actions>
        </v-stepper-content>
      </v-stepper-items>
    </v-stepper>
  </v-card>
</template>

<script>
import HTMLParser from 'fast-html-parser';
import Fuse from 'fuse.js';
import VFile from '@outluch/v-file';
import ResultsList from '@/components/admin/ResultsList.vue';
import PlacedDancerList from '@/components/PlacedDancerList.vue';
import { idKey } from '@/helpers/firebase';
import { findByIdKey } from '@/helpers/competition';
import {
  overall,
  callbacks,
  getPlaceholderDancer,
  findPlacedDancers,
} from '@/helpers/results';

export default {
  name: 'AdminImportResults',
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

      step: 1,

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
      this.step += 1;
    },
    handleChoose() {
      this.results = this.parseData(this.imported);

      // move to next step
      this.step += 1;
    },
    async handleReview() {
      await this.importData();

      // close dialog
      this.$emit('done');
      this.step = 1;
    },
    handleCancel() {
      // close dialog
      this.$emit('done');
      this.step = 1;
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
    async importData() {
      this.importing = true;
      await this.$nextTick();

      await Promise.all(Object.entries(this.results).map(async ([groupId, result]) => {
        // save to db
        return this.competitionDataRef.child('results').child(groupId).set(result);
      }));

      this.importing = false;
    },
  },
  components: {
    ResultsList,
    PlacedDancerList,
    VFile,
  },
};
</script>
