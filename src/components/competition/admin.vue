<template>
  <div class="competition-admin md-scroll-frame">
    <div class="md-scroll-frame">
      <md-toolbar class="md-dense">
        <div v-if="inTabs('info', 'levels', 'dancers', 'groups')">
          <md-button @click="showImport = true">Import</md-button>
        </div>

        <div v-if="inTabs('dances')">
          <md-button @click="addStandardDances()">Add Standard Dances</md-button>
        </div>

        <span style="flex-grow: 1;"></span>

        <!--<md-button class="md-accent md-raised">Save</md-button>-->
      </md-toolbar>
      <div
        v-for="section of sections"
        :key="section[idKey]"
        v-show="inTabs(section[idKey])"
        class="md-scroll-frame"
      >

        <div class="md-scroll">
          <form v-if="section.form" class="md-padding">
            <md-field v-for="field in section.form.fields" :key="field.data">
              <label>{{ field.title }}</label>
              <md-input
                v-model="competition[field.data]"
                @change="handleFormInputChange(section[idKey], field.data, $event.target.value)"
                :required="field.required"
              />
            </md-field>
          </form>

          <hot-table v-else-if="section.hot" :settings="section.hot" class="fullscreen" />

          <div v-else-if="section[idKey] === 'schedule'">
            <md-table>
              <md-table-row>
                <md-table-head>&nbsp;</md-table-head>
                <md-table-head v-for="platform of platforms" :key="platform[idKey]">
                  Platform {{ platform.name }}
                </md-table-head>
              </md-table-row>
              <md-table-row v-for="dance of dances" :key="dance[idKey]">
                <md-table-cell>
                  {{ dance.name }}
                </md-table-cell>
                <md-table-cell v-for="platform of platforms" :key="platform[idKey]">
                  <div
                    v-for="group of groups"
                    :key="group[idKey]"
                    v-show="dance.levelIds
                      && dance.levelIds[group.levelId]
                      && group.platformId === platform[idKey]"
                  >
                    {{group.$name}}
                  </div>
                </md-table-cell>
              </md-table-row>
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
                    <md-field>
                      <md-input
                        type="number"
                        v-model="scores.test"
                        min="0"
                        max="100"
                        @change="saveScore(group[idKey], dance[idKey], dancer[idKey], $event)"
                      />
                    </md-field>
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

    <md-bottom-bar :md-active-item="`tab-${$router.currentRoute.params.tab || 'info'}`">
      <md-bottom-bar-item
        v-for="section of sections"
        :key="section[idKey]"
        @click="$router.push({ name: 'competition.admin', params: { tab: section[idKey] } })"
        :id="`tab-${section[idKey]}`"
      >
        <md-icon :class="section.icon"></md-icon>
        <span class="md-bottom-bar-label">{{ section.name }}</span>
      </md-bottom-bar-item>
    </md-bottom-bar>

    <md-dialog :md-active.sync="showImport" style="width: 100%; height: 100%;">
      <admin-import :competition-data-ref="competitionDataRef" @done="showImport = false" />
    </md-dialog>
  </div>
</template>

<script>
import HotTable from '@/lib/vue-handsontable/HotTable';
import AdminImport from '@/components/competition/admin/import';
import {
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  name: 'competition-admin',
  props: {
    competitionRef: {
      type: Object,
      required: true,
    },
    competitionDataRef: {
      type: Object,
      required: true,
    },
    competition: Object,
    dancers: Array,
    groups: Array,
    levels: Array,
    favorites: Array,
    dances: Array,
    platforms: Array,
  },
  data() {
    return {
      idKey,

      scores: {},

      showImport: false,
    };
  },
  firebase() {
    return {
      sectionsRaw: db.child('sections'),
    };
  },
  computed: {
    sections() {
      return this.sectionsRaw
        .map((sectionData) => {
          const section = {
            ...sectionData,
          };
          const data = this[section[idKey]];

          if (section.hot) {
            section.hot = {
              contextMenu: [
                'remove_row',
              ],
              colHeaders: true,
              rowHeaders: true,
              stretchH: 'all',

              ...section.hot,

              data,
            };
            if (section[idKey] === 'dances') {
              section.hot.columns = section.hot.columns.concat(this.groups
                .filter(group => group[idKey]) // remove extra/blank row
                .map(group => ({
                  data: `groupIds.${group[idKey]}`,
                  title: group.$name,
                  type: 'checkbox',
                  uncheckedTemplate: null,
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
    inTabs(...tabs) {
      return tabs.some(tab => (this.$route.params.tab || 'info') === tab);
    },

    addStandardDances() {
      const standardDances = [
        {
          name: 'Pas de basques',
          shortName: 'PDB',
        },
        {
          name: 'Pas de basques & High Cuts',
          shortName: 'PDBHC',
        },
        {
          name: 'Highland Fling',
          shortName: 'Fling',
        },
        {
          name: 'Sword Dance',
          shortName: 'Sword',
        },
        {
          name: 'Seann Truibhas',
          shortName: 'ST',
        },
        {
          name: 'Scottish Lilt',
          shortName: 'Lilt',
        },
      ];

      // append
      // @TODO: make this local-only until save
      return Promise.all(standardDances.map((dance) => {
        return this.$firebaseRefs.dances.push(dance);
      }));
    },

    handleFormInputChange(section, field, value) {
      const collection = section === 'info' ? 'competition' : section;

      // save
      this.$firebaseRefs[collection]
        .child(field)
        .set(value);
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
    AdminImport,
  },
};
</script>

<style lang="scss">
.competition-admin {
  .md-table-cell {
    vertical-align: top;
  }
  .handsontable {
    z-index: 90; // keep below sidebar, backdrop, modals

    &.fullscreen {
      height: 100%;
    }
  }
}
</style>
