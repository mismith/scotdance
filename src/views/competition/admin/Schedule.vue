<template>
  <Blades class="AdminSchedule" :stacks="true">
    <template v-for="(blade, index) in blades">
      <Blade
        :key="blade.collection"
        id="blade-root"
        v-if="blade.parent()"
        class="xs12 md3 app-scroll alt"
      >
        <BladeToolbar
          v-if="index >= 1 && blade.item()"
          :to="getBladeRoute(blade.params())"
          :text="blades[index - 1].name(blades[index - 1].item())"
          class="hidden-sm-and-down"
        />
        <v-subheader class="layout">
          <v-flex style="text-transform: capitalize;">{{ blade.collection }}</v-flex>

          <PresetPicker
            v-if="blade.presets"
            :presets="blade.presets"
            :prop="blade.name"
            @select="items => items.map(item => handleListItemCreate(blade, item))"
          >
            <v-tooltip slot="activator" bottom>
              <v-btn slot="activator" flat fab small>
                <v-icon>playlist_add</v-icon>
              </v-btn>
              <span>Add preset(s)</span>
            </v-tooltip>
          </PresetPicker>

          <v-tooltip bottom>
            <v-btn slot="activator" flat fab small @click="handleListItemCreate(blade)">
              <v-icon>add</v-icon>
            </v-btn>
            <span>Add new item</span>
          </v-tooltip>
        </v-subheader>
        <v-list>
          <draggable
            :value="blade.items()"
            class="draggable"
            :options="{ handle: '.sortable-handle' }"
            @sort="handleListItemReorder(blade, $event)"
          >
            <v-list-tile
              v-for="item in blade.items()"
              :key="item[idKey]"
              :to="getBladeRoute(blade.params(item[idKey]))"
            >
              <v-icon class="sortable-handle">drag_indicator</v-icon>
              <v-list-tile-content>
                <v-list-tile-title>{{ blade.name(item) }}</v-list-tile-title>
              </v-list-tile-content>
              <v-icon>chevron_right</v-icon>
            </v-list-tile>
          </draggable>

          <v-list-tile v-if="!blade.items().length" class="empty">
            <v-list-tile-avatar>
              <v-icon>clear</v-icon>
            </v-list-tile-avatar>
            <span>No items yet. <a @click="handleListItemCreate(blade)">Add one.</a></span>
          </v-list-tile>
        </v-list>
      </Blade>
      <Blade
        :key="blade.collection"
        v-if="blade.item()"
        :id="`blade-${blade.id()}`"
        :class="`xs12 md${blade.size || 6} app-scroll`"
      >
        <form @submit.prevent class="pa-3">
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
        <div class="layout align-center justify-center flex-none">
          <v-btn flat color="error" @click="handleListItemRemove(blade)">
            Delete Item
          </v-btn>
        </div>
      </Blade>
    </template>
    <Blade v-if="!currentDay">
      <EmptyState
        icon="event_note"
        label="Edit schedule entries"
        description="Add or select an item to edit"
      />
    </Blade>

    <DialogCard
      :value="confirmCreate"
      title="Add new item:"
      @cancel="confirmCreate.reject()"
      @submit="confirmCreate.resolve()"
    >
      <div slot="text" class="app-scroll px-3">
        <v-text-field ref="confirmCreateValue" v-model="confirmCreateValue" label="Name" />
      </div>
      <v-card-actions slot="actions" class="justify-end">
        <v-btn flat @click="confirmCreate = false">Cancel</v-btn>

        <v-btn flat color="primary" type="submit">Add</v-btn>
      </v-card-actions>
    </DialogCard>
    <DialogCard
      :value="confirmRemove"
      title="Delete item"
      text="Are you sure you want to permanently delete this item?"
      cancel-label="No"
      submit-label="Yes"
      @cancel="confirmRemove.reject()"
      @submit="confirmRemove.resolve()"
    />
  </Blades>
</template>

<script>
import Draggable from 'vuedraggable';
import BladeToolbar from '@/components/BladeToolbar.vue';
import DynamicField from '@/components/admin/DynamicField.vue';
import NewDynamicField from '@/components/admin/NewDynamicField.vue';
import AdminPlatforms from '@/components/admin/Platforms.vue';
import PresetPicker from '@/components/admin/PresetPicker.vue';
import {
  idKey,
  db,
  toOrderedArray,
} from '@/helpers/firebase';
import { getScheduleItemDanceName } from '@/helpers/competition';

export default {
  name: 'AdminSchedule',
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
    dancers: Array,
    staff: Array,
    platforms: Array,
    schedule: Object,
  },
  data() {
    return {
      idKey,

      confirmCreate: undefined,
      confirmCreateValue: undefined,
      confirmRemove: undefined,

      blades: [
        {
          collection: 'days',
          parent: () => this.schedule,
          items: () => toOrderedArray(this.schedule.days),
          item: () => this.currentDay,
          id: () => this.dayId,
          params: itemId => ({ dayId: itemId }),
          name: item => item && item.name,
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
          parent: () => this.currentDay,
          items: () => toOrderedArray(this.currentDay.blocks),
          item: () => this.currentBlock,
          id: () => this.blockId,
          params: itemId => ({ dayId: this.dayId, blockId: itemId }),
          name: item => item && item.name,
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
          parent: () => this.currentBlock,
          items: () => toOrderedArray(this.currentBlock.events),
          item: () => this.currentEvent,
          id: () => this.eventId,
          params: itemId => ({ dayId: this.dayId, blockId: this.blockId, eventId: itemId }),
          name: item => item && item.name,
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
              name: 'Junior',
            },
            {
              name: 'Senior',
            },
          ],
        },
        {
          collection: 'dances',
          parent: () => this.currentEvent,
          items: () => toOrderedArray(this.currentEvent.dances),
          item: () => this.currentDance,
          id: () => this.danceId,
          params: itemId => ({
            dayId: this.dayId,
            blockId: this.blockId,
            eventId: this.eventId,
            danceId: itemId,
          }),
          name: item => item && getScheduleItemDanceName(item, this.dances),
          fields: [
            {
              data: 'danceId',
              title: 'Dance',
              type: 'select',
              presets: this.dances.map(dance => ({ text: dance.$name, value: dance[idKey] })),
            },
            {
              data: 'name',
              title: 'Name',
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
            {
              name: 'Results',
            },
            ...this.dances.map(dance => ({ danceId: dance[idKey] })),
          ],
          size: 9,
        },
      ],
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
      async handler(currentPath) {
        await this.$nextTick();
        const id = currentPath ? this.competitionDataRef.child(currentPath).key : 'root';
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
  },
  methods: {
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
        .find(item => blade.name(item) === blade.name(preset));
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

    async handleListItemCreate(blade, item = undefined) {
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
        this.goToBlade(params);
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
    NewDynamicField,
    AdminPlatforms,
    PresetPicker,
  },
};
</script>

<style lang="scss">
.AdminSchedule {
  .sortable-handle {
    margin-right: 8px;
  }
}
</style>
