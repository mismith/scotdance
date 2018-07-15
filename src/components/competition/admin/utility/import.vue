<template>
  <md-steppers :md-active-step.sync="step" md-linear class="admin-import">
    <md-step id="upload" md-label="Upload" md-description="Select a file to import">
      <div class="md-scroll-frame md-scroll md-padding">
        <h2>Instructions</h2>
        <ol>
          <li>Select the <strong>Excel spreadsheet</strong> (.xslx file) that contains the exported values to import.</li>
          <li>Determine which sheet contains the list of dancers with age grouping headers; select it below, then click <strong>Next</strong>.</li>
          <li>Double-check that all values were parsed properly&mdash;this is how data will be imported, so if anything is missing or looks broken, it will likely fail to import properly. When sure, click <strong>Import</strong>.</li>
        </ol>
      </div>
      <md-toolbar class="md-layout">
        <md-field class="md-layout-item">
          <label>Spreadsheet file</label>
          <md-file
            @md-change="handleUpload($event[0])"
            accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />
        </md-field>
      </md-toolbar>
    </md-step>
    <md-step id="choose" md-label="Choose" md-description="Pick which data to use">
      <md-tabs v-if="workbook">
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
        <footer>
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
        <div class="md-layout-item" />
        <footer>
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
import {
  idKey,
} from '@/helpers/firebase';
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
      return augmentHot({
        colHeaders: Object.keys(data[0]),
      }, data);
    },
    sheetToJson(sheet, options = { header: 1 }) {
      return XLSX.utils.sheet_to_json(sheet, options)
        // eslint-disable-next-line no-unused-vars
        .filter(row => Object.entries(row).some(([k, v]) => v)); // remove empties
    },
    sheetToHot(sheet, settings = {}) {
      return augmentHot(settings, this.sheetToJson(sheet));
    },

    handleUpload(file) {
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
        categories: categories.map(category => ({ name: category })),
        groups: Object.values(groups),
        dancers,
      };
    },
    async importData(categories, groups, dancers) {
      this.importing = true;
      await this.$nextTick();

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
          code: groupData.code,
          ...group,
        };
      }));

      await Promise.all(dancers.map(async (dancerData) => {
        const groupId = groupMappings.find((group) => {
          return `${group.code}` === `${dancerData.code}`;
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
      this.importing = false;
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
