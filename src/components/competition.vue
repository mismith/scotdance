<template>
  <div class="competition md-scroll-frame">
    <div class="md-scroll">
      <router-view
        :competition-ref="competitionRef"
        :competition-data-ref="competitionDataRef"
        :user-favorites-ref="userFavoritesRef"
        :competition="competition"
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
      competitionRef: db.child('competitions').child(this.competitionId),
      competitionDataRef: db.child('competitionsData').child(this.competitionId),
      userFavoritesRef: db.child('users:favorites').child('idu0'), // @TODO
    };
  },
  firebase() {
    return {
      // info
      competitionRaw: {
        source: this.competitionRef,
        asObject: true,
      },
      // data
      dancersRaw: this.competitionDataRef.child('dancers'),
      groupsRaw: this.competitionDataRef.child('groups'),
      levelsRaw: this.competitionDataRef.child('levels'),
      favoritesRaw: this.userFavoritesRef.child('dancers'),
      dancesRaw: this.competitionDataRef.child('dances'),
      platformsRaw: this.competitionDataRef.child('platforms'),
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
        $group: this.findGroup(dancer.groupId),
        $favorite: this.isFavoriteDancer(dancer),
      }));
    },
    groups() {
      return this.groupsRaw.map((group, i) => ({
        ...group,
        $order: `${10000 + i}`, // pad with leading 'zeros'
        $name: this.getGroupName(group),
        $level: this.findLevel(group.levelId),
      }));
    },
    levels() {
      return this.levelsRaw;
    },
    favorites() {
      return this.favoritesRaw;
    },
    dances() {
      return this.dancesRaw.map((dance) => {
        const stepsString = dance.steps ? ` (${dance.steps})` : '';
        return {
          ...dance,
          $name: `${dance.name}${stepsString}`,
          $shortName: `${dance.shortName}${stepsString}`,
        };
      });
    },
    platforms() {
      return this.platformsRaw;
    },
  },
  methods: {
    findGroup(groupId) {
      return findByIdKey(this.groups, groupId);
    },
    findLevel(levelId) {
      return findByIdKey(this.levels, levelId);
    },
    getGroupName(group) {
      const level = this.findLevel(group.levelId);
      return `${level ? level.name : ''} ${group.name}`;
    },
    isFavoriteDancer(dancer) {
      return !!findByIdKey(this.favorites, dancer[idKey]);
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
