<template>
  <md-steppers :md-active-step.sync="step" md-linear class="admin-import">
    <md-step
      id="upload"
      md-label="Upload"
      md-description="Select a file to import"
      :md-done="step !== 'upload'"
    >
      <div class="md-scroll-frame md-scroll md-padding">
        <h3>Instructions</h3>
        <ol>
          <li>Select the <strong>Excel spreadsheet</strong> (.xslx file) that contains the values to import.</li>
          <li>Pick the sheet that contains a list of dancers with age grouping headers, then click <strong>Next</strong>.</li>
          <li>Double-check that all values were parsed properly&mdash;this is how data will be imported, so if anything is missing or looks broken, it will likely fail to import properly. If it looks okay, click <strong>Import</strong>.</li>
        </ol>

        <h3>Formatting</h3>
        <p>The spreadsheet should have the following structure:</p>
        <table class="demo">
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
            <tr>
              <td v-for="td in 4" :key="td">{{ category === 1 ? '&nbsp;' : '...' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <md-toolbar class="md-layout">
        <div class="md-layout-item">
          <md-field>
            <label>Spreadsheet file</label>
            <md-file
              @md-change="handleUpload($event[0])"
              accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            />
          </md-field>
        </div>
        <footer>
          <md-button @click="handleCancel()">Cancel</md-button>
        </footer>
      </md-toolbar>
    </md-step>
    <md-step
      id="choose"
      md-label="Choose"
      md-description="Pick which data to use"
      :md-done="step === 'review'"
    >
      <md-tabs v-if="workbook" @md-changed="handleSheetChange">
        <md-tab
          v-for="(sheetName, sheetIndex) of workbook.SheetNames"
          :key="sheetIndex"
          :id="`tab-sheet-${sheetIndex}`"
          :md-label="sheetName"
        >
          <HotTable :settings="sheetToHot(workbook.Sheets[sheetName])" />
        </md-tab>
      </md-tabs>
      <md-toolbar v-if="workbook" class="md-layout">
        <div class="md-layout-item" />
        <footer>
          <md-button @click="handleCancel()">Cancel</md-button>
          <md-button
            @click="handleChoose()"
            :disabled="dancersSheetIndex < 0"
            class="md-raised md-primary"
          >
            Next
          </md-button>
        </footer>
      </md-toolbar>
    </md-step>
    <md-step
      id="review"
      md-label="Review"
      md-description="Ensure values look correct"
    >
      <md-tabs v-if="data" md-active-tab="tab-dancers">
        <md-tab
          v-for="(items, key) of data"
          :key="key"
          :id="`tab-${key}`"
          :md-label="key"
        >
          <HotTable :settings="toReviewHot(items, key)" />
        </md-tab>
      </md-tabs>
      <md-toolbar class="md-layout">
        <div class="md-layout-item" />
        <footer>
          <md-button @click="handleCancel()">Cancel</md-button>
          <md-spinnable :md-spinning="importing" md-left>
            <md-button
              @click="handleReview()"
              :disabled="importing"
              class="md-raised md-primary"
            >
              Import
            </md-button>
          </md-spinnable>
        </footer>
      </md-toolbar>
    </md-step>
  </md-steppers>
</template>

<script>
import XLSX from 'xlsx';
import find from 'lodash.find';
import { idKey } from '@/helpers/firebase';
import {
  HotTable,
  augmentHot,
} from '@/helpers/admin';

export default {
  name: 'admin-import',
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
      step: 'upload',

      workbook: undefined,

      dancersSheetIndex: -1,
      data: {},

      importing: false,
    };
  },
  methods: {
    toReviewHot(items, key) {
      let data;
      switch (key) {
        case 'groups': {
          data = items.map((item) => {
            const { number, code, ...datum } = item;
            return datum;
          });
          break;
        }
        case 'dancers': {
          data = items.map((item) => {
            const { code, ...datum } = item;

            const group = this.data.groups.find(g => `${g.code}` === `${code}`);
            if (group) datum.group = `${group.category} ${group.name}`;

            return datum;
          });
          break;
        }
        default: {
          data = items;
        }
      }
      return augmentHot({
        colHeaders: Object.keys(data[0] || {}),
        minSpareRows: 0,
        readOnly: true,
      }, data);
    },
    sheetToJson(sheet, options = { header: 1 }) {
      return XLSX.utils.sheet_to_json(sheet, options)
        // eslint-disable-next-line no-unused-vars
        .filter(row => Object.entries(row).some(([k, v]) => v)); // remove empties
    },
    sheetToHot(sheet, settings = {}) {
      const rows = this.sheetToJson(sheet);
      const minCols = rows.reduce((num, row) => Math.max(num, row.length), 0);

      return augmentHot({
        minCols,
        minSpareRows: 0,
        readOnly: true,
        ...settings,
      }, rows);
    },

    handleUpload(file) {
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // store for processing
        this.$set(this, 'workbook', workbook);

        // move to next step
        this.step = 'choose';

        // auto-pick default sheets
        this.dancersSheetIndex = workbook.SheetNames.findIndex(name => /Program/i.test(name));
      };
      reader.readAsBinaryString(file);
    },
    handleSheetChange(tabId) {
      this.dancersSheetIndex = Number.parseInt(tabId.replace(/[^0-9]/g, ''), 10);
    },
    handleChoose() {
      const dancersSheet = this.workbook.Sheets[this.workbook.SheetNames[this.dancersSheetIndex]];

      // store for reviewing
      this.$set(this, 'data', this.parseSpreadsheet(dancersSheet));

      // move to next step
      this.step = 'review';
    },
    handleReview() {
      const {
        categories,
        groups,
        dancers,
      } = this.data;

      this.importData(categories, groups, dancers);
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
        if (!datum.number) return; // skip blanks
        if (!/^\d+$/.test(datum.number)) {
          currentCode = Object.keys(groups).length + 1;

          // parse group and category from section header
          const title = (datum.number || '').trim();
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
            firstName: datum.firstName,
            lastName: datum.lastName,
            location: datum.location,
            code: currentCode,
          });
        }
      });

      // return all items normalized to arrays
      return {
        dancers,
        groups: Object.values(groups),
        categories: categories.map(category => ({ name: category })),
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
          .find(category => `${category.name}` === `${groupData.category}`);
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
          .find(group => `${group.code}` === `${dancerData.code}`);
        const matches = {
          number: dancerData.number,
          firstName: dancerData.firstName,
          lastName: dancerData.lastName,
          location: dancerData.location,
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

      this.$emit('done');
      this.importing = false;
    },
    handleCancel() {
      this.$emit('done');
    },
  },
  components: {
    HotTable,
  },
};
</script>

<style lang="scss">
.admin-import {
  .md-toolbar.md-layout {
    > .md-layout-item {
      margin-right: 16px;
    }
    > footer.md-layout-item {
      flex: 0;
      margin-right: 0;
    }
  }
  h3 {
    margin-bottom: 0;
  }
  table.demo {
    border-spacing: 0;
    border: 1px solid #ccc;
    border-width: 0 0 1px 1px;

    td {
      width: 25%;
      border: 1px solid #ccc;
      border-width: 1px 1px 0 0;
    }
  }
}
</style>
