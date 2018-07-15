import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.css';
import HotTable from '@handsontable/vue';
import {
  idKey,
  db,
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

const augmentHot = (settings = {}, data = undefined, autoSave = undefined) => {
  const defaults = {
    colHeaders: true,
    rowHeaders: true,
    stretchH: 'all',
    minSpareRows: 1,
    contextMenu: [
      'remove_row',
    ],
    sortIndicator: true,
    columnSorting: true,
    manualColumnResize: true,

    data,
  };

  if (data && autoSave && autoSave.collection && autoSave.handler) {
    defaults.afterChange = (changes, source) => {
      if (source !== 'loadData') {
        changes.forEach(([row, prop, oldVal, newVal]) => { // eslint-disable-line no-unused-vars
          // add key if new entry
          if (!data[row][idKey]) {
            data[row][idKey] = db.push().key; // eslint-disable-line no-param-reassign
          }

          // queue up a save
          const path = `${autoSave.collection}/${data[row][idKey]}/${prop.replace('.', '/')}`;
          autoSave.handler(path, newVal);
        });
      }
    };
    defaults.beforeRemoveRow = (index, amount) => {
      for (let i = 0; i < amount; i += 1) {
        const path = `${autoSave.collection}/${data[index + i][idKey]}`;
        autoSave.handler(path, null);
      }
    };
  }

  return {
    ...defaults,
    ...settings,
  };
};

export {
  Handsontable,
  HotTable,
  makeKeyValuePairColumn,
  augmentHot,
};
