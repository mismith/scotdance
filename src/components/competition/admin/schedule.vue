<template>
  <div class="admin-schedule md-scroll-frame">
    <md-toolbar class="md-dense">
      <span>
        <a @click.prevent="slideTo(0)">Schedule</a>
      </span>
      <span v-for="(step, stepIndex) in steps" :key="step[idKey]" v-if="step.$selected">
        &nbsp;&rsaquo;
        <a @click="slideTo(stepIndex + 1)">{{ step.$selected.name }}</a>
      </span>
    </md-toolbar>
    <div class="md-layout">
      <div class="md-layout-item md-size-33">
        <swiper ref="swiper" class="swiper-no-swiping">
          <swiper-slide v-for="(step, stepIndex) in steps" :key="step[idKey]">
            <header>
              <md-button v-if="stepIndex > 0" @click="slideTo(stepIndex - 1)" class="md-icon-button md-raised md-primary">
                <md-icon>chevron_left</md-icon>
              </md-button>
              <md-subheader>
                {{ step.name }}
              </md-subheader>
            </header>
            <div class="md-scroll">
              <md-list>
                <md-list-item
                  v-for="item in getStepItems(step)"
                  :key="item[idKey]"
                  @click="$set(step, '$selected', item); slideTo(stepIndex + 1);"
                >
                  {{ item.name }}
                </md-list-item>
                <form @submit.prevent="handleAddNew(step)">
                  <md-list-item>
                    <md-field>
                      <label>Add New</label>
                      <md-select v-if="step.sources" v-model="step.$select" multiple>
                        <md-option
                          v-for="source in step.sources"
                          :key="source[idKey]"
                          :value="source[idKey]"
                        >{{ source.$name || source.name }}</md-option>
                      </md-select>
                      <md-input v-else v-model="step.$input" />
                    </md-field>
                    <md-button type="submit" :disabled="!step.$input && !step.$select" class="md-icon-button md-raised md-primary">
                      <md-icon>add</md-icon>
                    </md-button>
                  </md-list-item>
                </form>
              </md-list>
            </div>
          </swiper-slide>
        </swiper>
      </div>
      <div class="md-layout-item md-size-66">
        <form v-if="activeStep">
          <md-field md-clearable>
            <label>Name</label>
            <md-input v-model="activeStep.name" />
          </md-field>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import {
  idKey,
} from '@/helpers/firebase';

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
        },
        {
          [idKey]: 'blocks',
          name: 'Blocks',
        },
        {
          [idKey]: 'events',
          name: 'Events',
        },
        {
          [idKey]: 'dances',
          name: 'Dances',
          sources: this.dances,
        },
        {
          [idKey]: 'platforms',
          name: 'Platforms',
          sources: this.platforms,
        },
        {
          [idKey]: 'groups',
          name: 'Age Groups',
          sources: this.groups,
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

    getStepItems(step) {
      if (!step.$items) {
        step.$items =  new Array(Math.ceil(Math.random() * 10))
          .fill(1)
          .map((v, index) => ({
            [idKey]: index,
            name: `${step.name} ${index + 1}`,
          }));
      }
      return step.$items;
    },
    handleAddNew(step) {
      const items = this.getStepItems(step);
      if (step.$select) {
        step.$select.forEach((selected) => {
          items.push({
            [idKey]: items.length,
            name: this[step[idKey]].find(item => item[idKey] === selected).$name,
          });
        });
        step.$select = null;
      } else {
        items.push({
          [idKey]: items.length,
          name: step.$input,
        });
        step.$input = null;
      }
    },
  },
  components: {
  },
};
</script>

<style lang="scss">
.admin-schedule {
  &,
  .swiper-container {
    height: 100%;
  }
  .swiper-slide {
    width: 100%;
  }
  > .md-layout {
    flex: 1;
  }

  header {
    display: flex;
    align-items: center;
    margin: 6px 0;

    + .md-scroll .md-list {
      padding-top: 0;
    }
  }

  .md-layout-item {
    &:not(:last-child) {
      border-right: solid 6px #ccc;
    }
  }
}
</style>
