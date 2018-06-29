import XLSX from 'xlsx';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.css';
import HotTable from '@handsontable/vue';
import store from '@/store';
import {
  idKey,
} from '@/helpers/firebase';


function makeKeyValuePairColumn(column, valueProp = '$name', keyProp = idKey) {
  return {
    ...column,
    type: 'handsontable',
    handsontable: {
      autoColumnSize: true,
      data: column.source,
      columns: [{ data: valueProp }],
      getValue: function getValue() {
        return this.getSourceDataAtRow(this.getSelected()[0])[keyProp];
      },
    },
    renderer: function renderer(...args) {
      const item = column.source.find(i => i[keyProp] === args[5]);
      if (item) {
        // eslint-disable-next-line no-param-reassign
        args[5] = item[valueProp];
      }
      Handsontable.renderers.HandsontableRenderer.apply(this, args);
    },
  };
}

function hasPermission(...keys) {
  return store.getters.hasPermission(...keys);
}

export {
  XLSX,
  Handsontable,
  HotTable,
  makeKeyValuePairColumn,
  hasPermission,
};
