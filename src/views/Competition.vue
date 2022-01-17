<template>
  <div
    class="Competition app-scroll-frame"
    :class="{
      listed: competition.listed,
      published: competition.published,
      'is-competition-admin': isCompetitionAdmin,
    }"
  >
    <div v-if="loaded" class="app-scroll-frame">
      <div v-if="competitionExists || (isAdmin && isAdminRoute)" class="app-scroll-frame">
        <router-view v-if="hasPermission" v-test="'competition:access-state:full'" />
        <div v-else class="app-scroll-frame alt">
          <EmptyState
            :icon="mdiClockOutline"
            label="Not available yet"
            description="Check back closer to the competition date:"
            v-test="'competition:access-state:publicOnly'"
          >
            <div class="title">
              {{ competition.date ? $moment(competition.date).format('dddd, MMMM D') : 'Soon' }}
            </div>
          </EmptyState>
        </div>

        <v-bottom-navigation
          v-if="!isAdminRoute && !isSecretRoute"
          v-model="$root.currentTab"
          class="listed-only"
        >
          <v-btn
            v-for="section in sections"
            :key="section[idKey]"
            :value="section[idKey]"
            :to="getTabRoute(section[idKey])"
            color="primary"
            text
            :class="section.className"
          >
            <span>{{ section.name }}</span>
            <v-badge v-model="sectionBadges[section[idKey]]" dot color="secondary" offset-x="-2" offset-y="6">
              <v-icon :class="section.icon"></v-icon>
            </v-badge>
          </v-btn>
        </v-bottom-navigation>
      </div>
      <div v-else class="app-scroll-frame alt">
        <EmptyState
          :icon="mdiClose"
          label="No competition found"
          v-test="'competition:access-state:notFound'"
        />
      </div>
    </div>
    <div v-else class="app-scroll-frame alt">
      <Spinner />
    </div>

    <DialogCard v-model="staffVisible">
      <template #title>
        <v-card-title v-if="currentDialogData" class="d-flex flex-wrap">
          <v-avatar v-if="currentDialogData.image" :size="100" color="white" class="mr-4">
            <img :src="currentDialogData.image" alt="" />
          </v-avatar>
          <div class="flex">
            <div class="title my-4">{{ currentDialogData.$name }}</div>
            <div class="subtitle-1">{{ currentDialogData.location }}</div>
            <div v-if="currentDialogData.website" class="subtitle-1">
              <a :href="formatExternalURL(currentDialogData.website)" target="_blank" class="ext">
                {{ formatHumanURL(currentDialogData.website) }}
              </a>
            </div>
          </div>
        </v-card-title>
      </template>
      <template #text>
        <v-card-text
          v-if="currentDialogData && currentDialogData.description"
          v-html="$sanitize(currentDialogData.description)"
          class="pre-line alt pt-3"
        />
      </template>
    </DialogCard>
  </div>
</template>

<script>
import {
  mapState,
  mapMutations,
} from 'vuex';
import {
  mdiClockOutline,
  mdiClose,
} from '@mdi/js';
import {
  formatExternalURL,
  formatHumanURL,
  mapRouteParams,
} from '@/helpers/router';
import {
  sortByKey,
  groupExtender,
  danceExtender,
  dancerExtender,
  isNotEmptyObject,
} from '@/helpers/competition';
import {
  idKey,
  valueKey,
  toOrderedArray,
} from '@/helpers/firebase';
import {
  isTabDisabled,
} from '@/helpers/tab';
import competitionSchema from '@/schemas/competition';

export default {
  name: 'Competition',
  reactiveProvide: {
    name: 'competitionBundle',
    include: [
      'competitionId',
      'competition',
      'competitionRef',
      'competitionDataRef',
      'dancers',
      'groups',
      'categories',
      'dances',
      'staff',
      'platforms',
      'draws',
      'schedule',
      'results',
      'favoriteDancerSuggestions',
    ],
  },
  reactiveInject: {
    competitionsBundle: [
      'competitionsRef',
      'competitionsDataRef',
    ],
  },
  data() {
    return {
      idKey,
      mdiClockOutline,
      mdiClose,

      competitionRef: undefined,
      competitionDataRef: undefined,

      loaded: false,
    };
  },
  computed: {
    ...mapState([
      'me',
      'currentDialog',
      'currentDialogData',
    ]),
    ...mapRouteParams([
      'competitionId',
    ]),

    staffVisible: {
      get() {
        return this.currentDialog === 'staff';
      },
      set(value) {
        return this.setCurrentDialog(value && 'staff');
      },
    },

    isAdmin() {
      return this.$store.getters.hasPermission('admin');
    },
    isCompetitionAdmin() {
      return this.$store.getters.hasPermission(`competitions/${this.competitionId}`);
    },
    hasPermission() {
      return this.isCompetitionAdmin
        || this.competition.published
        || this.isSecretRoute
        || this.isPublicRoute;
    },
    isPublicRoute() {
      return this.$route.name === 'competition.info';
    },
    isSecretRoute() {
      return this.$route.name === 'competition.invite';
    },
    isAdminRoute() {
      return this.$route.name.includes('.admin.');
    },
    competitionExists() {
      if (!this.isSecretRoute) {
        if (this.competition[valueKey] !== undefined) return false;
        if (!this.isCompetitionAdmin && !this.competition.listed) return false;
      }
      return true;
    },

    sections() {
      return toOrderedArray(competitionSchema)
        .filter((section) => !isTabDisabled(this[section[idKey]]));
    },

    competition() {
      return this.competitionRaw;
    },
    dancers() {
      return this.dancersRaw
        .map((dancer) => dancerExtender(dancer, this.groups, this.$store))
        .filter(isNotEmptyObject)
        .sort(sortByKey('$number')); // sort by number
    },
    groups() {
      return this.groupsRaw
        .map((group, i) => groupExtender(group, i, this.categories))
        .filter(isNotEmptyObject);
    },
    categories() {
      return this.categoriesRaw
        .filter(isNotEmptyObject);
    },
    dances() {
      return this.dancesRaw
        .map((dance) => danceExtender(dance))
        .filter(isNotEmptyObject);
    },
    staff() {
      return this.staffRaw
        .map((member) => ({
          ...member,
          $name: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
        }))
        .filter(isNotEmptyObject);
    },
    platforms() {
      return this.platformsRaw
        .filter(isNotEmptyObject)
        .map((platform) => ({
          ...platform,
          $name: (
            // @HACK: allow 'skipping' the "Platform " prefix by starting with an equals sign
            platform.name[0] === '='
              ? platform.name.slice(1)
              : `Platform ${platform.name.replace(/^Platform /, '')}`
          ).trim(),
        }));
    },
    draws() {
      return this.drawsRaw;
    },
    schedule() {
      return this.scheduleRaw;
    },
    results() {
      return this.resultsRaw;
    },

    favoriteDancerSuggestions() {
      const favorites = this.$store.getters.favorites('dancers');
      const favoritedDancerIds = Object.keys(favorites);
      const favoritedDancerNames = Object.values(favorites)
        .filter((v) => typeof v !== 'boolean')
        .filter((v, i, a) => a.indexOf(v) === i);
      return this.dancers
        .filter(({ $name }) => favoritedDancerNames.includes($name))
        .filter((dancer) => !favoritedDancerIds.includes(dancer[idKey]));
    },
    sectionBadges() {
      return Object.keys(competitionSchema).reduce((acc, key) => {
        switch (key) {
          case 'dancers': {
            acc[key] = this.favoriteDancerSuggestions?.length
              && !this.$store.getters.isViewed('favoriteDancerSuggestions', this.competitionId);
            break;
          }
          default: {
            acc[key] = false;
          }
        }
        return acc;
      }, {});
    },
  },
  watch: {
    me() {
      this.loadFirebase();
    },
    competitionId() {
      this.loadFirebase();
    },
  },
  methods: {
    formatExternalURL,
    formatHumanURL,
    ...mapMutations([
      'setCurrentDialog',
    ]),

    getTabRoute(tab) {
      const params = {
        competitionId: this.competitionId,
      };
      return {
        name: `competition.${tab}`,
        params,
      };
    },

    async loadFirebase() {
      if (!this.competitionId) return;

      this.$store.commit('setViewed', ['competitions', this.competitionId]);

      this.loaded = false;

      this.competitionRef = this.competitionsRef.child(this.competitionId);
      this.competitionDataRef = this.competitionsDataRef.child(this.competitionId);

      // info object
      if (this.competitionRaw) this.$unbind('competitionRaw');
      this.$bindAsObject('competitionRaw', this.competitionRef);
      // data arrays
      if (this.dancersRaw) this.$unbind('dancersRaw');
      this.$bindAsArray('dancersRaw', this.competitionDataRef.child('dancers'));
      if (this.groupsRaw) this.$unbind('groupsRaw');
      this.$bindAsArray('groupsRaw', this.competitionDataRef.child('groups'));
      if (this.categoriesRaw) this.$unbind('categoriesRaw');
      this.$bindAsArray('categoriesRaw', this.competitionDataRef.child('categories'));
      if (this.dancesRaw) this.$unbind('dancesRaw');
      this.$bindAsArray('dancesRaw', this.competitionDataRef.child('dances'));
      if (this.staffRaw) this.$unbind('staffRaw');
      this.$bindAsArray('staffRaw', this.competitionDataRef.child('staff'));
      if (this.platformsRaw) this.$unbind('platformsRaw');
      this.$bindAsArray('platformsRaw', this.competitionDataRef.child('platforms'));
      // data objects
      if (this.drawsRaw) this.$unbind('drawsRaw');
      this.$bindAsObject('drawsRaw', this.competitionDataRef.child('draws'));
      if (this.scheduleRaw) this.$unbind('scheduleRaw');
      this.$bindAsObject('scheduleRaw', this.competitionDataRef.child('schedule'));
      if (this.resultsRaw) this.$unbind('resultsRaw');
      this.$bindAsObject('resultsRaw', this.competitionDataRef.child('results'));

      await Promise.all([
        this.competitionRef.once('value'),
        this.competitionDataRef.once('value'),
      ])
        .catch((err) => {
          if (err.code === 'PERMISSION_DENIED') {
            // intercept this error since the app shows a 'unavailable' message itself
            console.warn(err); // eslint-disable-line no-console
          } else {
            throw err;
          }
        });
      this.loaded = true;
    },
  },
  created() {
    this.loadFirebase();
  },
};
</script>

<style lang="scss">
.Competition {
  &.is-competition-admin {
    &:not(.listed) .listed-only,
    &.listed:not(.published) .published-only {
      background-image: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0, 0, 0, 0.1) 5px, rgba(0, 0, 0, 0.1) 10px) !important;
    }
  }
}
</style>
