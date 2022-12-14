<template>
  <HotTable
    :settings="hotSettings"
    :data="hotData"
    class="MiHotTable"
    ref="hot"
  />
</template>

<script>
import { arrayMoveByIndex } from 'array-move-multiple';
import {
  idKey,
  userDragOrderKey,
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
    hotSettings() {
      const { data, ...settings } = this.settings;
      return this.augmentHot(settings);
    },
    hotData() {
      return [...(this.data || this.hotSettings?.data || [])];
    },
    hotInstance() {
      return this.$refs.hot?.hotInstance;
    },
  },
  watch: {
    hotData(data) {
      this.hotInstance?.updateData(data);
    },
  },
  methods: {
    augmentHot(settings = {}) {
      const augmentedSettings = augmentHot(settings);

      if (this.data) {
        const vm = this;
        augmentedSettings.beforeChange = function beforeChange(changes, source) {
          if (source !== 'loadData') {
            // store/retrieve to avoid adding a new db entry per change (instead of per new row)
            const keys = {};
            const getKey = (row) => {
              if (!keys[row]) {
                const key = vm.hotData[row] && vm.hotData[row][idKey];
                if (!key) {
                  keys[row] = db.push().key;
                } else {
                  keys[row] = key;
                }
              }
              return keys[row];
            };

            const aggregated = {};
            changes.forEach(([row, prop, , newVal]) => {
              if (!prop || typeof prop !== 'string') return; // skip if overflowing columns
              const physicalRow = this.toPhysicalRow(row); // to account for sorting
              const key = getKey(physicalRow !== null ? physicalRow : row); // null -> new addition
              aggregated[`${key}/${prop.replace('.', '/')}`] = newVal || null;
            });
            if (Object.keys(aggregated).length) { // ignore if new row and no value entered
              vm.$emit('change', aggregated);
            }
          }
        };
        augmentedSettings.beforeRemoveRow = function beforeRemoveRow(index, amount) {
          const aggregated = {};
          for (let row = index; row < index + amount; row += 1) {
            const physicalRow = this.toPhysicalRow(row); // to account for sorting
            const key = vm.hotData[physicalRow] && vm.hotData[physicalRow][idKey];
            if (key) {
              aggregated[key] = null;
            }
          }
          vm.$emit('change', aggregated);
        };
        augmentedSettings.beforeRowMove = function beforeRowMove(movedRowIndexes, finalIndex) {
          const beforeReorderIds = this.getData().map((row, index) => {
            const physicalRowIndex = this.toPhysicalRow(index); // to account for sorting
            return vm.hotData[physicalRowIndex] && vm.hotData[physicalRowIndex][idKey];
          }).filter(Boolean);
          const afterReorderIds = arrayMoveByIndex(beforeReorderIds, movedRowIndexes, finalIndex);
          const changes = afterReorderIds.reduce((acc, id, index) => {
            if (id) {
              acc[`${id}/${userDragOrderKey}`] = index;
            }
            return acc;
          }, {});
          vm.$emit('change', changes);
          return false; // don't update UI (wait for data change to do so, otherwise it get out of sync)
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
