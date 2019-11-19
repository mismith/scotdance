<template>
  <DialogCard
    v-model="dialogOpen"
    title="Select preset(s) to add:"
    cancel-label="Cancel"
    submit-label="Add"
    class="PresetPicker"
    @submit="handleSubmit"
  >
    <template #activator="props">
      <slot name="activator" v-bind="props">
        <v-btn text>Add Presets&hellip;</v-btn>
      </slot>
    </template>
    <template #text>
      <v-list class="app-scroll">
        <v-list-item
          v-for="preset in presets"
          :key="getValue(preset)"
          @click="handleToggle(preset)"
        >
          <v-list-item-action>
            <v-checkbox :value="selected[getValue(preset)]" />
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>{{ getValue(preset) }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item v-if="!presets.length" class="empty">
          <v-list-item-avatar>
            <v-icon>mdi-close</v-icon>
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
