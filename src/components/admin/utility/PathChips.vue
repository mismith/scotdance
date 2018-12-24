<template>
  <v-combobox
    :label="label"
    :items="paths"
    v-model="paths"
    item-text="path"
    item-value="path"
    multiple
    chips
    @md-insert="handleChanges($event, true)"
    @md-delete="handleChanges($event, null)"
    class="path-chips"
  />
</template>

<script>
import { flattenPaths } from '@/helpers/admin';

export default {
  name: 'path-chips',
  props: {
    label: String,
    data: Object,
  },
  computed: {
    paths() {
      return flattenPaths(this.data).map(path => ({ path }));
    },
  },
  methods: {
    handleChanges(path, value) {
      this.$emit('change', {
        [path]: value,
      });
    },
  },
};
</script>

<style lang="scss">
.path-chips {

}
</style>
