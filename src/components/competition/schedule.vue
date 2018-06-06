<template>
  <div class="competition-schedule blades md-scroll-frame alt">
    <transition :name="`slide-${currentEvent ? 'left' : 'right'}`">
      <div v-if="!currentEvent" class="blade md-scroll-frame" key="list">
        <md-tabs v-if="schedule.days" md-alignment="fixed">
          <md-tab
            v-for="(day, dayId) in schedule.days"
            :key="dayId"
            :md-label="$moment(day.date).format('ddd')"
          >
            <div class="md-scroll">
              <md-subheader v-if="day.name" class="md-title">
                <span>{{ day.name }}</span>
              </md-subheader>

              <md-list class="md-list-cards">
                <md-list-item-cards
                  v-for="(block, blockId) in day.blocks"
                  :key="blockId"
                  md-expand
                  :md-expanded="isBlockExpanded(blockId, Object.keys(day.blocks))"
                  @toggled="handleBlockExpanded(blockId, $event)"
                >
                  <md-subheader>
                    <div>{{ block.name }}</div>
                    <div class="md-caption">{{ block.description }}</div>
                  </md-subheader>

                  <md-list slot="md-expand" class="md-double-line">
                    <md-list-item
                      v-for="(event, eventId) in block.events"
                      :key="eventId"
                      :to="{ params: { dayId, blockId, eventId } }"
                      :class="{ active: isActive(dayId, blockId, eventId) }"
                    >
                      <div class="md-list-item-text">
                        <div>{{ event.name }}</div>
                        <div>{{ event.description }}</div>
                      </div>
                      <md-icon v-if="event.dances">chevron_right</md-icon>
                    </md-list-item>
                    <md-list-item v-if="!block.events" class="empty">
                      No events found.
                    </md-list-item>
                  </md-list>
                </md-list-item-cards>
              </md-list>
            </div>
          </md-tab>
        </md-tabs>
        <md-empty-state
          v-else
          md-icon="error"
          md-label="No schedule yet"
        />
      </div>
      <div v-else class="blade md-scroll-frame" key="detail">
        <md-toolbar class="md-dense md-toolbar-nowrap">
          <md-button :to="{ name: $route.name }" class="md-icon-button">
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
            <md-list-item-cards
              v-for="(dance, danceId) in currentEvent.dances"
              :key="danceId"
              :md-expand="!!dance.platforms"
              :md-expanded="isDanceExpanded(danceId, Object.keys(currentEvent.dances))"
              @toggled="handleDanceExpanded(danceId, $event)"
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
                  :dancers="dancers"
                  :staff="staff"
                  :platforms="platforms"
                />
              </md-content>
            </md-list-item-cards>
          </md-list>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import DancerListItem from '@/components/utility/dancer-list-item';
import AdminPlatforms from '@/components/competition/admin/utility/platforms';
import {
  getScheduleItemDanceName,
} from '@/helpers/competition';
import {
  idKey,
} from '@/helpers/firebase';
import {
  isExpanded,
  handleExpanded,
} from '@/helpers/router';

export default {
  name: 'competition-schedule',
  props: {
    dayId: String,
    blockId: String,
    eventId: String,
    danceId: String,

    groups: Array,
    dances: Array,
    dancers: Array,
    staff: Array,
    platforms: Array,
    schedule: Object,
  },
  localStorage: {
    scheduleExpandedBlocks: {
      type: Object,
      default: {},
    },
    scheduleExpandedDances: {
      type: Object,
      default: {}, // { [eventId]: {}, ... }
    },
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
  methods: {
    getScheduleItemDanceName,

    isActive(dayId, blockId, eventId) {
      return this.dayId === dayId && this.blockId === blockId && this.eventId === eventId;
    },

    isBlockExpanded(blockId, blockIds) {
      return isExpanded(this.scheduleExpandedBlocks, blockId, blockIds, true);
    },
    handleBlockExpanded(blockId, expanded) {
      this.scheduleExpandedBlocks = handleExpanded(this.scheduleExpandedBlocks, blockId, expanded);
      this.$localStorage.set('scheduleExpandedBlocks', this.scheduleExpandedBlocks);
    },

    isDanceExpanded(danceId, danceIds) {
      return isExpanded(this.scheduleExpandedDances[this.eventId], danceId, danceIds);
    },
    handleDanceExpanded(danceId, expanded) {
      this.scheduleExpandedDances[this.eventId] = handleExpanded(
        this.scheduleExpandedDances[this.eventId],
        danceId,
        expanded,
      );
      this.$localStorage.set('scheduleExpandedDances', this.scheduleExpandedDances);
    },
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
    -webkit-overflow-scrolling: touch;

    .pools {
      .pool {
        padding: 0 6px 12px;
      }
    }
  }
}
</style>
