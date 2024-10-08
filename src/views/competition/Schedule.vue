<template>
  <div class="CompetitionSchedule alt app-scroll-frame">
    <Blades v-if="schedule.days">
      <Blade
        :active="!currentEvent"
        v-persist-scroll="`/competitions/${competitionId}/schedule`"
        class="col-md-4 app-scroll"
      >
        <div v-for="day in toOrderedArray(schedule.days)" :key="day[idKey]">
          <v-subheader class="title">
            {{ day.name || $moment(day.date).format('dddd') }}
          </v-subheader>
          <div
            v-if="day.description"
            v-html="$sanitize(day.description)"
            class="pa-4 pre-line"
          />

          <v-list expand class="grouped">
            <v-list-group
              v-for="block in toOrderedArray(day.blocks)"
              :key="block[idKey]"
              :value="isBlockExpanded(block[idKey], Object.keys(day.blocks), !!block.events)"
            >
              <template #activator>
                <v-subheader @click.stop="handleBlockExpanded(block[idKey], !isBlockExpanded(block[idKey], Object.keys(day.blocks), !!block.events))">
                  <div class="flex">{{ block.name }}</div>
                  <div
                    v-if="block.description"
                    v-html="$sanitize(slugline(block.description))"
                    class="caption text-truncate ml-3"
                  />
                </v-subheader>
              </template>

              <v-list two-line>
                <v-list-item
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
                  <v-list-item-content>
                    <v-list-item-title>{{ event.name }}</v-list-item-title>
                    <v-list-item-subtitle v-html="$sanitize(slugline(event.description))" />
                  </v-list-item-content>
                  <v-icon v-if="event.dances || event.description">
                    {{ mdiChevronRight }}
                  </v-icon>
                </v-list-item>
                <v-list-item v-if="!block.events" class="empty">
                  <v-list-item-avatar>
                    <v-icon>{{ mdiClose }}</v-icon>
                  </v-list-item-avatar>
                  <v-list-item-content>
                    No more info.
                  </v-list-item-content>
                </v-list-item>
              </v-list>
            </v-list-group>
            <v-list-item v-if="!day.blocks && !day.description" class="empty">
              <v-list-item-avatar>
                <v-icon>{{ mdiClose }}</v-icon>
              </v-list-item-avatar>
              <v-list-item-content>
                No more info.
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </div>
      </Blade>
      <Blade :active="currentEvent" class="col-md-8">
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
                v-html="$sanitize(currentEvent.description)"
                class="pa-4 pre-line"
              />
            </header>

            <v-list expand class="grouped">
              <template v-for="dance in toOrderedArray(currentEvent.dances)">
                <v-subheader :key="dance[idKey]" v-if="!isDanceExpandable(dance)">
                  {{ getScheduleItemDanceName(dance, dances) }}
                </v-subheader>
                <v-list-group
                  :key="dance[idKey]"
                  v-else
                  :value="isDanceExpanded(dance[idKey], Object.keys(currentEvent.dances), !!dance.danceId)"
                >
                  <template #activator>
                    <v-subheader @click.stop="handleDanceExpanded(dance[idKey], !isDanceExpanded(dance[idKey], Object.keys(currentEvent.dances), !!dance.danceId))">
                      <div class="flex">{{ getScheduleItemDanceName(dance, dances) }}</div>
                      <div
                        v-if="dance.description"
                        v-html="$sanitize(slugline(dance.description))"
                        class="caption text-truncate ml-3"
                      />
                    </v-subheader>
                  </template>

                  <v-sheet>
                    <v-list-item
                      v-if="dance.description"
                      v-html="$sanitize(dance.description)"
                      class="pa-4 pre-line"
                    />
                    <AdminPlatforms
                      v-if="dance.danceId"
                      :item="dance"
                      :groups="groups"
                      :dances="dances"
                      :dancers="dancers"
                      :staff="staff"
                      :platforms="platforms"
                      @item-click="handlePlatformClick($event, dance)"
                    />
                  </v-sheet>
                </v-list-group>
              </template>
              <v-list-item v-if="!currentEvent.dances && !currentEvent.description" class="empty">
                <v-list-item-avatar>
                  <v-icon>{{ mdiClose }}</v-icon>
                </v-list-item-avatar>
                <v-list-item-content>
                  No more info.
                </v-list-item-content>
              </v-list-item>
            </v-list>
          </div>

          <DialogCard v-model="drawVisible">
            <template #title>
              <v-card-title v-if="currentDialogData" class="d-flex flex-column align-start">
                <div class="title">Dancer {{ getDraw(currentDialogData.group, currentDialogData.dance) ? 'Draw' : 'Order' }}</div>
                <div v-if="currentDialogData.dance && currentDialogData.group" class="caption">
                  {{ currentDialogData.dance.$shortName }} • {{ currentDialogData.group.$name }}
                </div>
              </v-card-title>
            </template>
            <template #text>
              <v-card-text class="pa-0">
                <v-list
                  v-if="currentDialogData && currentDialogData.dance && currentDialogData.group"
                  two-line
                >
                  <DancerListItem
                    v-for="dancer in findDrawnDancers(currentDialogData.group, currentDialogData.dance)"
                    :key="dancer[idKey]"
                    :dancer="{ ...dancer, $group: undefined }"
                    class="DancerListItem--draw"
                    @click="$router.push({ name: 'competition.dancers', params: { dancerId: dancer[idKey] } }); drawVisible = false;"
                  />
                </v-list>
              </v-card-text>
            </template>
          </DialogCard>
        </div>
        <EmptyState
          v-else
          :icon="mdiGestureTap"
          label="See event details"
          description="Select an event"
        />
      </Blade>
    </Blades>

    <EmptyState
      v-else-if="isTabDisabled"
      :icon="mdiCardBulletedOffOutline"
      label="No schedule"
      description="Please see competition organizer for more information"
    />

    <EmptyState
      v-else
      :icon="mdiClose"
      label="No schedule yet"
      description="Check back later"
    />
  </div>
</template>

<script>
import {
  mapState,
  mapMutations,
} from 'vuex';
import {
  mdiChevronRight,
  mdiClose,
  mdiCardBulletedOffOutline,
  mdiGestureTap,
} from '@mdi/js';
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
  mapRouteParams,
} from '@/helpers/router';
import {
  slugline,
  findByIdKey,
  sortByKey,
  getScheduleItemDanceName,
} from '@/helpers/competition';
import {
  getPlaceholderDancer,
  findGroupDancers,
} from '@/helpers/results';
import {
  isTabDisabled,
} from '@/helpers/tab';

export default {
  name: 'CompetitionSchedule',
  reactiveInject: {
    competitionBundle: [
      'competitionId',
      'groups',
      'dances',
      'dancers',
      'staff',
      'platforms',
      'draws',
      'schedule',
    ],
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
      mdiChevronRight,
      mdiClose,
      mdiCardBulletedOffOutline,
      mdiGestureTap,
    };
  },
  computed: {
    ...mapState([
      'currentDialog',
      'currentDialogData',
    ]),
    ...mapRouteParams([
      'dayId',
      'blockId',
      'eventId',
      'danceId',
    ]),

    isTabDisabled() {
      return isTabDisabled(this.schedule);
    },

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
    slugline,
    findByIdKey,
    toOrderedArray,
    getScheduleItemDanceName,

    ...mapMutations([
      'setCurrentDialog',
    ]),

    getDraw(group, dance) {
      return this.draws?.[group?.[idKey]]?.[dance?.[idKey]];
    },
    findDrawnDancers(group, dance) {
      const draw = this.getDraw(group, dance);
      if (draw) {
        return draw // order by draw order
          .map((number) => this.dancers.find((dancer) => `${dancer.number}` === `${number}`) || getPlaceholderDancer());
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

    isDanceExpandable(dance) {
      const dancePlatformIds = dance.platforms ? Object.keys(dance.platforms) : [];
      return dance.description || (
        // ensure it has (valid, i.e. not outdated) platforms
        dance.danceId
        && dancePlatformIds.length
        && this.platforms.some((platform) => dancePlatformIds.includes(platform[idKey]))
      );
    },
    isDanceExpanded(danceId, danceIds, fallback = true) {
      return isExpanded(this.scheduleExpandedDances[this.eventId], danceId, danceIds, fallback);
    },
    handleDanceExpanded(danceId, expanded) {
      this.scheduleExpandedDances = {
        ...this.scheduleExpandedDances,
        [this.eventId]: handleExpanded(
          this.scheduleExpandedDances[this.eventId],
          danceId,
          expanded,
        ),
      };
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
