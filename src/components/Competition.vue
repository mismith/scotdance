<template>
  <div class="competition app-scroll-frame">
    <div v-if="loaded" class="app-scroll-frame">
      <div v-if="competitionExists" class="app-scroll-frame">
        <keep-alive v-if="$root.currentTab === 'info' || $route.name === 'competition.invite' || competition.published || hasPermission">
          <router-view
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
        </keep-alive>
        <div v-else class="app-scroll-frame alt">
          <md-empty-state
            md-icon="access_time"
            md-label="Not available yet"
            md-description="Check back closer to the competition date:"
          >
            <div class="md-title">{{ competition.date ? $moment(competition.date).format('dddd, MMMM D') : 'Soon' }}</div>
          </md-empty-state>
        </div>
      </div>
      <div v-else class="app-scroll-frame alt">
        <md-empty-state
          md-icon="clear"
          md-label="No competition found"
        />
      </div>
    </div>
    <div v-else class="app-scroll-frame alt spinner-container">
      <mi-md-spinner />
    </div>

    <md-bottom-bar ref="bottomBar" v-show="competitionExists && !isAdminRoute">
      <md-bottom-bar-item id="tab-info" :to="{ name: 'competition.info', params: { competitionId } }">
        <md-icon class="icon-info" />
        <span class="md-bottom-bar-label">Info</span>
      </md-bottom-bar-item>
      <md-bottom-bar-item id="tab-dancers" :to="{ name: 'competition.dancers', params: { competitionId } }">
        <md-icon class="icon-people" />
        <span class="md-bottom-bar-label">Dancers</span>
      </md-bottom-bar-item>
      <md-bottom-bar-item id="tab-schedule" :to="{ name: 'competition.schedule', params: { competitionId } }">
        <md-icon class="icon-clock" />
        <span class="md-bottom-bar-label">Schedule</span>
      </md-bottom-bar-item>
      <md-bottom-bar-item id="tab-results" :to="{ name: 'competition.results', params: { competitionId } }">
        <md-icon class="icon-trophy" />
        <span class="md-bottom-bar-label">Results</span>
      </md-bottom-bar-item>
    </md-bottom-bar>

    <md-dialog :md-active.sync="staffVisible" :md-fullscreen="false" class="staff-dialog">
      <md-dialog-title v-if="currentDialogData">
        <md-avatar v-if="currentDialogData.image" class="md-large" style="float: right;">
          <img :src="currentDialogData.image" />
        </md-avatar>
        <div>{{ currentDialogData.$name }}</div>
        <div v-if="currentDialogData" class="md-caption">
          {{ currentDialogData.location }}
        </div>
      </md-dialog-title>
      <md-dialog-content
        v-if="currentDialogData && currentDialogData.description"
        v-html="currentDialogData.description"
        class="pre-line alt"
      />
      <md-dialog-actions>
        <md-button @click="staffVisible = false" class="md-primary">Done</md-button>
      </md-dialog-actions>
    </md-dialog>
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
} from '@/helpers/competition';
import { idKey } from '@/helpers/firebase';

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

    hasPermission() {
      return this.$store.getters.hasPermission(`competitions/${this.competitionId}`);
    },
    isAdminRoute() {
      return this.$route.name.indexOf('.admin.') >= 0 || this.$route.name === 'competition.invite';
    },
    competitionExists() {
      return this.competition && (this.competition['.value'] !== null || this.isAdminRoute);
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
        .sort(sortByKey('$number')); // sort by number
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
    me() {
      this.loadFirebase();
    },
    competitionId() {
      this.loadFirebase();
    },
    '$root.currentTab'() { // eslint-disable-line object-shorthand
      this.syncBottomBar();
    },
  },
  methods: {
    ...mapMutations([
      'setCurrentDialog',
    ]),

    async syncBottomBar() {
      await this.$nextTick(); // await md-bottom-bar's internally queued $nextTick
      const tabId = `tab-${this.$root.currentTab}`;
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
  mounted() {
    this.syncBottomBar();
  },
};
</script>

<style lang="scss">
.staff-dialog {
  .md-dialog-title {
    margin-bottom: 12px;
  }
  .md-dialog-content {
    padding-top: 12px;
  }
}
</style>
