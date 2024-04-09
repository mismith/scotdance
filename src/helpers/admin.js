import Vue from 'vue';
import Handsontable from 'handsontable/base';
import 'handsontable/dist/handsontable.full.css';
import flatten from 'obj-flatten';

import {
  registerEditor,
  // AutocompleteEditor,
  BaseEditor,
  // CheckboxEditor,
  // DateEditor,
  DropdownEditor,
  // HandsontableEditor,
  // NumericEditor,
  // PasswordEditor,
  // SelectEditor,
  TextEditor,
} from 'handsontable/editors';
import {
  registerRenderer,
  baseRenderer,
  autocompleteRenderer,
  // checkboxRenderer,
  htmlRenderer,
  // numericRenderer,
  // passwordRenderer,
  textRenderer,
} from 'handsontable/renderers';
import {
  autocompleteValidator,
} from 'handsontable/validators';
import {
  registerCellType,
  // AutocompleteCellType,
  // CheckboxCellType,
  // DateCellType,
  DropdownCellType,
  HandsontableCellType,
  // NumericCellType,
  // PasswordCellType,
  TextCellType,
  // TimeCellType,
} from 'handsontable/cellTypes';
import {
  registerPlugin,
  AutoColumnSize,
  // AutoRowSize,
  Autofill,
  // BasePlugin,
  // BindRowsWithHeaders,
  // CollapsibleColumns,
  ColumnSorting,
  // ColumnSummary,
  // Comments,
  ContextMenu,
  CopyPaste,
  // CustomBorders,
  DragToScroll,
  // DropdownMenu,
  // ExportFile,
  // Filters,
  // Formulas,
  // HiddenColumns,
  // HiddenRows,
  // ManualColumnFreeze,
  // ManualColumnMove,
  ManualColumnResize,
  ManualRowMove,
  // ManualRowResize,
  // MergeCells,
  // MultiColumnSorting,
  // MultipleSelectionHandles,
  // NestedHeaders,
  // NestedRows,
  // PersistentState,
  Search,
  // TouchScroll,
  // TrimRows,
  UndoRedo,
} from 'handsontable/plugins';
import {
  registerLanguageDictionary,
  enUS,
} from 'handsontable/i18n';

import vuetify from '@/plugins/vuetify';
import { idKey } from '@/helpers/firebase';
import FileUploaderCellRenderer from '@/components/admin/FileUploaderCellRenderer.vue';

export * from '@handsontable/vue';
export { Handsontable };

registerLanguageDictionary(enUS);

registerEditor(BaseEditor);
registerEditor(DropdownEditor);
registerEditor(TextEditor);

registerRenderer(baseRenderer);
registerRenderer(htmlRenderer);
registerRenderer(textRenderer);

registerCellType(DropdownCellType);
registerCellType(HandsontableCellType);
registerCellType(TextCellType);

registerPlugin(AutoColumnSize);
registerPlugin(Autofill);
registerPlugin(ColumnSorting);
registerPlugin(ContextMenu);
registerPlugin(CopyPaste);
registerPlugin(DragToScroll);
registerPlugin(ManualColumnResize);
registerPlugin(ManualRowMove);
registerPlugin(Search);
registerPlugin(UndoRedo);

registerCellType('textarea', {
  renderer(...args) {
    const [hotInstance, td, row, col, prop, value, cellProperties] = args;
    htmlRenderer.apply(this, [
      hotInstance,
      td,
      row,
      col,
      prop,
      `<div style="max-width: 300px; max-width: 33vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${value || ''}</div>`,
      cellProperties,
    ]);
  },
  editor: TextEditor,
});

registerCellType('file', {
  renderer(...args) {
    const [hotInstance, td, row, col, prop, value, cellProperties] = args;
    baseRenderer.apply(this, args);

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
      render: (h) => h(FileUploaderCellRenderer, {
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
      vuetify,
    });
  },
  editor: TextEditor,
  validator: autocompleteValidator,
});

export function makeKeyValuePairColumn(column, valueProp = '$name', keyProp = idKey) {
  return {
    ...column,
    type: 'handsontable',
    handsontable: {
      autoColumnSize: true,
      data: column.source.map((datum) => ({
        // makeKeyValuePairColumnId becuse `.key` seems to get mutated by handsontable
        // into `{ "": { key: undefined } }`
        makeKeyValuePairColumnId: datum[keyProp],
        ...datum,
      })),
      columns: [{ data: valueProp }],
      getValue: function getValue() {
        const [[startRowIndex]] = this.getSelected();
        const data = this.getSourceDataAtRow(startRowIndex);
        return data && data.makeKeyValuePairColumnId;
      },
    },
    renderer: function renderer(...args) {
      const item = column.source.find((i) => i[keyProp] === args[5]);
      if (item) {
        // eslint-disable-next-line no-param-reassign
        args[5] = item[valueProp];
        // eslint-disable-next-line no-param-reassign
        args[6].valid = true;
      } else if (args[5]) {
        // eslint-disable-next-line no-param-reassign
        args[6].valid = false;
      }
      autocompleteRenderer.apply(this, args);
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
  modifyColWidth: (w) => Math.min(w, window.width / 2), // prevent super-wide cells
  minSpareRows: 1,

  // plugins
  autoColumnSize: true,
  columnSorting: true,
  contextMenu: [
    'remove_row',
    '---------',
    'undo',
    'redo',
  ],
  copyPaste: true,
  dragToScroll: true,
  manualColumnResize: true,
  search: true,
  undo: true,

  ...settings,

  data,
});

export const flattenPaths = (obj) => Object.keys(flatten(obj, '/') || {});

export function accumulateKeys(obj) {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc.push(key);
    if (value && typeof value === 'object') {
      acc.push(...accumulateKeys(value).map((k) => `${key}.${k}`));
    }
    return acc;
  }, []);
}
