<template>
  <swiper class="competition-schedule md-scroll-frame swiper-no-swiping">
    <swiper-slide>
      <md-tabs v-if="schedule.days" md-alignment="fixed">
        <md-tab
          v-for="day in schedule.days"
          :key="day[idKey]"
          :md-label="moment(day.date).format('ddd')"
        >
          <div v-if="loaded" class="md-scroll-frame md-scroll">
            <md-subheader v-if="day.name" class="md-title">
              <span>{{ day.name }}</span>
            </md-subheader>

            <md-list class="md-list-cards">
              <md-list-item
                v-for="block in day.blocks"
                :key="block[idKey]"
                md-expand
                md-expanded
              >
                <md-subheader>
                  <div>{{ block.name }}</div>
                  <div class="md-caption">{{ block.description }}</div>
                </md-subheader>

                <md-list
                  class="md-double-line"
                  slot="md-expand"
                >
                  <md-list-item
                    v-for="event in block.events"
                    :key="event[idKey]"
                    @click="event.dances && select({ day, block, event })"
                  >
                    <div class="md-list-item-text">
                      <div>{{ event.name }}</div>
                      <div>{{ event.description }}</div>
                    </div>
                    <md-icon v-if="event.dances">chevron_right</md-icon>
                  </md-list-item>
                </md-list>
              </md-list-item>
            </md-list>
          </div>
          <md-progress-spinner v-else md-mode="indeterminate" style="margin: auto;" />
        </md-tab>
      </md-tabs>
      <md-empty-state
        v-else
        md-icon="report_problem"
        md-label="No schedule yet"
      />
    </swiper-slide>
    <swiper-slide>
      <div v-if="selected" class="md-scroll-frame">
        <md-toolbar class="md-dense">
          <md-button @click="select(null)" class="md-icon-button">
            <md-icon>chevron_left</md-icon>
          </md-button>
          <span>
            {{ selected.day.name }}
            &rsaquo;
            {{ selected.block.name }}
          </span>
        </md-toolbar>
        <md-list class="md-double-line md-scroll">
          <md-list-item v-for="dance in selected.event.dances" :key="dance[idKey]">
            <div class="md-list-item-text">
              {{ dance.name }}
            </div>
          </md-list-item>
        </md-list>
      </div>
    </swiper-slide>
  </swiper>
</template>

<script>
import moment from 'moment-mini';
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
    schedule: Object,
  },
  data() {
    return {
      idKey,

      loaded: false,

      selected: undefined,
    };
  },
  computed: {
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
    moment,

    select(selected) {
      this.$set(this, 'selected', selected);
    },
  },
  async mounted() {
    await this.competitionDataRef.once('value');
    this.loaded = true;
  },
  components: {
    DancerListItem,
  },
};
</script>

<style lang="scss">
.competition-schedule {
  background-color: #eee;

  .md-tabs {
    .md-tabs-navigation {
      .md-button {
        min-width: 48px;
      }
    }
    .md-tabs-content {
      background: initial;
    }
    .md-tab {
      display: flex;
      flex-direction: column;
    }
  }
  .md-subheader.md-title {
    color: inherit;
    font-size: 24px;
    padding-top: 16px;
  }
}
</style>
