<template>
  <div class="competition md-scroll-frame">
    <div class="md-scroll">
      <router-view
        :competition-ref="competitionRef"
        :competition-data-ref="competitionDataRef"
        :user-favorites-ref="userFavoritesRef"
        :dancers="dancers"
        :groups="groups"
        :levels="levels"
        :favorites="favorites"
        :dances="dances"
        :platforms="platforms"
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
  db,
} from '@/helpers/firebase';
import {
  findGroup,
  getGroupName,
  isFavoriteDancer,
} from '@/helpers/competition';

export default {
  name: 'competition',
  props: {
    competitionId: String,
  },
  data() {
    return {
      competitionRef: db.child('competitions').child(this.competitionId),
      competitionDataRef: db.child('competitionsData').child(this.competitionId),
      userFavoritesRef: db.child('users:favorites').child('idu0'),
    };
  },
  firebase() {
    return {
      dancersRaw: this.competitionDataRef.child('dancers'),
      groupsRaw: this.competitionDataRef.child('groups'),
      levelsRaw: this.competitionDataRef.child('levels'),
      favoritesRaw: this.userFavoritesRef.child('dancers'),
      dancesRaw: this.competitionDataRef.child('dances'),
      platformsRaw: this.competitionDataRef.child('platforms'),
    };
  },
  computed: {
    dancers() {
      return this.dancersRaw.map(dancer => ({
        ...dancer,
        $group: findGroup.call(this, dancer.groupId),
        $favorite: isFavoriteDancer.call(this, dancer),
      }));
    },
    groups() {
      return this.groupsRaw.map((group, i) => ({
        ...group,
        $order: `${10000 + i}`, // pad with 'leading zeros'
        $name: getGroupName.call(this, group),
      }));
    },
    levels() {
      return this.levelsRaw;
    },
    favorites() {
      return this.favoritesRaw;
    },
    dances() {
      return this.dancesRaw;
    },
    platforms() {
      return this.platformsRaw;
    },
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
