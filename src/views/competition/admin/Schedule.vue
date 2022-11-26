<template>
  <Blades class="CompetitionAdminSchedule" stacks>
    <template v-for="(blade, index) in blades">
      <v-fade-transition :key="blade.collection">
        <Blade
          v-if="blade.parent()"
          :id="`blade-${blade.collection}`"
          class="col-md-3 app-scroll alt"
        >
          <BladeToolbar
            v-if="index >= 1 && blade.item()"
            :to="getBladeRoute(blade.params())"
            :text="blades[index - 1].name(blades[index - 1].item())"
            class="hidden-sm-and-down"
          />
          <v-subheader class="d-flex">
            <div class="flex" style="text-transform: capitalize;">
              {{ blade.collection }}

              <HelpTip v-if="blade.helpTip"><div v-html="blade.helpTip" /></HelpTip>
            </div>

            <PresetPicker
              v-if="blade.presets"
              ref="presetPicker"
              :presets="blade.presets"
              :prop="blade.name"
              @select="items => items.map(item => handleListItemCreate(blade, item, blade.items().length))"
            >
              <template #title>
                <v-card-title>
                  Select {{ blade.collection || 'preset' }}(s) to add:
                  <HelpTip v-if="blade.helpTip"><div v-html="blade.helpTip" /></HelpTip>
                </v-card-title>
              </template>
            </PresetPicker>

            <v-tooltip bottom>
              <template #activator="{ on }">
                <v-btn v-on="on" icon @click="handleListItemCreate(blade)">
                  <v-icon>{{ mdiPlus }}</v-icon>
                </v-btn>
              </template>
              <span>Add new item</span>
            </v-tooltip>
          </v-subheader>
          <v-list avatar>
            <draggable
              :value="blade.items()"
              class="draggable"
              handle=".sortable-handle"
              @sort="handleListItemReorder(blade, $event)"
            >
              <v-slide-y-transition group hide-on-leave>
                <v-list-item
                  v-for="item in blade.items()"
                  :key="item[idKey]"
                  :to="getBladeRoute(blade.params(item[idKey]))"
                >
                  <v-icon class="sortable-handle">{{ mdiDragVertical }}</v-icon>
                  <v-list-item-content>
                    <v-list-item-title>{{ blade.name(item) }}</v-list-item-title>
                  </v-list-item-content>
                  <v-icon>{{ mdiChevronRight }}</v-icon>
                </v-list-item>
              </v-slide-y-transition>
            </draggable>

            <v-list-item v-show="!blade.items().length" class="empty">
              <v-list-item-avatar>
                <v-icon>{{ mdiClose }}</v-icon>
              </v-list-item-avatar>
              <v-list-item-content>
                <div>
                  No items yet.
                  <PresetPicker
                    v-if="blade.presets"
                    :presets="blade.presets"
                    :prop="blade.name"
                    @select="items => items.map(item => handleListItemCreate(blade, item, blade.items().length))"
                  >
                    <template #activator="{ on }">
                      <a v-on="on">Add one.</a>
                    </template>
                  </PresetPicker>
                  <a v-else @click="handleListItemCreate(blade)">Add one.</a>
                </div>
              </v-list-item-content>
            </v-list-item>
          </v-list>

          <template v-if="!index">
            <v-spacer />
            <v-toolbar class="flex-none">
              <v-switch
                :input-value="isTabDisabled"
                label="Hide schedule tab"
                hide-details
                :readonly="!hasNoExistingTabData && !isTabDisabled"
                @click="handleTabDisable"
                @change="handleTabDisable"
              />
            </v-toolbar>
          </template>
        </Blade>
      </v-fade-transition>
      <v-fade-transition :key="blade.collection">
        <Blade
          v-if="blade.item()"
          :id="`blade-${blade.id()}`"
          :class="`col-md-${blade.size || 6} app-scroll`"
        >
          <form @submit.prevent class="pa-4">
            <DynamicField
              v-for="field in blade.fields"
              :key="field.data"
              :field="field"
              :data="blade.item()"
              @change="handleListItemUpdate(blade, blade.id(), blade.item())"
            />
            <AdminPlatforms
              v-if="blade.collection === 'dances' && currentDance.danceId"
              :path="currentPath"
              :item="currentDance"
              :platforms="platforms"
              :groups="groups"
              :dances="dances"
              :dancers="dancers"
              :staff="staff"
              @change="handlePlatformChanges"
            />
          </form>

          <v-spacer />
          <footer class="d-flex align-center justify-center flex-none pa-3">
            <v-btn
              v-if="getPrevBlade(blade)"
              :disabled="getPrevBlade(blade).items().length < 2"
              text
              color="primary"
              @click="handleListItemMove(blade, getPrevBlade(blade))"
            >
              Move Item
            </v-btn>
            <v-btn text color="error" @click="handleListItemRemove(blade)">
              Delete Item
            </v-btn>
          </footer>
        </Blade>
      </v-fade-transition>
    </template>
    <Blade v-if="!currentDay" class="col-md-9">
      <EmptyState
        :icon="mdiCalendarSearch"
        label="Build out your event schedule"
      >
        <p>
          To get started you can:
        </p>
        <div>
          <v-btn
            color="primary"
            class="ma-1"
            @click="$refs.presetPicker[0].show()"
          >
            <v-icon class="mr-2">{{ mdiPlaylistPlus }}</v-icon>
            Add preset(s)
          </v-btn>
        </div>
      </EmptyState>
    </Blade>

    <DialogCard
      :value="confirmDisable"
      title="Hide schedule tab"
      text="Are you sure you want to permanently delete all existing schedule data, and publicly hide the Schedule tab for this competition?"
      cancel-label="No"
      submit-label="Yes"
      @cancel="confirmDisable.reject()"
      @submit="confirmDisable.resolve()"
    />
    <DialogCard
      :value="confirmCreate"
      title="Add new item:"
      cancel-label="Cancel"
      submit-label="Add"
      @cancel="confirmCreate.reject()"
      @submit="confirmCreate.resolve()"
    >
      <template #text>
        <div class="app-scroll px-4">
          <v-text-field ref="confirmCreateValue" v-model="confirmCreateValue" label="Name" />
        </div>
      </template>
    </DialogCard>
    <DialogCard
      :value="confirmMove"
      title="Move item"
      text="Where would you like to move this item?"
      cancel-label="Cancel"
      submit-label="Move"
      :disabled="!confirmMoveValue"
      @cancel="confirmMove.reject()"
      @submit="confirmMove.resolve()"
    >
      <template #text>
        <v-radio-group
          v-if="confirmMove"
          v-model="confirmMoveValue"
          class="app-scroll px-4"
        >
          <v-radio
            v-for="item in confirmMove.prevBlade.items()"
            :key="item[idKey]"
            :label="confirmMove.prevBlade.name(item)"
            :value="item[idKey]"
            :disabled="item[idKey] === confirmMove.prevBlade.id()"
          />
        </v-radio-group>
      </template>
    </DialogCard>
    <DialogCard
      :value="confirmRemove"
      title="Delete item"
      text="Are you sure you want to permanently delete this item (and all of its subitems)?"
      cancel-label="No"
      submit-label="Yes"
      @cancel="confirmRemove.reject()"
      @submit="confirmRemove.resolve()"
    />
  </Blades>
</template>

<script>
import Draggable from 'vuedraggable';
import {
  mdiCalendarSearch,
  mdiChevronRight,
  mdiClose,
  mdiDragVertical,
  mdiPlaylistPlus,
  mdiPlus,
} from '@mdi/js';
import BladeToolbar from '@/components/BladeToolbar.vue';
import DynamicField from '@/components/admin/DynamicField.vue';
import AdminPlatforms from '@/components/admin/Platforms.vue';
import PresetPicker from '@/components/admin/PresetPicker.vue';
import HelpTip from '@/components/HelpTip.vue';
import {
  idKey,
  db,
  toOrderedArray,
} from '@/helpers/firebase';
import {
  getScheduleItemDanceName,
} from '@/helpers/competition';
import {
  mapRouteParams,
} from '@/helpers/router';
import {
  hasNoExistingTabData,
  isTabDisabled,
  handleTabDisable,
} from '@/helpers/tab';

export default {
  name: 'CompetitionAdminSchedule',
  reactiveInject: {
    competitionBundle: [
      'groups',
      'dances',
      'dancers',
      'staff',
      'platforms',
      'schedule',
    ],
  },
  data() {
    return {
      idKey,
      mdiCalendarSearch,
      mdiChevronRight,
      mdiClose,
      mdiDragVertical,
      mdiPlaylistPlus,
      mdiPlus,

      confirmDisable: undefined,
      confirmCreate: undefined,
      confirmCreateValue: undefined,
      confirmMove: undefined,
      confirmMoveValue: undefined,
      confirmRemove: undefined,

      blades: [
        {
          collection: 'days',
          helpTip: `The <strong>day of the week</strong> your event takes place.<br />
            <br />
            Generally there is only one day per competition, but it's possible to split all the events over multiple days too.`,
          parent: () => this.schedule,
          items: () => toOrderedArray(this.schedule.days),
          item: () => this.currentDay,
          id: () => this.dayId,
          params: (itemId) => ({ dayId: itemId }),
          name: (item) => item && item.name,
          fields: [
            {
              data: 'name',
              title: 'Name',
              required: true,
            },
            {
              data: 'description',
              title: 'Description',
              type: 'textarea',
            },
          ],
          presets: [
            {
              name: 'Saturday',
            },
            {
              name: 'Sunday',
            },
          ],
        },
        {
          collection: 'blocks',
          helpTip: `The <strong>sections of the day</strong> that group different events together.<br />
            <br />
            Often blocks will have their own start time and/or results ceremony. They break up a full day event into smaller, discrete chunks.`,
          parent: () => this.currentDay,
          items: () => toOrderedArray(this.currentDay.blocks),
          item: () => this.currentBlock,
          id: () => this.blockId,
          params: (itemId) => ({ dayId: this.dayId, blockId: itemId }),
          name: (item) => item && item.name,
          fields: [
            {
              data: 'name',
              title: 'Name',
              required: true,
            },
            {
              data: 'description',
              title: 'Description',
              type: 'textarea',
            },
          ],
          presets: [
            {
              name: 'Morning',
            },
            {
              name: 'Afternoon',
            },
            {
              name: 'Evening',
            },
          ],
        },
        {
          collection: 'events',
          helpTip: `Groupings of <strong>similar ages/categories</strong>—all of which generally perform the same dances.<br />
            <br />
            Events can also be used for "special" cases like category-spanning or feature dances.`,
          parent: () => this.currentBlock,
          items: () => toOrderedArray(this.currentBlock.events),
          item: () => this.currentEvent,
          id: () => this.eventId,
          params: (itemId) => ({ dayId: this.dayId, blockId: this.blockId, eventId: itemId }),
          name: (item) => item && item.name,
          fields: [
            {
              data: 'name',
              title: 'Name',
              required: true,
            },
            {
              data: 'description',
              title: 'Description',
              type: 'textarea',
            },
          ],
          presets: [
            {
              name: 'Primary',
            },
            {
              name: 'Pre-Premier',
            },
            {
              name: 'Premier',
            },
            {
              name: 'Primary/Beginner/Novice',
            },
            {
              name: 'Intermediate/Premier',
            },
            {
              name: 'Junior',
            },
            {
              name: 'Senior',
            },
          ],
        },
        {
          collection: 'dances',
          helpTip: `The list of <strong>dances and/or ceremonies</strong> that comprise each event.<br />
            <br />
            Dances you've input in the Dances tab for this competition will appear here and should each be added in the order they will be performed. You should likely call out when Results will happen (generally at the end), and, if there is a Registration window, you can put that first, too.`,
          parent: () => this.currentEvent,
          items: () => toOrderedArray(this.currentEvent.dances),
          item: () => this.currentDance,
          id: () => this.danceId,
          params: (itemId) => ({
            dayId: this.dayId,
            blockId: this.blockId,
            eventId: this.eventId,
            danceId: itemId,
          }),
          name: (item) => item && getScheduleItemDanceName(item, this.dances),
          fields: [
            {
              data: 'danceId',
              title: 'Dance',
              type: 'select',
              presets: this.dances.map((dance) => ({ text: dance.$name, value: dance[idKey] })),
              clearable: true,
            },
            {
              data: 'name',
              title: 'Name',
              description: '(optional) Use a custom name (i.e. when not linked to a specific dance in the Dances tab)',
            },
            {
              data: 'description',
              title: 'Description',
              type: 'textarea',
            },
          ],
          presets: [
            {
              name: 'Registration',
            },
            ...this.dances.map((dance) => ({ danceId: dance[idKey] })),
            {
              name: 'Results',
            },
          ],
          size: 9,
        },
      ],
    };
  },
  computed: {
    ...mapRouteParams([
      'dayId',
      'blockId',
      'eventId',
      'danceId',
    ]),

    hasNoExistingTabData() {
      return hasNoExistingTabData(this.schedule);
    },
    isTabDisabled() {
      return isTabDisabled(this.schedule);
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
    currentDance() {
      if (this.danceId && this.currentEvent && this.currentEvent.dances) {
        return this.currentEvent.dances[this.danceId];
      }
      return null;
    },

    currentPath() {
      return this.getPath(this);
    },
  },
  watch: {
    currentPath: {
      async handler(currentPath, previousPath) {
        const pathPieces = currentPath.split('/');
        if (!pathPieces.length >= 2) return;
        const id = (currentPath || '').length > (previousPath || '').length
          ? pathPieces[pathPieces.length - 1]
          : pathPieces[pathPieces.length - 2];

        await this.$nextTick();
        const element = document.getElementById(`blade-${id}`);
        this.$scrollTo(element, {
          container: this.$el,
          x: true,
          y: true,
        });
      },
      immediate: true,
    },
    async confirmCreate(confirmCreate) {
      if (!confirmCreate) {
        this.confirmCreateValue = undefined;
      } else {
        await this.$nextTick();
        this.$refs.confirmCreateValue.focus();
      }
    },
    async confirmMove(confirmMove) {
      if (!confirmMove) {
        this.confirmMoveValue = undefined;
      }
    },
  },
  methods: {
    async handleTabDisable() {
      await handleTabDisable('schedule', this);
    },

    getPath({
      dayId,
      blockId,
      eventId,
      danceId,
    }) {
      const pathProps = [
        ['days', dayId],
        ['blocks', blockId],
        ['events', eventId],
        ['dances', danceId],
      ];
      const path = pathProps
        .filter(([collection, id]) => collection && id)
        .map(([collection, id]) => `${collection}/${id}`)
        .join('/');

      return path && `schedule/${path}`;
    },
    isBladePresetUsed(blade, preset) {
      const items = blade.items();
      return items && items
        .find((item) => blade.name(item) === blade.name(preset));
    },
    getPrevBlade(blade) {
      const bladeIndex = this.blades.findIndex((b) => b.collection === blade.collection);
      const prevBlade = this.blades[bladeIndex - 1];
      return prevBlade;
    },
    getBladeRoute(params) {
      return {
        name: this.$route.name,
        params: {
          dayId: null,
          blockId: null,
          eventId: null,
          danceId: null,
          ...params,
        },
      };
    },
    goToBlade(params) {
      this.$router.push(this.getBladeRoute(params));
    },

    async handleListItemCreate(blade, item = undefined, skipRedirect = false) {
      try {
        const itemId = db.push().key;
        const params = blade.params(itemId);
        const path = this.getPath(params);

        if (!item) {
          await new Promise((resolve, reject) => {
            this.confirmCreate = { resolve, reject };
          });
          item = { // eslint-disable-line no-param-reassign
            name: this.confirmCreateValue,
          };
        }

        this.$emit('change', {
          [path]: item,
        });

        // redirect
        if (!skipRedirect) this.goToBlade(params);
      } catch (err) {
        if (err) console.error(err); // eslint-disable-line no-console
      } finally {
        this.confirmCreate = null;
        this.confirmCreateValue = undefined;
      }
    },
    handleListItemUpdate(blade, itemId, item) {
      const path = this.getPath(blade.params(itemId));
      const clone = {
        ...item,
      };
      delete clone[idKey];

      // strip undefineds
      Object.entries(clone).forEach(([k, v]) => {
        if (v === undefined) {
          clone[k] = null;
        }
      });

      this.$emit('change', {
        [path]: clone,
      });
    },
    async handleListItemMove(blade, prevBlade) {
      try {
        await new Promise((resolve, reject) => {
          this.confirmMove = {
            resolve,
            reject,
            blade,
            prevBlade,
          };
        });

        if (this.confirmMoveValue) {
          const from = blade.params(blade.id());
          const to = {
            ...from,
            ...prevBlade.params(this.confirmMoveValue),
          };
          this.$emit('change', {
            [this.getPath(from)]: null, // remove old
            [this.getPath(to)]: blade.item(), // add new/moved
          });

          // redirect
          this.goToBlade(to);
        }
      } catch (err) {
        if (err) console.error(err); // eslint-disable-line no-console
      } finally {
        this.confirmMove = null;
      }
    },
    async handleListItemRemove(blade) {
      try {
        await new Promise((resolve, reject) => {
          this.confirmRemove = { resolve, reject };
        });

        const itemId = blade.id();
        const path = this.getPath(blade.params(itemId));
        this.$emit('change', {
          [path]: null,
        });

        // redirect
        this.goToBlade(blade.params());
      } catch (err) {
        if (err) console.error(err); // eslint-disable-line no-console
      } finally {
        this.confirmRemove = null;
      }
    },

    handleListItemReorder(blade, { oldIndex, newIndex }) {
      const items = blade.items();
      items.splice(newIndex, 0, items.splice(oldIndex, 1)[0]);

      const changes = {};
      items.forEach((item, order) => {
        const params = blade.params(item[idKey]);
        const path = this.getPath(params);
        changes[`${path}/order`] = order;
      });

      this.$emit('change', changes);
    },

    handlePlatformChanges(changes) {
      // bubble up
      this.$emit('change', changes);
    },
  },
  components: {
    Draggable,
    BladeToolbar,
    DynamicField,
    AdminPlatforms,
    PresetPicker,
    HelpTip,
  },
};
</script>

<style lang="scss">
.CompetitionAdminSchedule {
  .sortable-handle {
    margin-right: 8px;
  }
}
</style>
