<template>
  <div class="competition-admin md-scroll-frame">
    <div class="md-scroll-frame">
      <div
        v-for="section of sections"
        :key="section[idKey]"
        v-show="getActiveTab(section[idKey])"
        class="md-scroll-frame"
      >
        <md-toolbar class="md-dense">
          <span style="flex-grow: 1;"></span>

          <md-menu md-direction="bottom left">
            <md-button md-menu-trigger class="md-icon-button">
              <md-icon>more_vert</md-icon>
            </md-button>
            <md-menu-content>
              <md-menu-item @selected="autofillPlatforms()">Autofill Platforms</md-menu-item>
            </md-menu-content>
          </md-menu>
          <!--<md-button class="md-accent md-raised">Save</md-button>-->
        </md-toolbar>

        <div class="md-scroll">
          <form v-if="section.form" style="padding: 12px 16px;">
            <md-input-container v-for="field in section.form.fields" :key="field.data">
              <label>{{ field.title }}</label>
              <md-input v-model="competition[field.data]" required />
            </md-input-container>
          </form>

          <hot-table v-else-if="section.hot" :settings="section.hot" />

          <div v-else-if="section[idKey] === 'schedule'">
            <md-table>
              <md-table-header>
                <md-table-row>
                  <md-table-head>&nbsp;</md-table-head>
                  <md-table-head v-for="platform of platforms" :key="platform[idKey]">
                    Platform {{ platform.name }}
                  </md-table-head>
                </md-table-row>
              </md-table-header>
              <md-table-body>
                <md-table-row v-for="dance of dances" :key="dance[idKey]">
                  <md-table-cell>
                    {{ dance.name }}
                  </md-table-cell>
                  <md-table-cell v-for="platform of platforms" :key="platform[idKey]">
                    <div v-for="group of groups" v-show="dance.levelIds && dance.levelIds[group.levelId] && group.platformId === platform[idKey]">
                      {{ getGroupName(group) }}
                    </div>
                  </md-table-cell>
                </md-table-row>
              </md-table-body>
            </md-table>
          </div>

          <!--<div v-else-if="section[idKey] === 'scores'">
            <div v-for="group of groups" :key="group[idKey]">
              <md-subheader>{{ getGroupName(group) }}</md-subheader>
              <md-list>
                <md-list-item v-for="dance of getGroupDances(group)" :key="dance[idKey]">
                  {{ dance.name }}
                </md-list-item>
              </md-list>
            </div>
            <!- -<md-table v-for="group of groups">
              <md-table-header>
                <md-table-row>
                  <md-table-head>{{ getGroupName(group) }}</md-table-head>
                  <md-table-head>
                    {{ dance.name }}
                  </md-table-head>
                </md-table-row>
              </md-table-header>
              <md-table-body>
                <md-table-row v-for="dancer of getGroupDancers(group)" :key="dancer[idKey]">
                  <md-table-cell>
                    {{ dancer.number }}
                  </md-table-cell>
                  <md-table-cell v-for="dance of getGroupDances(group)" :key="dance[idKey]">
                    <md-input-container>
                      <md-input type="number" v-model="scores.test" min="0" max="100" @change="saveScore(group[idKey], dance[idKey], dancer[idKey], $event)" />
                    </md-input-container>
                  </md-table-cell>
                </md-table-row>
              </md-table-body>
            </md-table>- ->
          </div>-->

          <md-subheader v-else>
            TBD
          </md-subheader>
        </div>
      </div>
    </div>
    <md-bottom-bar>
      <md-bottom-bar-item
        v-for="section of sections"
        :key="section[idKey]"
        :md-iconset="section.icon"
        @click="$router.push({ name: 'competition.admin', params: { tab: section[idKey] } })"
        :md-active="getActiveTab(section[idKey])"
      >
        {{ section.name }}
      </md-bottom-bar-item>
    </md-bottom-bar>
  </div>
</template>

<script>
import HotTable from 'vue-handsontable-official';
import DancersGroupsFavoritesMixin from '@/mixins/dancers-groups-favorites';
import {
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  name: 'competition-admin',
  mixins: [
    DancersGroupsFavoritesMixin,
  ],
  props: {
    competitionRef: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      idKey,

      scores: {},
    };
  },
  firebase() {
    return {
      competition: {
        source: this.competitionRef,
        asObject: true,
      },
      sectionsRaw: db.child('sections'),

      levels: this.competitionDataRef.child('levels'),
      dances: this.competitionDataRef.child('dances'),
      staff: this.competitionDataRef.child('staff'),
      platforms: this.competitionDataRef.child('platforms'),

      // from DancersGroupsFavoritesMixin
      dancersRaw: this.competitionDataRef.child('dancers'),
      groupsRaw: this.competitionDataRef.child('groups'),
      favorites: this.userFavoritesRef.child('dancers'),
    };
  },
  computed: {
    sections() {
      return this.sectionsRaw
        .map((s) => {
          const section = {
            ...s,
          };

          if (section.hot) {
            section.hot = {
              contextMenu: [
                'remove_row',
                '---------',
                'undo',
              ],
              minSpareRows: 1,
              colHeaders: true,
              rowHeaders: true,
              stretchH: 'all',
              undo: true,

              ...section.hot,

              data: this[section[idKey]],
            };
            if (section[idKey] === 'dances') {
              section.hot.columns = section.hot.columns.concat(this.levels.map(level => ({
                data: `levelIds.${level[idKey]}`,
                title: level.name,
                type: 'checkbox',
                uncheckedTemplate: '',
              })));
            }
            section.hot.columns = section.hot.columns.map((column) => {
              if (column.data === 'levelId') {
                // eslint-disable-next-line no-param-reassign
                column.source = this.levels.map(l => l.name);
              }
              if (column.data === 'platformId') {
                // eslint-disable-next-line no-param-reassign
                column.source = this.platforms.map(p => p.name);
              }
              return column;
            });
          }
          return section;
        });
    },
  },
  methods: {
    getActiveTab(tabId) {
      return (this.$route.params.tab === tabId) || (!this.$route.params.tab && tabId === 'info');
    },

    autofillPlatforms() {
      const platformIds = this.platforms.map(p => p[idKey]).filter(pId => pId);
      this.groups.filter(g => g[idKey]).forEach((group, index) => {
        this.$firebaseRefs.groupsRaw.child(group[idKey]).child('platformId').set(platformIds[index % platformIds.length]);
      });
    },

    // getGroupDances(group) {
    //   return this.dances.filter(d => d.levelIds[group.levelId]);
    // },
    // saveScore(groupId, danceId, dancerId, score) {
    //   console.log(groupId, danceId, dancerId, score);
    // },
  },
  components: {
    HotTable,
  },
};
</script>

<style lang="scss">
.competition-admin {
  .md-table-cell {
    vertical-align: top;
  }
  .handsontable {
    height: 100%;
    z-index: 90; // keep below sidebar, backdrop, modals
  }
}
</style>
