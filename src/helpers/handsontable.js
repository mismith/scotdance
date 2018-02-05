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
    renderer: function renderer(instance, td, row, col, prop, value) {
      // eslint-disable-next-line prefer-rest-params
      Handsontable.renderers.HandsontableRenderer.apply(this, arguments);

      const item = column.source.find(i => i[keyProp] === value);
      // eslint-disable-next-line no-param-reassign
      if (item) td.innerHTML = item[valueProp];
    },
  };
}
