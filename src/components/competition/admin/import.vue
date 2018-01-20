<template>
  <div class="competition-admin-import md-scroll-frame">
    <div class="md-scroll-frame">
      <form style="padding: 12px 16px;">
        <md-field>
          <label>Spreadsheet</label>
          <md-file
            @md-change="handleUpload($event)"
            accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />
        </md-field>
      </form>
      <md-tabs v-if="workbook" class="md-scroll-frame">
        <md-tab
          v-for="(sheetName, sheetIndex) of workbook.SheetNames"
          :key="sheetIndex"
          :md-label="sheetName"
        >
          <hot-table :options="sheetToHot(workbook.Sheets[sheetName])" />
          <!--<div class="md-scroll-frame md-scroll">
            <pre>{{sheetToJson(workbook.Sheets[sheetName])}}</pre>
          </div>-->
        </md-tab>
      </md-tabs>
    </div>
  </div>
</template>

<script>
import XLSX from 'js-xlsx';
import HotTable from '@/components/hot-table';
// import HotTable from 'vue-handsontable-official';
// need to manually comment out line in `node_modules/vue-handsontable-official/src/HotTable.vue`

// import {
//   idKey,
// } from '@/helpers/firebase';

export default {
  name: 'competition-admin-import',
  // props: {
  //   competitionRef: {
  //     type: Object,
  //     required: true,
  //   },
  // },
  data() {
    return {
      // idKey,
      workbook: undefined,
    };
  },
  methods: {
    sheetToJson(sheet, options = { header: 1 }) {
      return XLSX.utils.sheet_to_json(sheet, options);
    },
    sheetToHot(sheet) {
      return {
        data: this.sheetToJson(sheet),
        rowHeaders: true,
        colHeaders: true,
        stretchH: 'all',
      };
    },
    parseSpreadsheet(dancersSheet, groupsSheet) {
      // console.log(workbook);
      const dancersData = this.sheetToJson(dancersSheet, {
        header: [
          'number',
          'firstName',
          'lastName',
          'age',
          'level',
          'location',
          'group',
        ],
      });
      const dancers = dancersData.slice(1); // remove header row
      console.log(dancers);

      const levels = dancersData
        .map(datum => datum.level)
        .filter((v, i, a) => a.indexOf(v) === i);
      console.log(levels);


      const groupsData = this.sheetToJson(groupsSheet, {
        header: [
          'number',
          'firstName',
          'lastName',
          'location',
        ],
      });
      // console.log(groupsData);

      const groups = {};
      let currentGroup;
      groupsData.forEach((datum) => {
        if (!datum.number) return; // skip blanks
        if (!/^\d+$/.test(datum.number)) {
          // group title
          currentGroup = Object.keys(groups).length + 1;

          const title = (datum.number || '').trim();
          const range = title.replace(new RegExp(levels.join('|')), '').trim();
          const level = title.replace(range, '').trim();
          groups[currentGroup] = {
            level,
            range,
            dancers: [],
          };
        } else {
          // dancer
          groups[currentGroup].dancers.push(datum);
        }
      });
      console.log(groups);

      return {
        levels,
        groups,
        dancers,
      };
    },
    handleUpload(fileList) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        this.workbook = workbook;

        const dancersSheet = workbook.Sheets[workbook.SheetNames[0]];
        const groupsSheet = workbook.Sheets[workbook.SheetNames[3]];
        this.parseSpreadsheet(dancersSheet, groupsSheet);
      };
      reader.readAsBinaryString(fileList[0]);
    },
  },
  components: {
    HotTable,
  },
};
</script>

<style lang="scss">
.competition-admin-import {
  .md-tabs-navigation {
    flex-shrink: 0;
  }
  .md-tabs-content,
  .md-tabs-container,
  .md-tab {
    height: 100% !important;
  }
  .md-tab {
    padding: 0;
  }

}
</style>
