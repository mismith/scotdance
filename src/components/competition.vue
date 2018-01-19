<template>
  <div class="competition md-scroll-frame">
    <div class="md-scroll">
      <router-view
        :competition-ref="competitionRef"
        :competition-data-ref="competitionDataRef"
        :user-favorites-ref="userFavoritesRef"
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
