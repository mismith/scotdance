import Vue from 'vue';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.css';
import flatten from 'obj-flatten';
import { idKey } from '@/helpers/firebase';
import FileUploaderCellRenderer from '@/components/admin/FileUploaderCellRenderer.vue';

export * from '@handsontable/vue';
export { Handsontable };

Handsontable.cellTypes.registerCellType('textarea', {
  renderer(...args) {
    const [hotInstance, td, row, col, prop, value, cellProperties] = args;
    Handsontable.renderers.HtmlRenderer.apply(this, [
      hotInstance,
      td,
      row,
      col,
      prop,
      `<div style="max-width: 300px; max-width: 33vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${Handsontable.helper.stringify(value)}</div>`,
      cellProperties,
    ]);
  },
  editor: Handsontable.editors.TextEditor,
});

Handsontable.cellTypes.registerCellType('file', {
  renderer(...args) {
    const [hotInstance, td, row, col, prop, value, cellProperties] = args;
    Handsontable.renderers.BaseRenderer.apply(this, args);

    // skip re-rendering if value doesn't change
    if (typeof td.hotValue !== 'undefined' && td.hotValue === value) return;
    td.hotValue = value; // @HACK: cache it on the DOM node

    // empty old contents and add new element to render to
    while (td.firstChild) td.firstChild.remove();
    const el = document.createElement('div');
    td.appendChild(el);

    // pluck schema field props to pass to component
    const { columns } = hotInstance.getSettings() || {};
    const column = (columns || [])[col] || {};
    const { storagePath, maxSize, accept } = column;

    // eslint-disable-next-line no-new
    new Vue({
      el,
      render: h => h(FileUploaderCellRenderer, {
        props: {
          hotInstance,
          td,
          row,
          col,
          prop,
          value,
          cellProperties,

          storagePath,
          maxSize,
          accept,
        },
      }),
    });
  },
  editor: Handsontable.editors.TextEditor,
});

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
