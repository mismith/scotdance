<template>
  <md-chips
    v-model="paths"
    @md-insert="handleChanges($event, true)"
    @md-delete="handleChanges($event, null)"
    class="path-chips"
  >
    <label>{{ label }}</label>
  </md-chips>
</template>

<script>
import {
  flattenPaths,
} from '@/helpers/admin';

export default {
  name: 'path-chips',
  props: {
    label: String,
    data: Object,
  },
  computed: {
    paths() {
      return flattenPaths(this.data);
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
