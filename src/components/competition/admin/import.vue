<template>
  <md-steppers :md-active-step.sync="step" md-linear class="admin-import">
    <md-step id="upload" md-label="Upload" md-description="Select a file to import">
      <div class="md-scroll-frame md-padding" style="font-size: 1.2em;">
        <h2>Instructions</h2>
        <ol style="max-width: 600px;">
          <li>Select the Excel spreadsheet (.xslx file) that contains the exported values to import. Click <strong>Next</strong>.</li>
          <li>Determine which sheet contains the list of dancers, and which one contains the age groupings. Select each, respectively, then click <strong>Next</strong>.</li>
          <li>Double-check that all values were parsed properly&mdash;this is how data will be imported, so if anything is missing or looks broken, it will likely fail to import properly. When sure, click <strong>Import</strong>.</li>
        </ol>
      </div>
      <md-toolbar class="md-layout">
        <md-field class="md-layout-item">
          <label>Spreadsheet file</label>
          <md-file
            @md-change="file = $event[0]"
            accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />
        </md-field>
        <footer class="md-layout-item">
          <md-button
            @click="handleUpload()"
            :disabled="!file"
            class="md-raised md-primary"
          >
            Next
          </md-button>
        </footer>
      </md-toolbar>
    </md-step>
    <md-step id="choose" md-label="Choose" md-description="Pick which data to use">
      <md-tabs v-if="workbook" md-active-tab="tab-sheet-0">
        <md-tab
          v-for="(sheetName, sheetIndex) of workbook.SheetNames"
          :key="sheetIndex"
          :id="`tab-sheet-${sheetIndex}`"
          :md-label="sheetName"
        >
          <HotTable :options="sheetToHot(workbook.Sheets[sheetName])" />
        </md-tab>
      </md-tabs>
      <md-toolbar v-if="workbook" class="md-layout">
        <div class="md-layout-item">
          <md-field>
            <label>Dancers sheet</label>
            <md-select v-model="dancersSheetIndex">
              <md-option
                v-for="(sheetName, sheetIndex) of workbook.SheetNames"
                :key="sheetIndex"
                :value="sheetIndex"
              >
                {{sheetName}}
              </md-option>
            </md-select>
          </md-field>
        </div>
        <div class="md-layout-item">
          <md-field>
            <label>Groups sheet</label>
            <md-select v-model="groupsSheetIndex">
              <md-option
                v-for="(sheetName, sheetIndex) of workbook.SheetNames"
                :key="sheetIndex"
                :value="sheetIndex"
              >
                {{sheetName}}
              </md-option>
            </md-select>
          </md-field>
        </div>
        <footer class="md-layout-item">
          <md-button
            @click="handleChoose()"
            :disabled="dancersSheetIndex < 0 || groupsSheetIndex < 0"
            class="md-raised md-primary"
          >
            Next
          </md-button>
        </footer>
      </md-toolbar>
    </md-step>
    <md-step id="review" md-label="Review" md-description="Ensure values look correct">
      <md-tabs v-if="data" md-active-tab="tab-categories">
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
        <div class="md-layout-item"></div>
        <footer class="md-layout-item">
          <md-button
            @click="handleReview()"
            class="md-raised md-primary"
          >
            Import
          </md-button>
        </footer>
      </md-toolbar>
    </md-step>
  </md-steppers>
</template>

<script>
import XLSX from 'js-xlsx';
import HotTable from '@handsontable/vue';

import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'admin-import',
  props: {
    competitionDataRef: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      step: 'upload',

      file: undefined,
      workbook: undefined,

      dancersSheetIndex: -1,
      groupsSheetIndex: -1,
      data: {},
    };
  },
  methods: {
    toHot(data, settings = {}) {
      return Object.assign({
        data,
        rowHeaders: true,
        colHeaders: true,
        stretchH: 'all',
        readOnly: true,
      }, settings);
    },
    toReviewHot(items, key) {
      let data;
      switch (key) {
        case 'groups': {
          data = items.map((item) => {
            const datum = Object.assign({}, item);

            delete datum.number;

            return datum;
          });
          break;
        }
        case 'dancers': {
          data = items.map((item) => {
            const datum = Object.assign({}, item);

            const group = this.data.groups.find(g => `${g.number}` === `${datum.group}`);
            if (group) datum.group = group.name;

            return datum;
          });
          break;
        }
        default: {
          data = items;
        }
      }
      return this.toHot(data, {
        colHeaders: Object.keys(data[0]),
      });
    },
    sheetToJson(sheet, options = { header: 1 }) {
      return XLSX.utils.sheet_to_json(sheet, options)
        // eslint-disable-next-line no-unused-vars
        .filter(row => Object.entries(row).some(([k, v]) => v)); // remove empties
    },
    sheetToHot(sheet, settings = {}) {
      return this.toHot(this.sheetToJson(sheet), settings);
    },

    handleUpload() {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // store for processing
        this.$set(this, 'workbook', workbook);

        // move to next step
        this.step = 'choose';

        // auto-pick default sheets
        this.dancersSheetIndex = workbook.SheetNames.findIndex(name => /Delimited/i.test(name));
        this.groupsSheetIndex = workbook.SheetNames.findIndex(name => /Program/i.test(name));
      };
      reader.readAsBinaryString(this.file);
    },
    handleChoose() {
      const dancersSheet = this.workbook.Sheets[this.workbook.SheetNames[this.dancersSheetIndex]];
      const groupsSheet = this.workbook.Sheets[this.workbook.SheetNames[this.groupsSheetIndex]];

      // store for reviewing
      this.$set(this, 'data', this.parseSpreadsheet(dancersSheet, groupsSheet));

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

    parseSpreadsheet(dancersSheet, groupsSheet) {
      const dancersData = this.sheetToJson(dancersSheet, {
        header: [
          'number',
          'firstName',
          'lastName',
          'age',
          'category',
          'location',
          'group',
        ],
      });
      const dancers = dancersData
        .slice(1); // remove header row

      const categories = dancers
        .map(datum => datum.category)
        .filter((v, i, a) => a.indexOf(v) === i); // only keep uniques


      const groupsData = this.sheetToJson(groupsSheet, {
        header: [
          'number',
          'firstName',
          'lastName',
          'location',
        ],
      });

      const groups = {};
      let currentGroup;
      groupsData.forEach((datum) => {
        if (!datum.number) return; // skip blanks
        if (!/^\d+$/.test(datum.number)) {
          // group title
          currentGroup = Object.keys(groups).length + 1;

          const title = (datum.number || '').trim();
          const name = title.replace(new RegExp(categories.join('|')), '').trim();
          const category = title.replace(name, '').trim();
          groups[currentGroup] = {
            number: currentGroup,
            name,
            category,
            // dancers: [],
          };
        } else {
          // dancer
          // groups[currentGroup].dancers.push(datum);
          // NB: these don't actually get used, so just ignore them
        }
      });

      // return all items normalized to arrays
      return {
        categories: categories.map(category => ({ name: category })),
        groups: Object.values(groups),
        dancers,
      };
    },
    async importData(categories, groups, dancers) {
      const categoryMappings = await Promise.all(categories.map(async (categoryData) => {
        const category = {
          name: categoryData.name,
        };

        // add to db
        const ref = await this.competitionDataRef.child('categories').push(category);

        // pass through
        return {
          [idKey]: ref.key,
          ...category,
        };
      }));

      const groupMappings = await Promise.all(groups.map(async (groupData) => {
        const categoryId = categoryMappings.find((category) => {
          return `${category.name}` === `${groupData.category}`;
        });
        const group = {
          name: groupData.name,
          categoryId: (categoryId && categoryId[idKey]) || null,
        };

        // add to db
        const ref = await this.competitionDataRef.child('groups').push(group);

        // pass through
        return {
          [idKey]: ref.key,
          number: groupData.number,
          ...group,
        };
      }));

      await Promise.all(dancers.map(async (dancerData) => {
        const groupId = groupMappings.find((group) => {
          return `${group.number}` === `${dancerData.group}`;
        });
        const dancer = {
          number: dancerData.number,
          firstName: dancerData.firstName,
          lastName: dancerData.lastName,
          location: dancerData.location,
          groupId: (groupId && groupId[idKey]) || null,
          categoryId: (groupId && groupId.categoryId) || null,
        };

        // add to db
        await this.competitionDataRef.child('dancers').push(dancer);
      }));

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
}
</style>
