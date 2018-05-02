<template>
  <div class="admin-schedule md-scroll-frame">
    <div class="md-layout admin-blades">
      <div class="md-layout-item md-size-50 md-scroll admin-blade">
        <admin-list
          :items-ref="competitionDataRef.child('schedule/days')"
          items-type="Day"
          @create="handleListItemCreate('schedule/days', $event)"
        >
          <admin-list-item
            slot-scope="day"
            :item="day"
            @click.stop="handleListItemSelect({ dayId: day[idKey] })"
            @remove="handleListItemRemove('schedule/days', day)"
          >
            <admin-list
              :items-ref="competitionDataRef.child(`schedule/days/${day[idKey]}/blocks`)"
              items-type="Block"
              @create="handleListItemCreate(`schedule/days/${day[idKey]}/blocks`, $event)"
            >
              <admin-list-item
                slot-scope="block"
                :item="block"
                @click.stop="handleListItemSelect({ dayId: day[idKey], blockId: block[idKey] })"
                @remove="handleListItemRemove(`schedule/days/${day[idKey]}/blocks`, block)"
              >
                <admin-list
                  :items-ref="competitionDataRef.child(`schedule/days/${day[idKey]}/blocks/${block[idKey]}/events`)"
                  items-type="Event"
                  @create="handleListItemCreate(`schedule/days/${day[idKey]}/blocks/${block[idKey]}/events`, $event)"
                >
                  <admin-list-item
                    slot-scope="event"
                    :item="event"
                    @click.stop="handleListItemSelect({ dayId: day[idKey], blockId: block[idKey], eventId: event[idKey] })"
                    @remove="handleListItemRemove(`schedule/days/${day[idKey]}/blocks/${block[idKey]}/events`, event)"
                  >
                    <admin-list
                      :items-ref="competitionDataRef.child(`schedule/days/${day[idKey]}/blocks/${block[idKey]}/events/${event[idKey]}/dances`)"
                      items-type="Dance"
                      @create="handleListItemCreate(`schedule/days/${day[idKey]}/blocks/${block[idKey]}/events/${event[idKey]}/dances`, $event)"
                    >
                      <admin-list-item
                        slot-scope="dance"
                        :item="dance"
                        :item-name-fn="itemDanceNameFn"
                        :md-expand="false"
                        @click.stop="handleListItemSelect({ dayId: day[idKey], blockId: block[idKey], eventId: event[idKey], danceId: dance[idKey] })"
                        @remove="handleListItemRemove(`schedule/days/${day[idKey]}/blocks/${block[idKey]}/events/${event[idKey]}/dances`, dance)"
                      />
                    </admin-list>
                  </admin-list-item>
                </admin-list>
              </admin-list-item>
            </admin-list>
          </admin-list-item>
        </admin-list>
      </div>
      <div class="md-layout-item md-size-50 md-scroll admin-blade">
        <form v-if="currentItem" @submit.prevent class="md-padding">
          <div v-for="(field, key) in currentItemFields" :key="key">
            <md-field v-if="field.type === 'select'">
              <label>{{ field.name || key }}</label>
              <md-select
                v-model="currentItem[key]"
                :required="currentItem.required"
                @md-selected="handleListItemUpdate(currentPath, currentItem)"
              >
                <md-option
                  v-for="preset in field.presets"
                  :key="preset[idKey]"
                  :value="preset[idKey]"
                >
                  {{ preset.$name || preset.name }}
                </md-option>
              </md-select>
            </md-field>

            <md-field v-else-if="field.type === 'textarea'" md-clearable>
              <label>{{ field.name || key }}</label>
              <md-textarea
                v-model="currentItem[key]"
                :md-autogrow="true"
                :required="field.required"
                @input="handleListItemUpdate(currentPath, currentItem)"
              />
            </md-field>

            <md-datepicker
              v-else-if="field.type === 'datepicker'"
              v-model="currentItem[key]"
              :class="{ 'md-required': field.required }"
              @input="handleListItemUpdate(currentPath, currentItem)"
            >
              <label>{{ field.name || key }}</label>
            </md-datepicker>

            <md-field v-else md-clearable>
              <label>{{ field.name || key }}</label>
              <md-input
                v-model="currentItem[key]"
                :required="field.required"
                @input="handleListItemUpdate(currentPath, currentItem)"
              />
            </md-field>
          </div>
        </form>
        <md-empty-state
          v-else
          md-icon="event_note"
          md-label="Edit activities"
          md-description="Add or select an item to edit"
        />
      </div>
    </div>
  </div>
</template>

<script>
import AdminList from '@/components/competition/admin/admin-list';
import AdminListItem from '@/components/competition/admin/admin-list-item';
import {
  getScheduleItemDanceName,
} from '@/helpers/competition';
import {
  idKey,
  db,
} from '@/helpers/firebase';

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
    platforms: Array,
    schedule: Object,
  },
  data() {
    return {
      idKey,

      currentItem: undefined,
    };
  },
  watch: {
    currentPath: {
      handler(currentPath) {
        if (this.currentItem) this.$unbind('currentItem');
        this.currentItem = null;
        if (!currentPath) return;
        this.$bindAsObject('currentItem', this.competitionDataRef.child(currentPath));
      },
      immediate: true,
    },
  },
  computed: {
    currentPath() {
      const pathProps = [
        ['days', this.dayId],
        ['blocks', this.blockId],
        ['events', this.eventId],
        ['dances', this.danceId],
      ];
      const path = pathProps
        .filter(([collection, id]) => collection && id)
        .map(([collection, id]) => `${collection}/${id}`)
        .join('/');

      return path && `schedule/${path}`;
    },
    currentItemCollection() {
      const chunks = this.currentPath.split('/');
      return chunks.length >= 2 ? chunks[chunks.length - 2] : null;
    },
    currentItemFields() {
      if (this.currentItem) {
        const fields = {
          name: {
            name: 'Name',
            required: true,
          },
          description: {
            name: 'Description',
            type: 'textarea',
          },
        };

        switch (this.currentItemCollection) {
          case 'days': {
            fields.name.required = false;
            fields.date = {
              name: 'Date',
              type: 'datepicker',
              required: true,
            };
            break;
          }
          case 'dances': {
            fields.name.required = false;
            fields.danceId = {
              name: 'Dance',
              type: 'select',
              presets: this.dances,
            };
            break;
          }
          default: {
            // @IGNORE
            break;
          }
        }

        return fields;
      }
      return null;
    },
  },
  methods: {
    itemDanceNameFn(item) {
      return getScheduleItemDanceName(item, this.dances);
    },

    handleListItemCreate(path, item) {
      this.$emit('change', {
        [`${path}/${db.push().key}`]: item,
      });
    },
    handleListItemUpdate(path, item) {
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
    handleListItemRemove(path, item) {
      this.$emit('change', {
        [`${path}/${item[idKey]}`]: null,
      });
    },
    handleListItemSelect(params) {
      this.$router.push({
        name: 'competition.admin.schedule',
        params,
      });
    },
  },
  components: {
    AdminList,
    AdminListItem,
  },
};
</script>

<style lang="scss">
.admin-schedule {
  .md-list-expand {
    padding-left: 16px;
  }
}
</style>
