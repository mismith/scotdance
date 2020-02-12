import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.css';
import flatten from 'obj-flatten';
import { idKey } from '@/helpers/firebase';

export * from '@handsontable/vue';
export { Handsontable };

export function makeKeyValuePairColumn(column, valueProp = '$name', keyProp = idKey) {
  return {
    ...column,
    type: 'handsontable',
    handsontable: {
      autoColumnSize: true,
      data: column.source,
      columns: [{ data: valueProp }],
      getValue: function getValue() {
        const [[startRowIndex]] = this.getSelected();
        const data = this.getSourceDataAtRow(startRowIndex);
        return data && data[keyProp];
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

export const licenseHot = (settings = {}) => ({
  licenseKey: 'non-commercial-and-evaluation',
  ...settings,
});

export const augmentHot = (settings = {}, data = undefined) => licenseHot({
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

  ...settings,

  data,
});

export const flattenPaths = obj => Object.keys(flatten(obj, '/') || {});
