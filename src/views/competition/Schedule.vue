<template>
  <Blades class="CompetitionSchedule alt">
    <Blade
      :active="!currentEvent"
      v-persist-scroll="`/competitions/${competitionId}/schedule`"
      class="xs12 md4 app-scroll"
    >
      <div v-if="schedule.days">
        <div v-for="day in toOrderedArray(schedule.days)" :key="day[idKey]">
          <v-subheader class="title">
            {{ day.name || $moment(day.date).format('dddd') }}
          </v-subheader>
          <div
            v-if="day.description"
            v-html="day.description"
            class="pa-3 pre-line"
          />

          <v-list expand class="grouped">
            <v-list-group
              v-for="block in toOrderedArray(day.blocks)"
              :key="block[idKey]"
              lazy
              :value="isBlockExpanded(block[idKey], Object.keys(day.blocks), !!block.events)"
              @input="handleBlockExpanded(block[idKey], $event)"
            >
              <v-subheader slot="activator">
                <v-flex>{{ block.name }}</v-flex>
                <div class="caption">{{ textify(block.description) }}</div>
              </v-subheader>

              <v-list two-line>
                <v-list-tile
                  v-for="event in toOrderedArray(block.events)"
                  :key="event[idKey]"
                  :to="{
                    name: $route.name,
                      params: {
                      dayId: day[idKey],
                      blockId: block[idKey],
                      eventId: event[idKey],
                    },
                  }"
                  :class="{ active: isActive(day[idKey], block[idKey], event[idKey]) }"
                >
                  <v-list-tile-content>
                    <v-list-tile-title>{{ event.name }}</v-list-tile-title>
                    <v-list-tile-sub-title>{{ textify(event.description) }}</v-list-tile-sub-title>
                  </v-list-tile-content>
                  <v-icon v-if="event.dances || event.description">chevron_right</v-icon>
                </v-list-tile>
                <v-list-tile v-if="!block.events" class="empty">
                  <v-list-tile-avatar>
                    <v-icon>clear</v-icon>
                  </v-list-tile-avatar>
                  No more info.
                </v-list-tile>
              </v-list>
            </v-list-group>
            <v-list-tile v-if="!day.blocks" class="empty">
              <v-list-tile-avatar>
                <v-icon>clear</v-icon>
              </v-list-tile-avatar>
              No more info.
            </v-list-tile>
          </v-list>
        </div>
      </div>
      <EmptyState
        v-else
        icon="clear"
        label="No schedule yet"
        description="Check back later"
      />
    </Blade>
    <Blade :active="currentEvent" class="xs12 md8">
      <div v-if="currentEvent" class="app-scroll-frame">
        <BladeToolbar
          :to="{ name: $route.name, params: { competitionId } }"
          :text="`${currentDay.name} &rsaquo; ${currentBlock.name}`"
          class="hidden-md-and-up"
        />

        <div
          v-persist-scroll="`/competitions/${competitionId}/schedule/${dayId}/${blockId}/${eventId}`"
          class="app-scroll-frame app-scroll"
        >
          <header>
            <v-subheader class="title">{{ currentEvent.name }}</v-subheader>
            <div
              v-if="currentEvent.description"
              v-html="currentEvent.description"
              class="pa-3 pre-line"
            />
          </header>

          <v-list expand class="grouped">
            <v-list-group
              v-for="dance in toOrderedArray(currentEvent.dances)"
              :key="dance[idKey]"
              lazy
              :value="isDanceExpanded(dance[idKey], Object.keys(currentEvent.dances), !!dance.danceId)"
              @input="handleDanceExpanded(dance[idKey], $event)"
            >
              <v-subheader slot="activator">
                <v-flex>{{ getScheduleItemDanceName(dance, dances) }}</v-flex>
                <div
                  v-if="dance.description"
                  v-html="dance.description"
                  class="caption"
                />
              </v-subheader>

              <AdminPlatforms
                :item="dance"
                :groups="groups"
                :dances="dances"
                :dancers="dancers"
                :staff="staff"
                :platforms="platforms"
                @item-click="handlePlatformClick($event, dance)"
              />
            </v-list-group>
            <v-list-tile v-if="!currentEvent.dances && !currentEvent.description" class="empty">
              <v-list-tile-avatar>
                <v-icon>clear</v-icon>
              </v-list-tile-avatar>
              No more info.
            </v-list-tile>
          </v-list>
        </div>

        <DialogCard v-model="drawVisible">
          <v-card-title v-if="currentDialogData" slot="title" class="layout column align-start">
            <div class="title">Draw / Order</div>
            <div v-if="currentDialogData.dance && currentDialogData.group" class="caption">
              {{ currentDialogData.dance.$shortName }} • {{ currentDialogData.group.$name }}
            </div>
          </v-card-title>

          <v-card-text slot="text" class="pa-0">
            <v-list
              v-if="currentDialogData && currentDialogData.dance && currentDialogData.group"
              two-line
            >
              <DancerListItem
                v-for="dancer in findDrawnDancers(currentDialogData.group, currentDialogData.dance)"
                :key="dancer[idKey]"
                :dancer="dancer"
                @click="$router.push({ name: 'competition.dancers', params: { dancerId: dancer[idKey] } }); drawVisible = false;"
              />
            </v-list>
          </v-card-text>
        </DialogCard>
      </div>
      <EmptyState
        v-else
        icon="touch_app"
        label="See event details"
        description="Select an event"
      />
    </Blade>
  </Blades>
</template>

<script>
import {
  mapState,
  mapMutations,
} from 'vuex';
import AdminPlatforms from '@/components/admin/Platforms.vue';
import DancerListItem from '@/components/DancerListItem.vue';
import BladeToolbar from '@/components/BladeToolbar.vue';
import {
  idKey,
  toOrderedArray,
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
  name: 'CompetitionSchedule',
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
    toOrderedArray,
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

    handlePlatformClick(item, dance) {
      if (item.type) {
        this.setCurrentDialog(['staff', item]);
      } else {
        this.setCurrentDialog(['draw', {
          group: item,
          dance: findByIdKey(this.dances, dance.danceId),
        }]);
      }
    },

    isBlockExpanded(blockId, blockIds, fallback = true) {
      return isExpanded(this.scheduleExpandedBlocks, blockId, blockIds, fallback);
    },
    handleBlockExpanded(blockId, expanded) {
      this.scheduleExpandedBlocks = handleExpanded(this.scheduleExpandedBlocks, blockId, expanded);
      this.$localStorage.set('scheduleExpandedBlocks', this.scheduleExpandedBlocks);
    },

    isDanceExpanded(danceId, danceIds, fallback = true) {
      return isExpanded(this.scheduleExpandedDances[this.eventId], danceId, danceIds, fallback);
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
    BladeToolbar,
  },
};
</script>

<style lang="scss">
.CompetitionSchedule {
  .AdminPlatforms {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
