<template>
  <HotTable :settings="augmentHot(settings)" :data="data" class="mi-hot-table" />
</template>

<script>
import {
  idKey,
  db,
} from '@/helpers/firebase';
import {
  HotTable,
  augmentHot,
} from '@/helpers/admin';

export default {
  name: 'mi-hot-table',
  props: {
    settings: Object,
    data: Array,
  },
  methods: {
    augmentHot(settings = {}) {
      const augmentedSettings = augmentHot(settings);

      if (this.data) {
        augmentedSettings.beforeChange = (changes, source) => {
          if (source !== 'loadData') {
            const aggregated = {};
            changes.forEach(([row, prop, , newVal]) => { // eslint-disable-line vue/no-side-effects-in-computed-properties
              aggregated[`${this.data[row][idKey] || db.push().key}/${prop.replace('.', '/')}`] = newVal; // @TODO: why is this.data no defined when adding to the bottom row?
            });
            this.$emit('change', aggregated); // eslint-disable-line vue/no-side-effects-in-computed-properties

            return false; // prevent duplicate row (one from firebase, one from hot-table)
          }
          return true;
        };
        augmentedSettings.beforeRemoveRow = (index, amount) => {
          const aggregated = {};
          for (let row = index; row < index + amount; row += 1) {
            if (this.data[row] && this.data[row][idKey]) {
              aggregated[this.data[row][idKey]] = null;
            }
          }
          this.$emit('change', aggregated); // eslint-disable-line vue/no-side-effects-in-computed-properties

          // return false; // prevent duplicate remove (one from firebase, one from hot-table)
        };
      }

      return augmentedSettings;
    },
  },
  components: {
    HotTable,
  },
};
</script>

<style lang="scss">
.mi-hot-table {

}
</style>
