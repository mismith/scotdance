<template>
  <div class="admin-schedule md-scroll-frame">
    <div class="md-layout admin-blades">
      <div class="md-layout-item md-size-33 admin-blade">
        <swiper ref="swiper" class="swiper-no-swiping">
          <swiper-slide v-for="(step, stepIndex) in steps" :key="step[idKey]">
            <md-subheader class="header">
              <md-button v-if="stepIndex > 0" @click="slideTo(stepIndex - 1)" class="md-icon-button">
                <md-icon>chevron_left</md-icon>
              </md-button>

              {{ step.name }}
            </md-subheader>
            <div class="md-scroll">
              <md-list>
                <md-list-item
                  v-for="(item, itemIndex) in step.$items"
                  :key="item[idKey]"
                  @click="$set(step, '$selected', item); slideTo(stepIndex + 1);"
                  :class="{active: step.$selected === item}"
                >
                  <span class="md-list-item-text">{{ item.name }}</span>

                  <md-button v-if="step.options" @click.stop="$set(item, '$confirmRemove', true)" class="md-icon-button">
                    <md-icon>delete</md-icon>
                  </md-button>
                  <md-dialog-confirm
                    :md-active.sync="item.$confirmRemove"
                    md-title="Delete entry"
                    md-content="Are you sure you want to permanently delete this entry?"
                    md-confirm-text="Yes"
                    md-cancel-text="No"
                    @md-confirm="handleRemove(step, itemIndex)" />
                </md-list-item>

                <form v-if="step.options" @submit.prevent="handleAddNew(step)" class="footer">
                  <md-list-item>
                    <md-field
                      v-if="step.options.type === 'select'"
                    >
                      <label>Add {{ step.name }}</label>
                      <md-select v-model="step.$addNew" multiple>
                        <md-option
                          v-for="source in step.options.sources"
                          :key="source[idKey]"
                          :value="source[idKey]"
                        >{{ source.$name || source.name }}</md-option>
                      </md-select>
                    </md-field>
                    <!--<md-datepicker
                      v-else-if="step.options.type === 'datepicker'"
                      v-model="step.$addNew"
                      @md-selected="handleAddNew(step)"
                    >
                      <label>Add New</label>
                    </md-datepicker>-->
                    <md-autocomplete
                      v-else-if="step.options.type === 'autocomplete'"
                      v-model="step.$addNew"
                      :md-options="step.options.sources"
                      @md-selected="handleAddNew(step)"
                    >
                      <label>Add New</label>
                    </md-autocomplete>
                    <md-field v-else>
                      <label>Add New</label>
                      <md-input v-model="step.$addNew" />
                    </md-field>

                    <md-button type="submit" :disabled="!isAddNewValid(step.$addNew)" class="md-icon-button md-raised md-primary">
                      <md-icon>add</md-icon>
                    </md-button>
                  </md-list-item>
                </form>
              </md-list>
            </div>
          </swiper-slide>
        </swiper>
      </div>
      <div class="md-layout-item md-size-66 admin-blade md-scroll-frame">
        <div v-if="activeStep && activeStep[idKey] === 'dances'" class="md-scroll-frame">
          <hot-table :settings="toHotTable(activeStep)" />
        </div>
        <form v-else-if="activeStep && activeStep.$selected" @submit.prevent class="md-padding">
          <div v-for="(field, key) in activeStep.fields" :key="key">
            <md-field v-if="field.type === 'textarea'" md-clearable>
              <label>{{ field.name }}</label>
              <md-textarea v-model="activeStep.$selected[key]" :md-autogrow="true" :required="field.required" />
            </md-field>
            <md-datepicker v-else-if="field.type === 'datepicker'" v-model="activeStep.$selected[key]" :required="field.required">
              <label>{{ field.name }}</label>
            </md-datepicker>
            <md-field v-else md-clearable>
              <label>{{ field.name }}</label>
              <md-input v-model="activeStep.$selected[key]" :required="field.required" />
            </md-field>
          </div>
        </form>
      </div>
    </div>
    <md-toolbar class="md-dense">
      <span>
        <a @click.prevent="slideTo(0)">Schedule</a>
      </span>
      <span v-for="(step, stepIndex) in steps" :key="step[idKey]" v-if="step.$selected">
        &nbsp;&rsaquo;
        <a @click="slideTo(stepIndex + 1)">{{ step.$selected.name }}</a>
      </span>
    </md-toolbar>
  </div>
</template>

<script>
import HotTable from '@/lib/vue-handsontable/HotTable';
import {
  idKey,
} from '@/helpers/firebase';
import {
  makeKeyValuePairColumn,
} from '@/helpers/handsontable';

export default {
  name: 'admin-schedule',
  props: {
    groups: Array,
    dances: Array,
    platforms: Array,
    staff: Array,
    schedule: Object,
  },
  data() {
    return {
      idKey,

      steps: [
        {
          [idKey]: 'days',
          name: 'Days',
          fields: {
            date: {
              name: 'Date',
              type: 'datepicker',
              required: true,
            },
            name: {
              name: 'Name',
            },
            description: {
              name: 'Description',
              type: 'textarea',
            },
          },
          options: {
          },
          $items: [
            {
              [idKey]: 0,
              name: 'Day 1',
            },
          ],
        },
        {
          [idKey]: 'blocks',
          name: 'Blocks',
          fields: {
            name: {
              name: 'Name',
              required: true,
            },
            description: {
              name: 'Description',
              type: 'textarea',
            },
          },
          options: {
            type: 'autocomplete',
            sources: [
              'Morning',
              'Afternoon',
              'Evening',
            ],
          },
          $items: [],
        },
        {
          [idKey]: 'events',
          name: 'Events',
          fields: {
            name: {
              name: 'Name',
              required: true,
            },
            description: {
              name: 'Description',
              type: 'textarea',
            },
          },
          options: {
            type: 'autocomplete',
            sources: [
              'Pre-Premier',
              'Premier',
            ],
          },
          $items: [],
        },
        {
          [idKey]: 'dances',
          name: 'Dances',
          options: {
            type: 'select',
            sources: this.dances,
          },
          $items: [],
        },
      ],
    };
  },
  computed: {
    activeStep() {
      let activeStep;
      this.steps.forEach((step) => {
        if (step.$selected) {
          activeStep = step;
        }
      });
      return activeStep;
    },
  },
  methods: {
    slideTo(slideIndex) {
      this.$refs.swiper.swiper.slideTo(slideIndex);

      this.steps.forEach((step, stepIndex) => {
        if (stepIndex >= slideIndex) {
          this.$set(step, '$selected', null);
        }
      });
    },

    isAddNewValid(addNew) {
      if (addNew instanceof Array) {
        if (addNew[0] === '') addNew.splice(0, 1);
        if (addNew.length) return true;
      } else {
        return !!(addNew || '').trim();
      }
      return false;
    },
    handleAddNew(step) {
      if (step.options) {
        const items = step.$items;
        if (step.options.type === 'select') {
          step.$addNew.filter(v => v).forEach((selected) => {
            items.push({
              [idKey]: `${items.length}`,
              name: (this[step[idKey]].find(item => item[idKey] === selected) || {}).$name,
            });
          });
        } else {
          items.push({
            [idKey]: `${items.length}`,
            name: step.$addNew,
          });
        }
      }
      this.$nextTick(() => {
        this.$set(step, '$addNew', '');
      });
    },
    handleRemove(step, itemIndex) {
      step.$items.splice(itemIndex, 1);
    },

    toHotTable(step) {
      const item = step.$selected;

      return {
        columns: this.platforms.map(platform => makeKeyValuePairColumn({
          data: platform[idKey],
          title: platform.$name,
          source: this.groups,
        })),

        contextMenu: [
          'remove_row',
        ],
        manualRowMove: true,
        minSpareRows: 1,
        rowHeaders: true,
        stretchH: 'all',

        data: [],
      };
    },
  },
  components: {
    HotTable,
  },
};
</script>

<style lang="scss">
.admin-schedule {
  .swiper-container {
    height: 100%;
  }
  .swiper-slide {
    width: 100%;

    .md-icon-button {
      margin-left: 16px;
      margin-right: 0;
    }
  }
  .admin-blades {
    flex: 1;
  }

  a {
    cursor: pointer;
  }

  .header {
    display: flex;
    align-items: center;
    margin: 6px 0;

    .md-button {
      margin-left: -8px;
      margin-right: 12px;
    }
    + .md-scroll .md-list {
      padding-top: 0;
    }
  }
}
</style>
