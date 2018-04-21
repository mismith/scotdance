<template>
  <swiper class="competition-schedule md-scroll-frame swiper-no-swiping">
    <swiper-slide>
      <md-tabs v-if="schedule.days" md-alignment="fixed">
        <md-tab
          v-for="(day, dayId) in schedule.days"
          :key="dayId"
          :md-label="moment(day.date).format('ddd')"
        >
          <div class="md-scroll">
            <md-subheader v-if="day.name" class="md-title">
              <span>{{ day.name }}</span>
            </md-subheader>

            <md-list class="md-list-cards">
              <md-list-item
                v-for="(block, blockId) in day.blocks"
                :key="blockId"
                md-expand
                md-expanded
              >
                <md-subheader>
                  <div>{{ block.name }}</div>
                  <div class="md-caption">{{ block.description }}</div>
                </md-subheader>

                <md-list slot="md-expand" class="md-double-line">
                  <md-list-item
                    v-for="(event, eventId) in block.events"
                    :key="eventId"
                    @click="event.dances && $router.push({ name: 'competition.schedule', params: { dayId, blockId, eventId }})"
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
        </md-tab>
      </md-tabs>
      <md-empty-state
        v-else
        md-icon="error"
        md-label="No schedule yet"
      />
    </swiper-slide>
    <swiper-slide>
      <div v-if="currentDay && currentBlock && currentEvent" class="md-scroll-frame">
        <md-toolbar class="md-dense md-toolbar-nowrap">
          <md-button @click="$router.push({ name: 'competition.schedule' })" class="md-icon-button">
            <md-icon>chevron_left</md-icon>
          </md-button>
          <span>
            {{ currentDay.name }}
            &rsaquo;
            {{ currentBlock.name }}
          </span>
        </md-toolbar>

        <div class="md-scroll">
          <md-subheader class="md-title">{{ currentEvent.name }}</md-subheader>

          <md-list class="md-double-line md-list-card">
            <md-list-item v-for="dance in currentEvent.dances" :key="dance[idKey]">
              <div class="md-list-item-text">
                {{ dance.name }}
              </div>
            </md-list-item>
          </md-list>
        </div>
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
    dayId: String,
    blockId: String,
    eventId: String,
    competitionDataRef: {
      type: Object,
      required: true,
    },
    schedule: Object,
  },
  data() {
    return {
      idKey,
    };
  },
  computed: {
    currentDay() {
      if (this.dayId && this.schedule && this.schedule.days) {
        return this.schedule.days[this.dayId];
      }
      return null;
    },
    currentBlock() {
      if (this.blockId && this.currentDay && this.currentDay.blocks) {
        return this.currentDay.blocks[this.blockId];
      }
      return null;
    },
    currentEvent() {
      if (this.eventId && this.currentBlock && this.currentBlock.events) {
        return this.currentBlock.events[this.eventId];
      }
      return null;
    },
  },
  watch: {
    currentEvent() {
      this.showRelevantSlide();
    },
  },
  methods: {
    moment,

    showRelevantSlide() {
      if (this.currentEvent) {
        this.$el.swiper.slideTo(1);
      } else {
        this.$el.swiper.slideTo(0);
      }
    },
  },
  async mounted() {
    this.showRelevantSlide();
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
}
</style>
