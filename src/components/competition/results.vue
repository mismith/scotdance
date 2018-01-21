<template>
  <swiper class="competition-results md-scroll-frame swiper-no-swiping">
    <swiper-slide class="md-scroll-frame">
      <md-list class="md-scroll">
        <md-list-item
          v-for="group in groups"
          :key="group[idKey]"
          md-expand
        >
          <md-subheader>
            {{ getGroupName(group) }}
            <md-icon v-if="hasFavorites(getGroupDancers(group))" class="md-accent">star</md-icon>
          </md-subheader>

          <md-list slot="md-expand">
            <result-list-item
              v-for="dance in dances"
              :key="dance[idKey]"
              v-if="dance.levelIds && dance.levelIds[group.levelId]"
              :winner="getWinner(group[idKey], dance[idKey])"
              @click="selected = {group, dance}"
            >
              {{ dance.name }}
            </result-list-item>
            <div v-if="group.levelId !== '-K0Iom30phJzv3oSaHsn'">
              <md-divider class="md-inset" />
              <result-list-item
                :winner="getWinner(group[idKey])"
                @click="selected = {group}"
              >
                Overall
                <md-icon md-iconset="icon-trophy" slot="icon" />
              </result-list-item>
            </div>
          </md-list>
        </md-list-item>
        <md-progress-spinner md-mode="indeterminate" v-if="!loaded" style="margin: auto;" />
      </md-list>
    </swiper-slide>
    <swiper-slide class="md-scroll-frame">
      <md-toolbar class="md-dense">
        <md-button @click="selected = null;" class="md-icon-button">
          <md-icon>chevron_left</md-icon>
        </md-button>
        <span v-if="selected">
          {{ getGroupName(selected.group) }}
          &rsaquo;
          {{ selected.dance ? selected.dance.name : 'Overall' }}
        </span>
      </md-toolbar>
      <md-list class="md-double-line md-scroll">
        <dancer-list-item
          v-for="(dancer, i) in selectedScores"
          :key="dancer[idKey]"
          :dancer="dancer"
        >
          <output>{{ i + 1 }}</output>
        </dancer-list-item>
        <md-subheader v-if="!selectedScores.length">Results to be determined.</md-subheader>
      </md-list>
    </swiper-slide>
  </swiper>
</template>

<script>
import DancersGroupsFavoritesMixin from '@/mixins/dancers-groups-favorites';
import DancerListItem from '@/components/dancer-list-item';
import ResultListItem from '@/components/result-list-item';
import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'competition-results',
  mixins: [
    DancersGroupsFavoritesMixin,
  ],
  data() {
    return {
      idKey,

      loaded: false,

      selected: undefined,
    };
  },
  firebase() {
    return {
      dances: this.competitionDataRef.child('dances'),
      scoresRaw: {
        source: this.competitionDataRef.child('scores'),
        asObject: true,
      },

      // from DancersGroupsFavoritesMixin
      dancersRaw: this.competitionDataRef.child('dancers'),
      groupsRaw: this.competitionDataRef.child('groups'),
      levels: this.competitionDataRef.child('levels'),
      favorites: this.userFavoritesRef.child('dancers'),
    };
  },
  computed: {
    scores() {
      const scores = {};
      Object.entries(this.scoresRaw).forEach(([groupId, danceIds]) => {
        scores[groupId] = {
          dances: {},
          overall: {},
        };
        Object.entries(danceIds).forEach(([danceId, dancerIds]) => {
          const dancers = Object.entries(dancerIds)
            .map(([dancerId, score]) => {
              // cumulate for overall totals
              scores[groupId].overall[dancerId] = (scores[groupId].overall[dancerId] || 0) + score;

              return {
                dancerId,
                score,
              };
            })
            .sort((a, b) => b.score - a.score); // highest score first

          scores[groupId].dances[danceId] = {
            dancers,
            winner: dancers.length && dancers[0], // first place
          };
        });

        const overall = Object.entries(scores[groupId].overall)
          .map(([dancerId, score]) => ({
            dancerId,
            score,
          }))
          .sort((a, b) => b.score - a.score);
        scores[groupId].winner = overall.length && overall[0]; // highest score first + first place
      });
      return scores;
    },
    selectedScores() {
      if (this.selected) {
        const groupId = this.selected.group && this.selected.group[idKey];
        const danceId = this.selected.dance && this.selected.dance[idKey];

        if (this.scores[groupId]) {
          if (danceId) {
            // specific dance results
            if (this.scores[groupId].dances[danceId]) {
              return this.scores[groupId].dances[danceId].dancers
                // only top half (rounded down)
                .filter((v, i, a) => i <= Math.max(1, (a.length / 2) - 1))
                // make dancer record
                .map(entry => this.dancers.find(d => d[idKey] === entry.dancerId));
            }
          } else {
            // overall results
            // make dancer record
            return this.dancers.filter(d => d[idKey] === this.scores[groupId].winner.dancerId);
          }
        }
      }
      return [];
    },
  },
  watch: {
    selected(selected) {
      if (selected) {
        this.$el.swiper.slideNext();
      } else {
        this.$el.swiper.slidePrev();
      }
    },
  },
  methods: {
    getWinner(groupId, danceId = undefined) {
      const group = this.scores[groupId];
      if (group) {
        if (danceId) {
          const dance = group.dances[danceId];
          if (dance) {
            return this.dancers.find(d => d[idKey] === dance.winner.dancerId);
          }
          return undefined;
        }
        return this.dancers.find(d => d[idKey] === group.winner.dancerId);
      }
      return undefined;
    },
  },
  created() {
    return Promise.all([
      this.$firebaseRefs.dancersRaw.once('value'),
      this.$firebaseRefs.groupsRaw.once('value'),
      this.$firebaseRefs.dances.once('value'),
      this.$firebaseRefs.scoresRaw.once('value'),
    ])
      .then(() => {
        this.loaded = true;
      });
  },
  components: {
    DancerListItem,
    ResultListItem,
  },
};
</script>

<style lang="scss">
.md-list {
  > div {
    position: relative;

    > .md-divider {
      bottom: auto;
      top: 0;
      z-index: 3;
    }
  }
}
</style>
