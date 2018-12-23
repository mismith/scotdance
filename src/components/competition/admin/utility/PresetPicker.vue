<template>
  <div class="preset-picker">
    <v-btn flat @click="dialogOpen = true">Add Preset(s)</v-btn>

    <md-dialog :md-active.sync="dialogOpen">
      <md-dialog-title>Select preset(s) to add:</md-dialog-title>

      <md-dialog-content>
        <v-list>
          <v-list-tile v-for="preset in presets" :key="getValue(preset)">
            <md-checkbox v-model="selected[getValue(preset)]" /><!-- eslint-disable-line vue/valid-v-model -->
            <v-list-tile-title>{{ getValue(preset) }}</v-list-tile-title>
          </v-list-tile>
        </v-list>
      </md-dialog-content>

      <md-dialog-actions>
        <v-btn @click="dialogOpen = false">Cancel</v-btn>
        <v-btn
          color="primary"
          :disabled="!selectedPresets.length"
          @click="select"
        >
          Add
        </v-btn>
      </md-dialog-actions>
    </md-dialog>
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
