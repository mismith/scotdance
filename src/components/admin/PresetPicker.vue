<template>
  <DialogCard
    v-model="dialogOpen"
    title="Select preset(s) to add:"
    cancel-label="Cancel"
    submit-label="Add"
    class="PresetPicker"
    @submit="handleSubmit"
  >
    <slot name="activator" slot="activator">
      <v-btn flat>Add Presets&hellip;</v-btn>
    </slot>
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
      <v-list-tile v-if="!presets.length" class="empty">
        <v-list-tile-avatar>
          <v-icon>clear</v-icon>
        </v-list-tile-avatar>
        <span>No presets found.</span>
      </v-list-tile>
    </v-list>
  </DialogCard>
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
  watch: {
    dialogOpen(isOpen) {
      // reset on close
      if (!isOpen) {
        this.selected = {};
      }
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

      // close
      this.dialogOpen = false;
    },
  },
};
</script>
