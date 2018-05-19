<template>
  <swiper class="competition-schedule md-scroll-frame swiper-no-swiping alt">
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
                    @click="$router.push({ name: 'competition.schedule', params: { dayId, blockId, eventId }})"
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
          <md-button @click="$router.go(-1)" class="md-icon-button">
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
          <div
            v-if="currentEvent.description"
            v-html="currentEvent.description"
            class="md-padding"
          />

          <md-list class="md-list-cards">
            <md-list-item
              v-for="dance in currentEvent.dances"
              :key="dance.danceId"
              :md-expand="!!dance.platforms"
              :md-expanded="dance.danceId === danceId"
              @update:mdExpanded="handleDanceExpanded(dance.danceId, $event)"
            >
              <md-subheader>
                <div>{{ getScheduleItemDanceName(dance, dances) }}</div>
                <div v-if="dance.description" class="md-caption">{{ dance.description }}</div>
              </md-subheader>

              <md-content slot="md-expand" class="md-elevation-1">
                <admin-platforms
                  :item="dance"
                  :groups="groups"
                  :dances="dances"
                  :staff="staff"
                  :platforms="platforms"
                />
              </md-content>
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
import AdminPlatforms from '@/components/competition/admin/platforms';
import {
  getScheduleItemDanceName,
} from '@/helpers/competition';
import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'competition-schedule',
  props: {
    dayId: String,
    blockId: String,
    eventId: String,
    danceId: String,
    competitionDataRef: {
      type: Object,
      required: true,
    },
    groups: Array,
    dances: Array,
    staff: Array,
    platforms: Array,
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
    getScheduleItemDanceName,

    showRelevantSlide() {
      if (this.currentEvent) {
        this.$el.swiper.slideTo(1);
      } else {
        this.$el.swiper.slideTo(0);
      }
    },

    handleDanceExpanded(danceId, expanded) {
      if (expanded) {
        this.$router.replace({
          params: {
            danceId,
          },
        });
      }
    },
  },
  async mounted() {
    this.showRelevantSlide();
  },
  components: {
    DancerListItem,
    AdminPlatforms,
  },
};
</script>

<style lang="scss">
.competition-schedule {
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
  .admin-platforms {
    margin-bottom: 4px;
    overflow-x: auto;

    .pool {
      padding: 0 6px 12px;
    }
  }
}
</style>
