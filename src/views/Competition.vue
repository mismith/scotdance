<template>
  <div
    class="Competition app-scroll-frame"
    :class="{listed: competition.listed, published: competition.published, 'is-admin': isAdmin }"
  >
    <div v-if="loaded" class="app-scroll-frame">
      <div v-if="competitionExists" class="app-scroll-frame">
        <router-view
          v-if="hasPermission"
          v-bind="{
            competitionId,
            competitionRef,
            competitionDataRef,
            competition,
            dancers,
            groups,
            categories,
            dances,
            staff,
            platforms,
            draws,
            schedule,
            results,
          }"
        />
        <div v-else class="app-scroll-frame alt">
          <EmptyState
            icon="access_time"
            label="Not available yet"
            description="Check back closer to the competition date:"
          >
            <div class="title">
              {{ competition.date ? $moment(competition.date).format('dddd, MMMM D') : 'Soon' }}
            </div>
          </EmptyState>
        </div>

        <v-bottom-nav v-if="!isAdminRoute" :value="true" class="listed-only">
          <v-btn
            color="primary"
            flat
            value="info"
            :to="{ name: 'competition.info', params: { competitionId } }"
          >
            <span>Info</span>
            <v-icon class="icon-info" />
          </v-btn>
          <v-btn
            color="primary"
            flat
            value="dancers"
            :to="{ name: 'competition.dancers', params: { competitionId } }"
            class="published-only"
          >
            <span>Dancers</span>
            <v-icon class="icon-people" />
          </v-btn>
          <v-btn
            color="primary"
            flat
            value="schedule"
            :to="{ name: 'competition.schedule', params: { competitionId } }"
            class="published-only"
          >
            <span>Schedule</span>
            <v-icon class="icon-clock" />
          </v-btn>
          <v-btn
            color="primary"
            flat
            value="results"
            :to="{ name: 'competition.results', params: { competitionId } }"
            class="published-only"
          >
            <span>Results</span>
            <v-icon class="icon-trophy" />
          </v-btn>
        </v-bottom-nav>
      </div>
      <div v-else class="app-scroll-frame alt">
        <EmptyState
          icon="clear"
          label="No competition found"
        />
      </div>
    </div>
    <div v-else class="app-scroll-frame alt">
      <Spinner />
    </div>

    <DialogCard v-model="staffVisible">
      <v-card-title v-if="currentDialogData" slot="title" class="layout row wrap">
        <v-avatar v-if="currentDialogData.image" :size="100" class="mr-3">
          <img :src="currentDialogData.image" />
        </v-avatar>
        <v-flex>
          <div class="title my-3">{{ currentDialogData.$name }}</div>
          <div class="subheading">{{ currentDialogData.location }}</div>
        </v-flex>
      </v-card-title>
      <v-card-text
        slot="text"
        v-if="currentDialogData && currentDialogData.description"
        v-html="currentDialogData.description"
        class="pre-line alt"
      />
    </DialogCard>
  </div>
</template>

<script>
import {
  mapState,
  mapMutations,
} from 'vuex';
import {
  findByIdKey,
  sortByKey,
  danceExtender,
  isNotEmptyObject,
} from '@/helpers/competition';
import { idKey } from '@/helpers/firebase';

export default {
  name: 'Competition',
  props: {
    competitionId: String,
    competitionsRef: Object,
    competitionsDataRef: Object,
  },
  data() {
    return {
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

    staffVisible: {
      get() {
        return this.currentDialog === 'staff';
      },
      set(value) {
        return this.setCurrentDialog(value && 'staff');
      },
    },

    isAdmin() {
      return this.$store.getters.hasPermission(`competitions/${this.competitionId}`);
    },
    hasPermission() {
      return this.$root.currentTab === 'info'
        || this.$route.name === 'competition.invite'
        || this.competition.published
        || this.isAdmin;
    },
    isAdminRoute() {
      return this.$route.name.indexOf('.admin.') >= 0 || this.$route.name === 'competition.invite';
    },
    competitionExists() {
      return this.competition
        && (this.competition['.value'] !== null || this.isAdminRoute)
        && (this.competition.listed || this.isAdmin);
    },

    competition() {
      return this.competitionRaw;
    },
    dancers() {
      return this.dancersRaw
        .map(dancer => ({
          ...dancer,
          $number: `${10000 + Number.parseInt(dancer.number, 10)}`, // prepend with leading 'zeroes', and stringify for search
          $name: `${dancer.firstName || ''} ${dancer.lastName || ''}`.trim(),
          $group: findByIdKey(this.groups, dancer.groupId),
          $favorite: this.$store.getters.isFavorite('dancers', dancer[idKey]),
        }))
        .filter(isNotEmptyObject)
        .sort(sortByKey('$number')); // sort by number
    },
    groups() {
      return this.groupsRaw
        .map((group, i) => ({
          ...group,
          $order: `${10000 + i}`, // prepend with leading 'zeroes'
          $name: this.getGroupName(group),
          $category: this.findCategory(group.categoryId),
        }))
        .filter(isNotEmptyObject);
    },
    categories() {
      return this.categoriesRaw
        .filter(isNotEmptyObject);
    },
    dances() {
      return this.dancesRaw
        .map(danceExtender)
        .filter(isNotEmptyObject);
    },
    staff() {
      return this.staffRaw
        .map(member => ({
          ...member,
          $name: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
        }))
        .filter(isNotEmptyObject);
    },
    platforms() {
      return this.platformsRaw
        .filter(isNotEmptyObject)
        .map(platform => ({
          ...platform,
          $name: `Platform ${platform.name}`.trim(),
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
    ...mapMutations([
      'setCurrentDialog',
    ]),

    async loadFirebase() {
      if (!this.competitionId) return;

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

    findCategory(categoryId) {
      return findByIdKey(this.categories, categoryId);
    },
    getGroupName(group) {
      const category = this.findCategory(group.categoryId);
      return `${category ? category.name : ''} ${group.name || ''}`;
    },
  },
  created() {
    this.loadFirebase();
  },
};
</script>

<style lang="scss">
.Competition {
  &.is-admin {
    &:not(.listed) .listed-only,
    &.listed:not(.published) .published-only {
      background-image: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0, 0, 0, 0.1) 5px, rgba(0, 0, 0, 0.1) 10px) !important;
    }
  }
}
</style>
