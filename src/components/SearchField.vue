<template>
  <v-text-field
    v-bind="$attrs"
    label="Search"
    type="search"
    :value="value"
    :append-icon="mdiMagnify"
    clearable
    solo
    hide-details
    :loading="loading || value !== valueDebounced"
    class="SearchField"
    @input="handleInput"
  />
</template>

<script>
import { mdiMagnify } from '@mdi/js';

export default {
  name: 'SearchField',
  props: {
    value: String,
    debounce: {
      type: Number,
      default: 300,
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      mdiMagnify,
      valueDebounced: this.value,
      valueTimeout: undefined,
    };
  },
  methods: {
    handleInput(value) {
      // skip if unnecessary
      if (value === this.valueDebounced) return;

      // show loader immediately
      this.valueDebounced = undefined;

      // delay emiting @input until debounced
      clearTimeout(this.valueTimeout);
      this.valueTimeout = setTimeout(() => {
        this.valueDebounced = value || '';
        this.$emit('input', this.valueDebounced);
      }, this.debounce);
    },
  },
  beforeDestroy() {
    clearTimeout(this.valueTimeout);
  },
};
</script>
