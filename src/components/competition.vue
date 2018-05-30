<template>
  <div class="competition md-scroll-frame">
    <div v-if="loaded" class="md-scroll">
      <keep-alive>
        <router-view
          :competition-ref="competitionRef"
          :competition-data-ref="competitionDataRef"
          :competition="competition"
          :dancers="dancers"
          :groups="groups"
          :categories="categories"
          :dances="dances"
          :staff="staff"
          :platforms="platforms"
          :schedule="schedule"
          :results="results"
        />
      </keep-alive>
    </div>
    <div v-else class="md-scroll-frame">
      <md-progress-spinner md-mode="indeterminate" style="margin: auto;" />
    </div>

    <md-bottom-bar
      v-if="currentTab !== 'admin'"
      :md-active-item="`tab-${currentTab}`"
    >
      <md-bottom-bar-item
        id="tab-info"
        @click="$router.push({ name: 'competition.info' })"
      >
        <md-icon class="icon-info"></md-icon>
        <span class="md-bottom-bar-label">Info</span>
      </md-bottom-bar-item>
      <md-bottom-bar-item
        id="tab-dancers"
        @click="$router.push({ name: 'competition.dancers' })"
      >
        <md-icon class="icon-people"></md-icon>
        <span class="md-bottom-bar-label">Dancers</span>
      </md-bottom-bar-item>
      <md-bottom-bar-item
        id="tab-schedule"
        @click="$router.push({ name: 'competition.schedule' })"
      >
        <md-icon class="icon-clock"></md-icon>
        <span class="md-bottom-bar-label">Schedule</span>
      </md-bottom-bar-item>
      <md-bottom-bar-item
        id="tab-results"
        @click="$router.push({ name: 'competition.results' })"
      >
        <md-icon class="icon-trophy"></md-icon>
        <span class="md-bottom-bar-label">Results</span>
      </md-bottom-bar-item>
    </md-bottom-bar>
  </div>
</template>

<script>
import {
  idKey,
  db,
} from '@/helpers/firebase';
import {
  findByIdKey,
} from '@/helpers/competition';

export default {
  name: 'competition',
  props: {
    competitionId: String,
  },
  data() {
    return {
      competitionRef: undefined,
      competitionDataRef: undefined,

      loaded: false,
    };
  },
  computed: {
    currentTab() {
      return this.$route.name.replace(/^.*?\./, '').replace(/\..*?$/, '') || 'info';
    },

    competition() {
      return this.competitionRaw;
    },
    dancers() {
      return this.dancersRaw.map(dancer => ({
        ...dancer,
        $number: `${10000 + Number.parseInt(dancer.number, 10)}`, // prepend with leading 'zeroes', and stringify for search
        $name: `${dancer.firstName || ''} ${dancer.lastName || ''}`.trim(),
        $group: findByIdKey(this.groups, dancer.groupId),
        $favorite: this.$store.getters.isFavorite('dancers', dancer[idKey]),
      }))
        .sort((a, b) => a.$number.localeCompare(b.$number)); // sort by number
    },
    groups() {
      return this.groupsRaw.map((group, i) => ({
        ...group,
        $order: `${10000 + i}`, // prepend with leading 'zeroes'
        $name: this.getGroupName(group),
        $category: this.findCategory(group.categoryId),
      }));
    },
    categories() {
      return this.categoriesRaw;
    },
    dances() {
      return this.dancesRaw.map((dance) => {
        const name = dance.name || '';
        const stepsString = dance.steps ? ` (${dance.steps})` : '';
        return {
          groupIds: {},
          ...dance,
          $name: `${name}${stepsString}`.trim(),
          $shortName: `${dance.shortName || name}${stepsString}`.trim(),
        };
      });
    },
    staff() {
      return this.staffRaw.map(member => ({
        ...member,
        $name: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
      }));
    },
    platforms() {
      return this.platformsRaw.map(platform => ({
        ...platform,
        $name: `Platform ${platform.name}`.trim(),
      }));
    },
    schedule() {
      return this.scheduleRaw;
    },
    results() {
      return this.resultsRaw;
    },
  },
  watch: {
    competitionId() {
      this.loadFirebase();
    },
  },
  methods: {
    loadFirebase() {
      this.loaded = false;

      this.competitionRef = db.child('competitions').child(this.competitionId);
      this.competitionDataRef = db.child('competitions:data').child(this.competitionId);

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
      if (this.scheduleRaw) this.$unbind('scheduleRaw');
      this.$bindAsObject('scheduleRaw', this.competitionDataRef.child('schedule'));
      if (this.resultsRaw) this.$unbind('resultsRaw');
      this.$bindAsObject('resultsRaw', this.competitionDataRef.child('results'));

      return Promise.all([
        this.competitionRef.once('value'),
        this.competitionDataRef.once('value'),
      ])
        .then(() => {
          this.loaded = true;
        });
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
.competition {
  .md-bottom-bar {
    z-index: 1; // maintain box-shadow

    .md-ripple {
      justify-content: center; // center tabs
    }
  }
}
</style>
