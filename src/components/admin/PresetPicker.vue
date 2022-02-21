<template>
  <DialogCard
    v-model="dialogOpen"
    title="Select preset(s) to add:"
    class="PresetPicker"
  >
    <template #activator="props">
      <slot name="activator" v-bind="props">
        <v-tooltip bottom>
          <template #activator="{ on: tooltip }">
            <v-btn
              v-test="'preset-picker:button'"
              v-on="Object.assign({}, tooltip, props.on)"
              icon
              class="mx-1"
            >
              <v-icon>{{ mdiPlaylistPlus }}</v-icon>
            </v-btn>
          </template>
          <span>Add preset(s)</span>
        </v-tooltip>
      </slot>
    </template>
    <template #text>
      <v-list class="app-scroll">
        <v-list-item
          v-for="preset in presets"
          :key="getValue(preset)"
          @click="handleToggle(preset)"
        >
          <v-list-item-content>
            <v-list-item-title>{{ getValue(preset) }}</v-list-item-title>
          </v-list-item-content>
          <v-list-item-action>
            <v-scale-transition hide-on-leave origin="center center">
              <v-icon
                v-if="added[getValue(preset)]"
                key="success"
                color="success"
              >
                {{ mdiCheck }}
              </v-icon>
              <v-icon
                v-else
                key="default"
                style="opacity: 0.5;"
              >
                {{ mdiPlus }}
              </v-icon>
            </v-scale-transition>
          </v-list-item-action>
        </v-list-item>
        <v-list-item v-if="!presets.length" class="empty">
          <v-list-item-avatar>
            <v-icon>{{ mdiClose }}</v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            No presets found.
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </template>
  </DialogCard>
</template>

<script>
import {
  mdiCheck,
  mdiClose,
  mdiPlaylistPlus,
  mdiPlus,
} from '@mdi/js';
import { idKey } from '@/helpers/firebase';

export default {
  name: 'PresetPicker',
  props: {
    presets: Array,
    prop: {
      type: [String, Function],
      default: 'name',
    },
  },
  data() {
    return {
      idKey,
      mdiCheck,
      mdiClose,
      mdiPlaylistPlus,
      mdiPlus,

      added: {},

      dialogOpen: false,
    };
  },
  methods: {
    getValue(preset) {
      if (typeof this.prop === 'function') {
        return this.prop(preset);
      }
      return preset[this.prop];
    },
    handleToggle(preset) {
      // show success marker for a brief moment
      const value = this.getValue(preset);
      const reset = () => {
        this.added[value] = null;
        clearTimeout(this.added[value]);
      };
      if (this.added[value]) {
        reset();
      }
      this.$set(this.added, value, setTimeout(reset, 1000));

      // trigger the addition
      this.$emit('select', [preset]);
    },
    show() {
      this.dialogOpen = true;
    },
  },
};
</script>
