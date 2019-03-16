<template>
  <HotTable :settings="augmentHot(settings)" :data="clonedData" class="MiHotTable" />
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
  name: 'MiHotTable',
  props: {
    settings: Object,
    data: Array,
  },
  computed: {
    clonedData() {
      const data = this.data || (this.settings && this.settings.data);
      if (Array.isArray(data)) {
        return [...data];
      }
      return data;
    },
  },
  methods: {
    augmentHot(settings = {}) {
      const augmentedSettings = augmentHot(settings);

      if (this.data) {
        const instance = this;
        augmentedSettings.afterLoadData = function afterLoadData() {
          // restore sorting after data is refreshed
          const ColumnSorting = this.getPlugin('ColumnSorting');
          const sortConfig = ColumnSorting.getSortConfig();
          if (sortConfig.length) ColumnSorting.sort(sortConfig);
        };
        augmentedSettings.beforeChange = function beforeChange(changes, source) {
          if (source !== 'loadData') {
            const aggregated = {};
            changes.forEach(([row, prop, , newVal]) => {
              const physicalRow = this.toPhysicalRow(row); // to account for sorting
              const key = instance.clonedData[physicalRow] && instance.clonedData[physicalRow][idKey];
              if (key || newVal) { // ignore if new row and no value entered
                aggregated[`${key || db.push().key}/${prop.replace('.', '/')}`] = newVal || null;
              }
            });
            if (Object.keys(aggregated).length) { // ignore if new row and no value entered
              instance.$emit('change', aggregated);
            }
          }
        };
        augmentedSettings.beforeRemoveRow = function beforeRemoveRow(index, amount) {
          const aggregated = {};
          for (let row = index; row < index + amount; row += 1) {
            const physicalRow = this.toPhysicalRow(row); // to account for sorting
            const key = instance.clonedData[physicalRow] && instance.clonedData[physicalRow][idKey];
            if (key) {
              aggregated[key] = null;
            }
          }
          instance.$emit('change', aggregated);
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
