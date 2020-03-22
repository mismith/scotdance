<template>
  <Blades class="Dancers app-scroll-frame app-scroll">
    <Blade class="col-md-4 app-scroll-frame">
      <template v-if="loaded && dancerProfiles.length">
        <v-toolbar class="flex-none">
          <SearchField v-model="filterBy" />
        </v-toolbar>

        <PaginatedList v-if="loaded" :items="dancerProfiles">
          <v-list-item
            slot-scope="dancerProfile"
            :to="{ name: $route.name, params: { dancerSlug: dancerProfile[0] } }"
            :class="{ active: dancerSlug === dancerProfile[0] }"
          >
            <v-list-item-avatar>
              <v-avatar :color="dancerProfile[1].some(d => d.$favorite) ? 'secondary' : 'primary'">
                {{ initialify(dancerProfile[1][0].$name) }}
              </v-avatar>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>{{ dancerProfile[1][0].$name }}</v-list-item-title>
            </v-list-item-content>
            <v-icon>mdi-chevron-right</v-icon>
          </v-list-item>
        </PaginatedList>
      </template>
      <EmptyState
        v-else-if="loaded"
        icon="mdi-close"
        label="No dancers found"
      />
      <div v-else class="app-scroll-frame">
        <Spinner />
      </div>
    </Blade>
    <Blade class="col-md-8 app-scroll">
      <v-list v-if="currentDancerProfile" expand class="grouped">
        <v-list-group
          v-for="group in currentDancerProfileGroups"
          :key="group[idKey]"
          :value="true"
        >
          <template #activator>
            <v-subheader>{{ group.competition && group.competition.name }}</v-subheader>
          </template>

          <v-list two-line>
            <DancerListItem
              v-for="dancer in group.dancers"
              :key="dancer[idKey]"
              :dancer="dancer"
              :to="{ name: 'competition.dancers', params: { competitionId: group.competition[idKey], dancerId: dancer[idKey] } }"
            />
          </v-list>
        </v-list-group>
      </v-list>
    </Blade>
  </Blades>
</template>

<script>
import orderBy from 'lodash.orderby';
import groupBy from 'lodash.groupby';
import { idKey, toOrderedArray } from '@/helpers/firebase';
import {
  findByIdKey,
  searchByKeys,
  groupExtender,
  dancerExtender,
  slugify,
  initialify,
} from '@/helpers/competition';
import PaginatedList from '@/components/admin/PaginatedList.vue';
import SearchField from '@/components/SearchField.vue';
import DancerListItem from '@/components/DancerListItem.vue';

export default {
  name: 'Dancers',
  props: {
    competitions: Array,
    competitionsDataRef: Object,
    dancerSlug: String,
  },
  data() {
    return {
      idKey,

      filterBy: undefined,

      competitionData: {
        categories: {},
        groups: {},
        dancers: {},
      },
      competitionDataLoaded: {
        categories: false,
        groups: false,
        dancers: false,
      },
    };
  },
  computed: {
    loaded() {
      return Object.values(this.competitionDataLoaded).every(Boolean);
    },

    currentDancerProfile() {
      if (this.dancerSlug) {
        return this.dancerProfiles.find(([slug]) => slug === this.dancerSlug);
      }
      return null;
    },
    currentDancerProfileGroups() {
      if (this.currentDancerProfile) {
        const grouped = groupBy(this.currentDancerProfile[1], (dancer) => dancer.$competitionId);
        const currentDancerProfileGroups = Object.entries(grouped)
          .reduce((acc, [competitionId, dancers]) => {
            return acc.concat({
              [idKey]: competitionId,
              competition: findByIdKey(this.competitions, competitionId),
              dancers,
            });
          }, []);
        return orderBy(
          currentDancerProfileGroups,
          [
            ['competition', 'date'],
            ['competition', idKey],
          ],
          ['desc'],
        );
      }
      return [];
    },

    categories() {
      return this.extendCompetitionData('categories');
    },
    groups() {
      return this.extendCompetitionData(
        'groups',
        (group, i) => groupExtender(group, i, this.categories),
      );
    },
    dancers() {
      return this.extendCompetitionData(
        'dancers',
        (dancer) => dancerExtender(dancer, this.groups, this.$store),
      );
    },
    dancerProfiles() {
      const dancerProfiles = this.dancers.reduce((acc, dancer) => {
        const slug = slugify(dancer.$name);
        acc[slug] = acc[slug] || [];
        acc[slug].push(dancer);
        return acc;
      }, {});

      let filtered = Object.entries(dancerProfiles);

      const searchKeys = ['$name', 'location'];
      filtered = searchByKeys(filtered, this.filterBy, searchKeys.map((k) => `1.${k}`));

      return orderBy(filtered, [0]);
    },
  },
  methods: {
    initialify,

    extendCompetitionData(key, extenderFn = (v) => v) {
      return Object.entries(this.competitionData[key]).reduce((acc, [competitionId, items]) => {
        return acc.concat(toOrderedArray(items).map((item, i) => ({
          ...extenderFn(item, i),
          $competitionId: competitionId,
        })));
      }, []);
    },
    loadDancers() {
      this.competitions.forEach(({ [idKey]: competitionId }) => {
        const competitionDataRef = this.competitionsDataRef.child(competitionId);
        Object.keys(this.competitionData).forEach((key) => {
          competitionDataRef.child(key).on('value', (snap) => {
            this.$set(this.competitionData[key], competitionId, snap.val());
            this.competitionDataLoaded[key] = true;
          });
        });
      });
    },
  },
  created() {
    this.loadDancers();
  },
  components: {
    PaginatedList,
    SearchField,
    DancerListItem,
  },
};
</script>
