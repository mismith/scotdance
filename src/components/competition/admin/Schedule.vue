<template>
  <blades class="admin-schedule" :stacks="true">
    <template v-for="blade in blades">
      <blade
        :key="blade.collection"
        id="blade-root"
        v-if="blade.parent()"
        class="xs12 md3 app-scroll alt"
      >
        <v-list expand class="grouped">
          <v-list-group :value="true">
            <v-subheader slot="activator" style="text-transform: capitalize;">
              {{ blade.collection }}
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
                  :class="{ active: blade.id() === item[idKey] }"
                  @click="goToBlade(blade.params(item[idKey]))"
                >
                  <v-icon class="sortable-handle">drag_indicator</v-icon>
                  <v-list-tile-content>
                    <v-list-tile-title>{{ blade.name(item) }}</v-list-tile-title>
                  </v-list-tile-content>
                  <v-icon>chevron_right</v-icon>
                </v-list-tile>
              </draggable>
            </v-list>
          </v-list-group>
          <v-list-group :value="true">
            <v-subheader slot="activator">Add New</v-subheader>

            <v-list>
              <new-dynamic-field @change="handleListItemCreate(blade, $event)" />
              <v-divider v-if="blade.presets" />
              <v-list-tile
                v-for="preset in blade.presets"
                :key="blade.name(preset)"
                :class="{ dimmed: isBladePresetUsed(blade, preset) }"
                @click="handleListItemCreate(blade, preset)"
              >
                <v-list-tile-content>
                  <v-list-tile-title>{{ blade.name(preset) }}</v-list-tile-title>
                </v-list-tile-content>
                <v-icon>add</v-icon>
              </v-list-tile>
            </v-list>
          </v-list-group>
        </v-list>
      </blade>
      <blade
        :key="blade.collection"
        v-if="blade.item()"
        :id="`blade-${blade.id()}`"
        :class="`xs12 md${blade.size || 6} app-scroll`"
      >
        <form @submit.prevent class="pa-3">
          <dynamic-field
            v-for="field in blade.fields"
            :key="field.data"
            :field="field"
            :data="blade.item()"
            @change="handleListItemUpdate(blade, blade.id(), blade.item())"
          />
          <admin-platforms
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
        <v-layout align-center justify-center>
          <v-btn flat color="error" @click="confirmRemove = { blade, itemId: blade.id() }">
            Delete Item
          </v-btn>
        </v-layout>
      </blade>
    </template>
    <blade v-if="!currentDay">
      <empty-state
        icon="event_note"
        label="Edit schedule entries"
        description="Add or select an item to edit"
      />
    </blade>

    <md-dialog-confirm
      :md-active.sync="confirmRemove"
      md-title="Delete item"
      md-content="Are you sure you want to permanently delete this item?"
      md-confirm-text="Yes"
      md-cancel-text="No"
      @md-confirm="handleListItemRemove(confirmRemove.blade, confirmRemove.itemId)"
    />
  </blades>
</template>

<script>
import Draggable from 'vuedraggable';
import DynamicField from '@/components/admin/utility/DynamicField.vue';
import NewDynamicField from '@/components/admin/utility/NewDynamicField.vue';
import AdminPlatforms from '@/components/competition/admin/utility/Platforms.vue';
import {
  idKey,
  db,
  toOrderedArray,
} from '@/helpers/firebase';
import { getScheduleItemDanceName } from '@/helpers/competition';

export default {
  name: 'admin-schedule',
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

      confirmRemove: false,

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
            dayId: this.dayId, blockId: this.blockId, eventId: this.eventId, danceId: itemId,
          }),
          name: item => item && getScheduleItemDanceName(item, this.dances),
          fields: [
            {
              data: 'name',
              title: 'Name',
            },
            {
              data: 'description',
              title: 'Description',
              type: 'textarea',
            },
            {
              data: 'danceId',
              title: 'Dance',
              type: 'select',
              presets: this.dances,
            },
          ],
          presets: this.dances.map(dance => ({ danceId: dance[idKey] })),
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
  },
  methods: {
    getPath({
      dayId, blockId, eventId, danceId,
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
    goToBlade(params) {
      this.$router.push({
        name: this.$route.name,
        params: {
          dayId: null,
          blockId: null,
          eventId: null,
          danceId: null,
          ...params,
        },
      });
    },

    handleListItemCreate(blade, item) {
      const params = blade.params(db.push().key);
      const path = this.getPath(params);
      this.$emit('change', {
        [path]: item,
      });

      // redirect
      this.goToBlade(params);
    },
    handleListItemRemove(blade, itemId) {
      const path = this.getPath(blade.params(itemId));
      this.$emit('change', {
        [path]: null,
      });

      // redirect
      this.goToBlade(blade.params());
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
    DynamicField,
    NewDynamicField,
    AdminPlatforms,
  },
};
</script>

<style lang="scss">
.admin-schedule {
  .blade {
    .sortable-handle {
      margin-right: 8px;
    }
  }
  .dimmed {
    opacity: 0.5;
  }
}
</style>
