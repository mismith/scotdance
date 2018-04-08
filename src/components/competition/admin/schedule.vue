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
            @click.stop="handleListItemSelect('schedule/days', day)"
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
                @click.stop="handleListItemSelect(`schedule/days/${day[idKey]}/blocks`, block)"
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
                    @click.stop="handleListItemSelect(`schedule/days/${day[idKey]}/blocks/${block[idKey]}/events`, event)"
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
                        :expandable="false"
                        @click.stop="handleListItemSelect(`schedule/days/${day[idKey]}/blocks/${block[idKey]}/events/${event[idKey]}/dances`, dance)"
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
      <div class="md-layout-item md-size-50 admin-blade md-scroll-frame">
        <form v-if="selected.item" @submit.prevent class="md-padding">
          <div v-for="(field, key) in getSelectedFields()" :key="key">
            <md-field v-if="field.type === 'textarea'" md-clearable>
              <label>{{ field.name || key }}</label>
              <md-textarea
                v-model="selected.item[key]"
                :md-autogrow="true"
                :required="field.required"
                @change="handleListItemUpdate(selected.path, selected.item)"
              />
            </md-field>
            <md-datepicker
              v-else-if="field.type === 'datepicker'"
              v-model="selected.item[key]"
              :class="{ 'md-required': field.required }"
              @input="handleListItemUpdate(selected.path, selected.item)"
            >
              <label>{{ field.name || key }}</label>
            </md-datepicker>
            <md-field v-else md-clearable>
              <label>{{ field.name || key }}</label>
              <md-input
                v-model="selected.item[key]"
                :required="field.required"
                @change="handleListItemUpdate(selected.path, selected.item)"
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
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  name: 'admin-schedule',
  props: {
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

      selected: {
        path: undefined,
        item: undefined,
      },
    };
  },
  methods: {
    getSelectedFields() {
      if (this.selected.item) {
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
        const collection = this.selected.path.replace(/^.*\//, '');

        switch (collection) {
          case 'days': {
            fields.name.required = false;
            fields.date = {
              name: 'Date',
              type: 'datepicker',
              required: true,
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
      const key = clone[idKey];
      delete clone[idKey];

      this.$emit('change', {
        [`${path}/${key}`]: clone,
      });
    },
    handleListItemRemove(path, item) {
      this.$emit('change', {
        [`${path}/${item[idKey]}`]: null,
      });
    },
    handleListItemSelect(path, item) {
      this.$set(this, 'selected', {
        path,
        item,
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
