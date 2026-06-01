import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { Command, EditorState, Transaction } from 'prosemirror-state';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  TableMap
} from 'prosemirror-tables';
import { schema, type TableColumnAlignment } from './schema';

interface TableContext {
  table: ProseMirrorNode;
  tableStart: number;
  rowIndex: number;
  columnIndex: number;
  map: TableMap;
}

export function createTableNode(bodyRows: number, columns: number): ProseMirrorNode {
  const columnCount = Math.max(2, Math.min(columns, 8));
  const bodyRowCount = Math.max(1, Math.min(bodyRows, 12));
  const rows: ProseMirrorNode[] = [];

  rows.push(createTableRow(columnCount, 0, true));
  for (let rowIndex = 1; rowIndex <= bodyRowCount; rowIndex += 1) {
    rows.push(createTableRow(columnCount, rowIndex, false));
  }

  return schema.nodes.table.createChecked(null, rows);
}

export function addTableRowBefore(): Command {
  return addRowBefore;
}

export function addTableRowAfter(): Command {
  return addRowAfter;
}

export function addTableColumnBefore(): Command {
  return addColumnBefore;
}

export function addTableColumnAfter(): Command {
  return addColumnAfter;
}

export function deleteCurrentTableRow(): Command {
  return deleteRow;
}

export function deleteCurrentTableColumn(): Command {
  return deleteColumn;
}

export function deleteCurrentTable(): Command {
  return deleteTable;
}

export function setTableColumnAlignment(align: TableColumnAlignment): Command {
  return (state, dispatch) => {
    const context = findTableContext(state);
    if (!context) return false;

    const tr = state.tr;
    for (let rowIndex = 0; rowIndex < context.map.height; rowIndex += 1) {
      const cellPosition = context.tableStart + context.map.positionAt(rowIndex, context.columnIndex, context.table);
      const cell = tr.doc.nodeAt(cellPosition);
      if (cell) {
        tr.setNodeMarkup(cellPosition, undefined, { ...cell.attrs, align });
      }
    }
    dispatch?.(tr.scrollIntoView());
    return true;
  };
}

export function toggleFirstTableRowHeader(): Command {
  return (state, dispatch) => {
    const context = findTableContext(state);
    if (!context || context.map.height === 0) return false;

    const firstRowCells = Array.from({ length: context.map.width }, (_, columnIndex) => {
      const position = context.tableStart + context.map.positionAt(0, columnIndex, context.table);
      return { position, node: state.doc.nodeAt(position) };
    }).filter((cell): cell is { position: number; node: ProseMirrorNode } => Boolean(cell.node));

    const shouldDisableHeader = firstRowCells.every((cell) => cell.node.type === schema.nodes.table_header);
    const targetType = shouldDisableHeader ? schema.nodes.table_cell : schema.nodes.table_header;
    const tr = state.tr;
    for (const cell of firstRowCells) {
      tr.setNodeMarkup(cell.position, targetType, cell.node.attrs);
    }
    dispatch?.(tr.scrollIntoView());
    return true;
  };
}

export function normalizeFirstTableRowHeader(): Command {
  return (state, dispatch) => {
    const context = findTableContext(state);
    if (!context || context.map.height === 0) return false;

    const tr = state.tr;
    const touched = new Set<number>();

    for (let rowIndex = 0; rowIndex < context.map.height; rowIndex += 1) {
      const targetType = rowIndex === 0 ? schema.nodes.table_header : schema.nodes.table_cell;

      for (let columnIndex = 0; columnIndex < context.map.width; columnIndex += 1) {
        const cellPosition = context.tableStart + context.map.positionAt(rowIndex, columnIndex, context.table);
        if (touched.has(cellPosition)) continue;
        touched.add(cellPosition);

        const cell = state.doc.nodeAt(cellPosition);
        if (cell && cell.type !== targetType) {
          tr.setNodeMarkup(cellPosition, targetType, cell.attrs);
        }
      }
    }

    if (!tr.docChanged) return false;
    dispatch?.(tr.scrollIntoView());
    return true;
  };
}

function createTableRow(columns: number, rowIndex: number, header: boolean): ProseMirrorNode {
  const cellType = header ? schema.nodes.table_header : schema.nodes.table_cell;
  const cells = Array.from({ length: columns }, (_, columnIndex) => {
    const label = header ? `列 ${columnIndex + 1}` : `单元格 ${rowIndex}-${columnIndex + 1}`;
    return cellType.createAndFill(null, schema.nodes.paragraph.create(null, schema.text(label)));
  }).filter((cell): cell is ProseMirrorNode => Boolean(cell));

  return schema.nodes.table_row.createChecked(null, cells);
}

function findTableContext(state: EditorState): TableContext | null {
  const { $from } = state.selection;
  let tableDepth = -1;
  let cellDepth = -1;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const role = $from.node(depth).type.spec.tableRole;
    if (role === 'cell' || role === 'header_cell') {
      cellDepth = depth;
    }
    if (role === 'table') {
      tableDepth = depth;
      break;
    }
  }

  if (tableDepth < 0 || cellDepth < 0) return null;

  const table = $from.node(tableDepth);
  const tableStart = $from.before(tableDepth) + 1;
  const cellPosition = $from.before(cellDepth);
  const map = TableMap.get(table);
  const rect = map.findCell(cellPosition - tableStart);

  return {
    table,
    tableStart,
    rowIndex: rect.top,
    columnIndex: rect.left,
    map
  };
}
