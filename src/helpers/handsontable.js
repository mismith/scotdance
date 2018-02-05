import Handsontable from 'handsontable';
import { idKey } from '@/helpers/firebase';

// eslint-disable-next-line import/prefer-default-export
export function makeKeyValuePairColumn(column, valueProp = '$name', keyProp = idKey) {
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
