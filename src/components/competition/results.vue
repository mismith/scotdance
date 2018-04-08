<template>
  <swiper class="competition-results md-scroll-frame swiper-no-swiping">
    <swiper-slide class="md-scroll-frame">
      <div v-if="loaded" class="md-scroll">
        <md-list v-if="groups.length" class="md-list-cards">
          <md-list-item
            v-for="group in groups"
            :key="group[idKey]"
            md-expand
          >
            <md-subheader>
              {{ group.$name }}
              <md-icon v-if="hasFavorites(findGroupDancers(group))" class="md-accent">star</md-icon>
            </md-subheader>

            <md-list slot="md-expand">
              <result-list-item
                v-for="dance in findGroupDances(group)"
                :key="dance[idKey]"
                :winner="getGroupDanceWinner(group, dance)"
                @click="selected = { group, dance }"
              >
                {{ dance.$name }}
              </result-list-item>

              <div v-if="group.$category && group.$category.name !== 'Primary'">
                <md-divider class="md-inset" />
                <result-list-item
                  :winner="getGroupDanceWinner(group, overall)"
                  @click="selected = { group, dance: overall }"
                >
                  {{ overall.$name }}
                  <md-icon class="icon-trophy" slot="icon" />
                </result-list-item>
              </div>
            </md-list>
          </md-list-item>
        </md-list>
        <md-empty-state
          v-else
          md-icon="report_problem"
          md-label="No results yet"
        />
      </div>
      <md-progress-spinner v-else md-mode="indeterminate" style="margin: auto;" />
    </swiper-slide>
    <swiper-slide class="md-scroll-frame">
      <md-toolbar class="md-dense">
        <md-button @click="selected = null;" class="md-icon-button">
          <md-icon>chevron_left</md-icon>
        </md-button>
        <span v-if="selected">
          {{ selected.group.$name }}
          &rsaquo;
          {{ selected.dance.$name }}
        </span>
      </md-toolbar>
      <md-list class="md-double-line md-scroll">
        <dancer-list-item
          v-for="(dancer, index) in placedDancers"
          :key="dancer[idKey]"
          :dancer="dancer"
          :place="index + 1"
        />
        <md-subheader v-if="!placedDancers.length">Results to be determined.</md-subheader>
      </md-list>
    </swiper-slide>
  </swiper>
</template>

<script>
import DancerListItem from '@/components/dancer-list-item';
import ResultListItem from '@/components/result-list-item';
import {
  idKey,
} from '@/helpers/firebase';
import {
  hasFavorites,
} from '@/helpers/competition';
import {
  overall,
  findGroupDancers,
  findGroupDances,
  getGroupDanceResults,
  getPlacedDancers,
  getGroupDanceWinner,
} from '@/helpers/results';

export default {
  name: 'competition-results',
  props: {
    competitionDataRef: {
      type: Object,
      required: true,
    },
    dancers: Array,
    groups: Array,
    dances: Array,
    results: Object,
  },
  data() {
    return {
      idKey,
      overall,

      loaded: false,
      selected: undefined,
    };
  },
  computed: {
    placedDancers() {
      let results = [];
      if (this.selected) {
        results = this.getGroupDanceResults(this.selected.group, this.selected.dance);
      }
      return this.getPlacedDancers(results);
    },
  },
  watch: {
    selected(selected) {
      if (selected) {
        this.$el.swiper.slideTo(1);
      } else {
        this.$el.swiper.slideTo(0);
      }
    },
  },
  methods: {
    hasFavorites,
    findGroupDancers,
    findGroupDances,
    getGroupDanceResults,
    getPlacedDancers,
    getGroupDanceWinner,
  },
  async mounted() {
    await this.competitionDataRef.once('value');
    this.loaded = true;
  },
  components: {
    DancerListItem,
    ResultListItem,
  },
};
</script>

<style lang="scss">
.competition-results {
  background: #eee;

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
}
</style>
