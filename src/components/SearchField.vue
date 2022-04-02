<template>
  <v-text-field
    v-bind="$attrs"
    label="Search"
    type="search"
    v-model="value"
    :append-icon="mdiMagnify"
    clearable
    solo
    hide-details
    :loading="loading || value !== valueDebounced"
    class="SearchField"
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
  watch: {
    value(value) {
      if (value === this.valueDebounced) return;

      clearTimeout(this.valueTimeout);
      this.valueTimeout = setTimeout(() => {
        this.valueDebounced = value || '';
      }, this.debounce);
    },
    valueDebounced(valueDebounced) {
      this.$emit('input', valueDebounced);
    },
  },
  beforeDestroy() {
    clearTimeout(this.valueTimeout);
  },
};
</script>
