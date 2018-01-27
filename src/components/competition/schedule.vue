<template>
  <swiper class="competition-schedule md-scroll-frame swiper-no-swiping">
    <swiper-slide>
      <md-tabs md-alignment="fixed">
        <md-tab md-label="Morning">
          <div v-if="loaded" class="md-scroll-frame">
            <md-list class="md-scroll">
              <md-list-item
                v-for="dance in dances"
                :key="dance[idKey]"
                md-expand
              >
                <md-subheader>
                  {{ dance.name }}
                </md-subheader>

                <md-list slot="md-expand" class="md-double-line">
                  <md-list-item
                    v-for="group in groups"
                    :key="group[idKey]"
                    v-if="dance.groupIds && dance.groupIds[group[idKey]]"
                    @click="selected = { group, dance }"
                  >
                    <md-avatar class="md-avatar-icon">
                      <span>{{ getPlatform(dance, group).number }}</span>
                    </md-avatar>

                    <div class="md-list-item-text">
                      <span>{{ group.$name }}</span>
                      <p>{{ getGroupJudge(group).$name }}</p>
                    </div>

                    <md-icon>chevron_right</md-icon>
                  </md-list-item>
                </md-list>
              </md-list-item>
            </md-list>
          </div>
          <md-progress-spinner v-else md-mode="indeterminate" style="margin: auto;" />
        </md-tab>
        <md-tab md-label="Afternoon">
          <md-subheader>TBD</md-subheader>
        </md-tab>
      </md-tabs>
    </swiper-slide>
    <swiper-slide>
      <div class="md-scroll-frame">
        <md-toolbar class="md-dense">
          <md-button @click="selected = null;" class="md-icon-button">
            <md-icon>chevron_left</md-icon>
          </md-button>
          <span v-if="selected">
            {{ selected.dance.name }}
            &rsaquo;
            {{ selected.group.$name }}
          </span>
        </md-toolbar>
        <md-list class="md-double-line md-scroll">
          <dancer-list-item
            v-for="dancer in selectedDancers"
            :key="dancer[idKey]"
            :dancer="dancer"
          />
        </md-list>
      </div>
    </swiper-slide>
  </swiper>
</template>

<script>
import DancerListItem from '@/components/dancer-list-item';
import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'competition-schedule',
  props: {
    competitionDataRef: {
      type: Object,
      required: true,
    },
    dancers: Array,
    groups: Array,
    levels: Array,
    favorites: Array,
    dances: Array,
    platforms: Array,
  },
  data() {
    return {
      idKey,

      loaded: false,

      selected: undefined,
    };
  },
  computed: {
    selectedDancers() {
      if (this.selected) {
        return this.dancers.filter((dancer) => {
          return dancer.groupId === this.selected.group[idKey];
        });
      }
      return [];
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
    getPlatform() {
      return {
        number: Math.ceil(Math.random() * 3),
      };
    },
    getGroupJudge(group) {
      return '';
    },
  },
  mounted() {
    return this.competitionDataRef.once('value')
      .then(() => {
        this.loaded = true;
      });
  },
  components: {
    DancerListItem,
  },
};
</script>

<style lang="scss">
.competition-schedule {
  .md-tab {
    display: flex;
    flex-direction: column;
  }
}
</style>
