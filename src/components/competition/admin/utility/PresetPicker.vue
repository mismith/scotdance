<template>
  <div class="preset-picker">
    <v-btn flat @click="dialogOpen = true">Add Preset(s)</v-btn>

    <dialog-card v-model="dialogOpen" title="Select preset(s) to add:" @submit="select">
      <v-list slot="text">
        <v-list-tile v-for="preset in presets" :key="getValue(preset)">
          <v-list-action>
            <v-checkbox v-model="selected[getValue(preset)]" /><!-- eslint-disable-line vue/valid-v-model -->
          </v-list-action>
          <v-list-tile-content>
            <v-list-tile-title>{{ getValue(preset) }}</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
      </v-list>

      <v-card-actions slot="actions" class="justify-end">
        <v-btn flat @click="dialogOpen = false">Cancel</v-btn>

        <v-btn
          flat
          color="primary"
          :disabled="!selectedPresets.length"
          type="submit"
        >
          Add
        </v-btn>
      </v-card-actions>
    </dialog-card>
  </div>
</template>

<script>
import { idKey } from '@/helpers/firebase';

export default {
  name: 'preset-picker',
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

      dialogOpen: false,

      selected: {},
    };
  },
  computed: {
    selectedPresets() {
      const selected = Object.entries(this.selected)
        .filter(([k, v]) => k && v)
        .map(([k]) => k);

      return this.presets.filter(preset => selected.includes(this.getValue(preset)));
    },
  },
  methods: {
    getValue(preset) {
      if (typeof this.prop === 'function') {
        return this.prop(preset);
      }
      return preset[this.prop];
    },
    select() {
      // trigger only selected presets
      this.$emit('select', this.selectedPresets);

      // reset
      this.selected = {};

      // close
      this.dialogOpen = false;
    },
  },
};
</script>

<style lang="scss">
.preset-picker {

}
</style>
