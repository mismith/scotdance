<template>
  <div class="PresetPicker">
    <v-btn flat @click="dialogOpen = true">Add Presets&hellip;</v-btn>

    <DialogCard v-model="dialogOpen" title="Select preset(s) to add:" @submit="handleSubmit">
      <v-list slot="text" class="app-scroll">
        <v-list-tile
          v-for="preset in presets"
          :key="getValue(preset)"
          @click="handleToggle(preset)"
        >
          <v-list-tile-action>
            <v-checkbox :value="selected[getValue(preset)]" />
          </v-list-tile-action>
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
          type="submit"
        >
          Add
        </v-btn>
      </v-card-actions>
    </DialogCard>
  </div>
</template>

<script>
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
    handleToggle(preset) {
      const value = this.getValue(preset);
      this.$set(this.selected, value, !this.selected[value]);
    },
    handleSubmit() {
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
