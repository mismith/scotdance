<template>
  <div class="competition md-scroll-frame">
    <div class="md-scroll">
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
    </div>

    <md-bottom-bar
      v-if="$route.name !== 'competition.admin'"
      :md-active-item="`tab-${$router.currentRoute.name}`"
    >
      <md-bottom-bar-item
        id="tab-competition.info"
        @click="$router.push({ name: 'competition.info' })"
      >
        <md-icon class="icon-info"></md-icon>
        <span class="md-bottom-bar-label">Info</span>
      </md-bottom-bar-item>
      <md-bottom-bar-item
        id="tab-competition.dancers"
        @click="$router.push({ name: 'competition.dancers' })"
      >
        <md-icon class="icon-people"></md-icon>
        <span class="md-bottom-bar-label">Dancers</span>
      </md-bottom-bar-item>
      <md-bottom-bar-item
        id="tab-competition.schedule"
        @click="$router.push({ name: 'competition.schedule' })"
      >
        <md-icon class="icon-clock"></md-icon>
        <span class="md-bottom-bar-label">Schedule</span>
      </md-bottom-bar-item>
      <md-bottom-bar-item
        id="tab-competition.results"
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
    };
  },
  computed: {
    competition() {
      return this.competitionRaw;
    },
    dancers() {
      return this.dancersRaw.map(dancer => ({
        ...dancer,
        number: `${dancer.number}`, // stringify
        $name: `${dancer.firstName} ${dancer.lastName}`,
        $group: findByIdKey(this.groups, dancer.groupId),
        $favorite: this.$store.getters.isFavorite('dancers', dancer[idKey]),
      }));
    },
    groups() {
      return this.groupsRaw.map((group, i) => ({
        ...group,
        $order: `${10000 + i}`, // pad with leading 'zeros'
        $name: this.getGroupName(group),
        $category: this.findCategory(group.categoryId),
      }));
    },
    categories() {
      return this.categoriesRaw;
    },
    dances() {
      return this.dancesRaw.map((dance) => {
        const stepsString = dance.steps ? ` (${dance.steps})` : '';
        return {
          ...dance,
          $name: `${dance.name}${stepsString}`,
          $shortName: `${dance.shortName || dance.name}${stepsString}`,
        };
      });
    },
    staff() {
      return this.staffRaw.map(member => ({
        ...member,
        $name: `${member.firstName} ${member.lastName}`,
      }));
    },
    platforms() {
      return this.platformsRaw.map(platform => ({
        ...platform,
        $name: `Platform ${platform.name}`,
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
      this.competitionRef = db.child('competitions').child(this.competitionId);
      this.competitionDataRef = db.child('competitionsData').child(this.competitionId);

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
