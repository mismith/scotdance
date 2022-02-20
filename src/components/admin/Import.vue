<template>
  <v-card class="AdminImport">
    <v-stepper v-model="step">
      <v-stepper-header>
        <v-stepper-step :editable="!!workbook" :complete="step > 1" :step="1">
          Upload
          <small>Select a file to import</small>
        </v-stepper-step>
        <v-divider />
        <v-stepper-step :editable="step > 2" :complete="step > 2" :step="2">
          Find
          <small>Pick which sheet to use</small>
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
          <div class="app-scroll-frame app-scroll pa-4">
            <p>The <strong>Excel spreadsheet</strong> (.xlsx file) should have the following structure:</p>
            <table class="demo mb-3">
              <tbody v-for="category in 2" :key="category">
                <tr>
                  <td>Category / Age Group</td>
                  <td v-for="td in 3" :key="td">&nbsp;</td>
                </tr>
                <tr v-for="dancer in 3" :key="dancer">
                  <td>Dancer Number</td>
                  <td>First Name</td>
                  <td>Last Name</td>
                  <td>Location</td>
                </tr>
                <tr v-if="category === 2">
                  <td v-for="td in 4" :key="td">...</td>
                </tr>
              </tbody>
            </table>
            <v-btn href="/examples/ScotDance-Import-Template.xlsx" download v-test="'import:download-template'">
              <v-icon left>{{ mdiFileExcel }}</v-icon>
              Download Template
            </v-btn>
          </div>

          <v-divider />
          <v-card-actions class="flex-none">
            <v-spacer />

            <v-btn text @click="handleCancel()">Cancel</v-btn>
            <v-file
              accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              @change="handleUpload"
              v-test="'import:step.1:next'"
            >
              <v-btn color="primary">Select File</v-btn>
            </v-file>
          </v-card-actions>
        </v-stepper-content>

        <v-stepper-content :step="2" class="pa-0">
          <v-tabs v-if="workbook" v-model="dancersSheetIndex" show-arrows>
            <v-tab v-for="(sheetName, sheetIndex) of workbook.SheetNames" :key="sheetIndex">
              {{ sheetName }}
            </v-tab>
            <v-tabs-items class="app-scroll-frame">
              <HotTable :key="dancersSheetIndex" :settings="sheetToHot(dancersSheet)" />
            </v-tabs-items>
          </v-tabs>

          <v-divider />
          <v-card-actions class="flex-none">
            <v-btn @click="handleBack()">Previous</v-btn>

            <v-spacer />

            <v-btn text @click="handleCancel()">Cancel</v-btn>
            <v-btn
              color="primary"
              :disabled="dancersSheetIndex < 0"
              @click="handleChoose()"
              v-test="'import:step.2:next'"
            >
              Next
            </v-btn>
          </v-card-actions>
        </v-stepper-content>

        <v-stepper-content :step="3" class="pa-0">
          <v-tabs v-if="data" v-model="dataTabIndex" show-arrows>
            <v-tab v-for="key of dataKeys" :key="key">
              {{ key }}
            </v-tab>
            <v-tabs-items class="app-scroll-frame">
              <HotTable :key="dataTabIndex" :settings="toReviewHot(dataKeys[dataTabIndex])" />
            </v-tabs-items>
          </v-tabs>

          <v-divider />
          <v-card-actions class="flex-none">
            <v-btn @click="handleBack()">Previous</v-btn>

            <v-spacer />

            <v-btn text @click="handleCancel()">Cancel</v-btn>
            <v-btn
              color="primary"
              :disabled="importing"
              :loading="importing"
              @click="handleReview()"
              v-test="'import:step.3:next'"
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
import { read, utils } from 'xlsx';
import find from 'lodash.find';
import VFile from '@outluch/v-file';
import { mdiFileExcel } from '@mdi/js';
import { idKey } from '@/helpers/firebase';
import {
  HotTable,
  augmentHot,
} from '@/helpers/admin';

export default {
  name: 'AdminImport',
  props: {
    competitionDataRef: {
      type: Object,
      required: true,
    },
    groups: Array,
    categories: Array,
    dancers: Array,
  },
  data() {
    return {
      mdiFileExcel,

      step: 1,

      workbook: undefined,
      dancersSheetIndex: 0,
      dataTabIndex: 0,
      data: undefined,

      importing: false,
    };
  },
  computed: {
    dancersSheet() {
      if (this.workbook) {
        return this.workbook.Sheets[this.workbook.SheetNames[this.dancersSheetIndex]];
      }
      return undefined;
    },
    dataKeys() {
      return Object.keys(this.data || {});
    },
  },
  methods: {
    handleBack() {
      this.step = Math.max(1, this.step - 1);
    },
    handleUpload(file) {
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target.result;
        const workbook = read(data, { type: 'binary' });

        // auto-pick default sheets
        const autoDetectedSheetIndex = workbook.SheetNames.findIndex((name) => /Program/i.test(name));
        this.dancersSheetIndex = autoDetectedSheetIndex >= 0 ? autoDetectedSheetIndex : 0;

        // store for processing
        this.$set(this, 'workbook', workbook);

        // move to next step
        this.step += 1;
      };
      reader.readAsBinaryString(file);
    },
    handleChoose() {
      // store for reviewing
      this.$set(this, 'data', this.parseSpreadsheet(this.dancersSheet));

      // move to next step
      this.step += 1;
    },
    async handleReview() {
      const {
        categories,
        groups,
        dancers,
      } = this.data;

      await this.importData(categories, groups, dancers);

      this.handleCancel();
    },
    handleCancel() {
      // close dialog
      this.$emit('done');
      this.step = 1;
      this.data = undefined;
      this.workbook = undefined;
    },

    toReviewHot(key) {
      let data;
      switch (key) {
        case 'groups': {
          data = this.data[key].map((item) => {
            const { number, code, ...datum } = item;
            return datum;
          });
          break;
        }
        case 'dancers': {
          data = this.data[key].map((item) => {
            const { code, ...datum } = item;

            const group = this.data.groups.find((g) => `${g.code}` === `${code}`);
            if (group) datum.group = `${group.category} ${group.name}`;

            return datum;
          });
          break;
        }
        default: {
          data = this.data[key];
        }
      }
      return augmentHot({
        colHeaders: Object.keys((data && data[0]) || {}),
        minSpareRows: 0,
        readOnly: true,
      }, data);
    },
    sheetToJson(sheet, options = { header: 1, raw: true, defval: null }) {
      return utils.sheet_to_json(sheet, options)
        .filter((row) => Object.values(row).some(Boolean)); // remove empties
    },
    sheetToHot(sheet) {
      const rows = this.sheetToJson(sheet);
      const minCols = rows.reduce((num, row) => Math.max(num, row.length), 0);

      return augmentHot({
        minCols,
        minSpareRows: 0,
        readOnly: true,
      }, rows);
    },
    parseSpreadsheet(dancersSheet) {
      const dancersData = this.sheetToJson(dancersSheet, {
        header: [
          'number',
          'firstName',
          'lastName',
          'location',
        ],
      });

      const groups = {};
      const dancers = [];
      const categories = [];
      let currentCode;
      dancersData.forEach((datum) => {
        if (!datum.number || !String(datum.number).trim()) return; // skip blanks
        if (!/^\d+$/.test(datum.number)) {
          currentCode = Object.keys(groups).length + 1;

          // parse group and category from section header
          const title = String(datum.number).trim();
          const category = title.replace(/\d(.*)$/, '').trim();
          const name = title.replace(category, '').trim();
          if (categories.indexOf(category) < 0) {
            categories.push(category);
          }

          groups[currentCode] = {
            code: currentCode,
            category,
            name,
          };
        } else {
          // dancer
          dancers.push({
            number: datum.number,
            firstName: String(datum.firstName || '').trim(),
            lastName: String(datum.lastName || '').trim(),
            location: String(datum.location || '').trim(),
            code: currentCode,
          });
        }
      });

      // return all items normalized to arrays
      return {
        dancers,
        groups: Object.values(groups),
        categories: categories.map((category) => ({ name: category })),
      };
    },
    async importData(categories, groups, dancers) {
      this.importing = true;
      await this.$nextTick();

      const categoryMappings = await Promise.all(categories.map(async (categoryData) => {
        const matches = {
          name: categoryData.name,
        };
        const category = find(this.categories, matches) || matches;

        let key = category[idKey];
        if (!key) {
          // add to db
          ({ key } = await this.competitionDataRef.child('categories').push(category));
        }

        // pass through
        return {
          [idKey]: key,
          ...category,
        };
      }));

      const groupMappings = await Promise.all(groups.map(async (groupData) => {
        const categoryId = categoryMappings
          .find((category) => String(category.name) === String(groupData.category));
        const matches = {
          name: groupData.name,
          categoryId: (categoryId && categoryId[idKey]) || null,
        };
        const group = find(this.groups, matches) || matches;

        let key = group[idKey];
        if (!key) {
          // add to db
          ({ key } = await this.competitionDataRef.child('groups').push(group));
        }

        // pass through
        return {
          [idKey]: key,
          code: groupData.code,
          ...group,
        };
      }));

      await Promise.all(dancers.map(async (dancerData) => {
        const groupId = groupMappings
          .find((group) => String(group.code) === String(dancerData.code));
        const matches = {
          number: dancerData.number,
          firstName: dancerData.firstName || null,
          lastName: dancerData.lastName || null,
          location: dancerData.location || null,
        };
        const dancer = find(this.dancers, matches) || matches;
        dancer.groupId = (groupId && groupId[idKey]) || dancer.groupId || null;
        dancer.categoryId = (groupId && groupId.categoryId) || dancer.categoryId || null;

        let key = dancer[idKey];
        if (!key) {
          // add to db
          ({ key } = await this.competitionDataRef.child('dancers').push(dancer));
        }

        return {
          [idKey]: key,
          ...dancer,
        };
      }));

      this.importing = false;
    },
  },
  components: {
    HotTable,
    VFile,
  },
};
</script>

<style lang="scss">
.AdminImport {
  table.demo {
    border-spacing: 0;
    border: 1px solid #ccc;
    border-width: 0 0 1px 1px;

    td {
      width: 25%;
      padding: 1px 4px;
      border: 1px solid #ccc;
      border-width: 1px 1px 0 0;
    }
  }
}
</style>
