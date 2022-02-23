<template>
  <Blades class="CompetitionAdminPrint app-scroll-frame">
    <Blade class="col-md-4">
      Controls
    </Blade>
    <Blade class="col-md-8">
      <v-toolbar dense class="print-hide">
        <v-btn class="mr-2" @click="handleExportDocx()">
          <v-icon class="mr-3">mdi-file-word</v-icon>
          Export for Word
        </v-btn>
        <v-btn v-on="on" class="mr-2" @click="handleExportGoogleDoc()">
          <v-icon class="mr-3">mdi-google-drive</v-icon>
          Export for Google Docs
        </v-btn>
        <!-- Open/Upload the generated <code>.html</code> file in Google Docs -->
        <!--<v-btn class="mr-2" @click="handlePrint()">
          <v-icon class="mr-3">mdi-printer</v-icon>
          Print
        </v-btn>-->
      </v-toolbar>

      <div class="app-scroll">
        <section ref="info">
          <img v-if="competition.image" :src="competition.image" class="md-4" />
          <h1 class="display-1 mb-4">{{ competition.name }}</h1>
          <h2 v-if="competition.date" class="mb-4">
            {{ $moment(competition.date).format('dddd, MMMM D, YYYY') }}
          </h2>
          <h4 class="mb-4">
            <div v-if="competition.venue">{{ competition.venue }}</div>
            <div v-if="competition.address">{{ competition.address }}</div>
            <div>{{ competition.location }}</div>
          </h4>

          <div v-if="competition.description" v-html="competition.description" class="mb-4 pre-line" />
          <div v-if="competition.sobhd" class="mb-4">
            <small>{{ competition.sobhd }}</small>
          </div>

          <article
            v-for="(group, name) in groupedStaff"
            :key="name"
            class="mb-4"
          >
            <header>
              <h4>{{ name }}s</h4>
            </header>

            <div v-for="member in group" :key="member[idKey]">
              {{ member.$name }}<template v-if="member.location">, {{ member.location}}</template>
            </div>
          </article>
          <hr class="pb" />
        </section>

        <CompetitionAdminPrintSchedule ref="schedule" />
        <CompetitionAdminPrintResults ref="results" />
      </div>
    </Blade>
  </Blades>
</template>

<script>
import groupBy from 'lodash.groupby';
// import HTMLtoDOCX from 'html-to-docx';
// import { firebase } from '@/helpers/firebase';
import CompetitionAdminPrintSchedule from '@/views/competition/admin/print/Schedule.vue';
import CompetitionAdminPrintResults from '@/views/competition/admin/print/Results.vue';

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
    CompetitionAdminPrintSchedule,
    CompetitionAdminPrintResults,
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
