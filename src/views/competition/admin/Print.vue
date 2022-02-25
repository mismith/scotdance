<template>
  <Blades class="CompetitionAdminPrint app-scroll-frame">
    <Blade class="col-md-3">
      <v-subheader>Settings</v-subheader>

      <v-subheader>Schedule</v-subheader>
      <div class="px-4">
        <v-switch v-model="isEventInfoInTableHeaders" label="Event info in table headers" />
      </div>

      <v-subheader>Export</v-subheader>
      <div class="px-4">
        <v-btn class="mr-2" @click="handleExportDocx()">
          <v-icon class="mr-3">{{ mdiFileWord }}</v-icon>
          Export for Word
        </v-btn>
        <v-btn v-on="on" class="mr-2" @click="handleExportGoogleDoc()">
          <v-icon class="mr-3"> {{ mdiGoogleDrive }}</v-icon>
          Export for Docs
        </v-btn>
        <!-- Open/Upload the generated <code>.html</code> file in Google Docs -->
        <!--<v-btn class="mr-2" @click="handlePrint()">
          <v-icon class="mr-3">mdi-printer</v-icon>
          Print
        </v-btn>-->
      </div>
    </Blade>
    <Blade class="col-md-9">
      <v-sheet light class="app-scroll-frame app-scroll">
        <PrintInfo
          ref="info"
        />
        <PrintSchedule
          ref="schedule"
          :event-info-in-table-headers="isEventInfoInTableHeaders"
        />
        <PrintResults
          ref="results"
        />
      </v-sheet>
    </Blade>
  </Blades>
</template>

<script>
import groupBy from 'lodash.groupby';
import {
  mdiFileWord,
  mdiGoogleDrive,
} from '@mdi/js';
// import HTMLtoDOCX from 'html-to-docx';
// import { firebase } from '@/helpers/firebase';
import PrintInfo from '@/components/print/Info.vue';
import PrintSchedule from '@/components/print/Schedule.vue';
import PrintResults from '@/components/print/Results.vue';

export default {
  name: 'CompetitionAdminPrint',
  reactiveInject: {
    competitionBundle: [
      'competition',
      'dancers',
      'groups',
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
      mdiFileWord,
      mdiGoogleDrive,

      isEventInfoInTableHeaders: false,
    };
  },
  computed: {
    groupedStaff() {
      return groupBy(this.staff.filter((member) => member.type), 'type');
    },
  },
  methods: {
    generateHtmlForExport() {
      const body = ['info', 'schedule', 'results']
        .map((section) => (this.$refs[section].$el || this.$refs[section]).innerHTML)
        .join('');
      const html = `<html><body>${body}</body></html>`;
      return html;
    },
    forceDownload(blob, ext = 'html') {
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.download = `${this.competition.name}.${ext}`;
      a.click();

      window.URL.revokeObjectURL(url);
      a.remove();
    },
    async handleExportDocx() {
      const html = this.generateHtmlForExport();
      console.log(html);
      const docx = html.toString();
      // const docx = await HTMLtoDOCX(html);
      console.log(docx);
      return this.forceDownload(docx, 'docx');
    },
    async handleExportGoogleDoc() {
      const html = this.generateHtmlForExport();
      return this.forceDownload(new Blob([html]));

      // const provider = new firebase.auth.GoogleAuthProvider();
      // provider.addScope('https://www.googleapis.com/auth/drive.file');
      // const result = await firebase.auth().signInWithRedirect(provider);
      // console.log(result);
    },
    // handlePrint() {
    //   window.print();
    // },
  },
  components: {
    PrintInfo,
    PrintSchedule,
    PrintResults,
  },
};
</script>

<style lang="scss">
.CompetitionAdminPrint {
  section {
    padding: 0.25in;
  }
  table {
    margin: 0.125in 0;
    page-break-inside: avoid;

    th,
    td {
      padding: 0 5px;
      white-space: nowrap;

      .slash-separated {
        &:not(:first-child) {
          &::before {
            content: ' / ';
          }
        }
      }

      &:empty {
        width: 0.75in;
      }
    }
  }
  hr.pb {
    // adds page breaks in google docs, but visually hide them in app
    height: 0;
    border: 0;
    page-break-after: always;
  }
}
</style>
