<template>
  <div class="competition md-scroll-frame">
    <div v-if="loaded" class="md-scroll-frame">
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
          :draws="draws"
          :schedule="schedule"
          :results="results"
        />
      </keep-alive>
    </div>
    <div v-else class="md-scroll-frame spinner-container">
      <mi-md-spinner />
    </div>

    <md-bottom-bar ref="bottomBar" v-show="currentTab !== 'admin'">
      <md-bottom-bar-item id="tab-info" :to="{ name: 'competition.info' }">
        <md-icon class="icon-info" />
        <span class="md-bottom-bar-label">Info</span>
      </md-bottom-bar-item>
      <md-bottom-bar-item id="tab-dancers" :to="{ name: 'competition.dancers' }">
        <md-icon class="icon-people" />
        <span class="md-bottom-bar-label">Dancers</span>
      </md-bottom-bar-item>
      <md-bottom-bar-item id="tab-schedule" :to="{ name: 'competition.schedule' }">
        <md-icon class="icon-clock" />
        <span class="md-bottom-bar-label">Schedule</span>
      </md-bottom-bar-item>
      <md-bottom-bar-item id="tab-results" :to="{ name: 'competition.results' }">
        <md-icon class="icon-trophy" />
        <span class="md-bottom-bar-label">Results</span>
      </md-bottom-bar-item>
    </md-bottom-bar>
  </div>
</template>

<script>
import {
  idKey,
} from '@/helpers/firebase';
import {
  findByIdKey,
  danceExtender,
} from '@/helpers/competition';

export default {
  name: 'competition',
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
      return this.dancesRaw.map(danceExtender);
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
    competitionId() {
      this.loadFirebase();
    },
    currentTab() {
      this.syncBottomBar();
    },
  },
  methods: {
    async syncBottomBar() {
      await this.$nextTick(); // await md-bottom-bar's internally queued $nextTick
      const tabId = `tab-${this.currentTab}`;
      this.$refs.bottomBar.MdBottomBar.activeItem = tabId;
    },

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
      ]);
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
  mounted() {
    this.syncBottomBar();
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
