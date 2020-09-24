<template>
  <v-text-field
    label="Search"
    type="search"
    v-model="value"
    :append-icon="mdiMagnify"
    clearable
    solo
    hide-details
    :loading="value !== valueDebounced"
    class="SearchField"
  />
</template>

<script>
import { mdiMagnify } from '@mdi/js';

export default {
  name: 'SearchField',
  props: {
    value: String,
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
      clearTimeout(this.valueTimeout);
      this.valueTimeout = setTimeout(() => {
        this.valueDebounced = value || '';
      }, 300);
    },
    valueDebounced(valueDebounced) {
      this.$emit('input', valueDebounced);
    },
  },
};
</script>
