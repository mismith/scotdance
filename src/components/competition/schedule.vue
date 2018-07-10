<template>
  <blades class="competition-schedule alt">
    <blade
      :active="!currentEvent"
      v-persist-scroll="`/competitions/${competitionId}/schedule`"
      class="md-small-size-100 md-size-33 md-scroll"
    >
      <div v-if="schedule.days">
        <div v-for="(day, dayId) in schedule.days" :key="dayId">
          <md-subheader class="md-title">
            <span>{{ day.name || $moment(day.date).format('dddd') }}</span>
          </md-subheader>
          <div
            v-if="day.description"
            v-html="day.description"
            class="md-padding pre-line"
          />

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
                <div class="md-caption">{{ textify(block.description) }}</div>
              </md-subheader>

              <md-list slot="md-expand" class="md-double-line">
                <md-list-item
                  v-for="(event, eventId) in block.events"
                  :key="eventId"
                  :to="{ name: $route.name, params: { dayId, blockId, eventId } }"
                  :class="{ active: isActive(dayId, blockId, eventId) }"
                >
                  <div class="md-list-item-text">
                    <div>{{ event.name }}</div>
                    <div>{{ textify(event.description) }}</div>
                  </div>
                  <md-icon v-if="event.dances || event.description">chevron_right</md-icon>
                </md-list-item>
                <md-list-item v-if="!block.events" class="empty">
                  No events found.
                </md-list-item>
              </md-list>
            </md-list-item-cards>
          </md-list>
        </div>
      </div>
      <div v-else>
        <md-empty-state
          md-icon="clear"
          md-label="No schedule yet"
        />
      </div>
    </blade>
    <blade :active="currentEvent" class="md-small-size-100 md-size-66">
      <div v-if="currentEvent" class="md-scroll-frame">
        <md-toolbar class="md-dense md-toolbar-nowrap md-medium-hide">
          <md-button :to="{ name: $route.name, params: { competitionId } }" class="md-icon-button">
            <md-icon>chevron_left</md-icon>
          </md-button>
          <span>
            {{ currentDay.name }}
            &rsaquo;
            {{ currentBlock.name }}
          </span>
        </md-toolbar>

        <div
          v-persist-scroll="`/competitions/${competitionId}/schedule/${dayId}/${blockId}/${eventId}`"
          class="md-scroll-frame md-scroll"
        >
          <header>
            <md-subheader class="md-title">{{ currentEvent.name }}</md-subheader>
            <div
              v-if="currentEvent.description"
              v-html="currentEvent.description"
              class="md-padding pre-line"
            />
          </header>

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
                <div
                  v-if="dance.description"
                  v-html="dance.description"
                  class="md-caption"
                />
              </md-subheader>

              <md-content slot="md-expand" class="md-elevation-1">
                <admin-platforms
                  :item="dance"
                  :groups="groups"
                  :dances="dances"
                  :dancers="dancers"
                  :staff="staff"
                  :platforms="platforms"
                  @item-click="setCurrentDialog(['draw', { group: $event, dance: findByIdKey(dances, dance.danceId) }])"
                />
              </md-content>
            </md-list-item-cards>
          </md-list>
        </div>

        <md-dialog :md-active.sync="drawVisible" :md-fullscreen="false" class="draw-dialog">
          <md-dialog-title>
            <div>Draw / Order</div>
            <div v-if="currentDialogData" class="md-caption">
              {{ currentDialogData.dance.$shortName }} • {{ currentDialogData.group.$name }}
            </div>
          </md-dialog-title>
          <md-dialog-content v-if="currentDialogData" class="alt">
            <md-list class="md-double-line">
              <dancer-list-item
                v-for="dancer in findDrawnDancers(currentDialogData.group, currentDialogData.dance)"
                :key="dancer[idKey]"
                :dancer="dancer"
                @click="$router.push({ name: 'competition.dancers', params: { dancerId: dancer[idKey] } }); drawVisible = false;"
              />
            </md-list>
          </md-dialog-content>
          <md-dialog-actions>
            <md-button @click="drawVisible = false" class="md-primary">Done</md-button>
          </md-dialog-actions>
        </md-dialog>
      </div>
      <div v-else>
        <md-empty-state
          md-icon="touch_app"
          md-label="See event details"
          md-description="Select an event"
        />
      </div>
    </blade>
  </blades>
</template>

<script>
import {
  mapState,
  mapMutations,
} from 'vuex';
import AdminPlatforms from '@/components/competition/admin/utility/platforms';
import DancerListItem from '@/components/utility/dancer-list-item';
import {
  idKey,
} from '@/helpers/firebase';
import {
  isExpanded,
  handleExpanded,
} from '@/helpers/router';
import {
  textify,
  findByIdKey,
  sortByKey,
  getScheduleItemDanceName,
} from '@/helpers/competition';
import {
  getPlaceholderDancer,
  findGroupDancers,
} from '@/helpers/results';

export default {
  name: 'competition-schedule',
  props: {
    competitionId: String,
    dayId: String,
    blockId: String,
    eventId: String,
    danceId: String,

    groups: Array,
    dances: Array,
    dancers: Array,
    staff: Array,
    platforms: Array,
    draws: Object,
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
    ...mapState([
      'currentDialog',
      'currentDialogData',
    ]),

    drawVisible: {
      get() {
        return this.currentDialog === 'draw';
      },
      set(value) {
        return this.setCurrentDialog(value && 'draw');
      },
    },

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
    textify,
    findByIdKey,
    getScheduleItemDanceName,

    ...mapMutations([
      'setCurrentDialog',
    ]),

    findDrawnDancers(group, dance) {
      const draw = this.draws && this.draws[group[idKey]] && this.draws[group[idKey]][dance[idKey]];
      if (draw) {
        return draw // order by draw order
          .map(number => this.dancers.find(dancer => `${dancer.number}` === `${number}`) || getPlaceholderDancer());
      }
      return findGroupDancers(group, this.dancers)
        .sort(sortByKey('$number')); // order by dancer number
    },

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
      return isExpanded(this.scheduleExpandedDances[this.eventId], danceId, danceIds, true);
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
    AdminPlatforms,
    DancerListItem,
  },
};
</script>

<style lang="scss">
.competition-schedule {
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
.draw-dialog {
  .md-dialog-container {
    max-width: 100%;
  }
  .md-dialog-title {
    padding-bottom: 12px;
    margin-bottom: 0;
  }
  .md-dialog-content {
    padding: 16px;
    border: 0 solid transparent;
    border-width: 1px 0;
  }
  .dancer-list-item {
    .md-list-item-content {
      min-height: 48px;
    }
    .group {
      display: none;
    }
  }
}
</style>
