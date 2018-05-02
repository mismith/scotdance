<template>
  <div class="preset-picker">
    <md-button @click="dialogOpen = true">Add Preset(s)</md-button>
    <md-dialog :md-active.sync="dialogOpen">
      <md-dialog-title>Select preset(s) to add:</md-dialog-title>

      <md-dialog-content>
        <md-list>
          <md-list-item v-for="preset in presets" :key="preset[prop]">
            <md-checkbox v-model="selected[preset[prop]]" />
            <span class="md-list-item-text">{{ preset[prop] }}</span>
          </md-list-item>
        </md-list>
      </md-dialog-content>

      <md-dialog-actions>
        <md-button @click="dialogOpen = false">Cancel</md-button>
        <md-button
          @click="select"
          :disabled="!selectedPresets.length"
          class="md-primary md-raised"
        >
          Add
        </md-button>
      </md-dialog-actions>
    </md-dialog>
  </div>
</template>

<script>
import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'preset-picker',
  props: {
    presets: Array,
    prop: {
      type: String,
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

      return this.presets.filter(preset => selected.includes(preset[this.prop]));
    },
  },
  methods: {
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
