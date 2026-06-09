import { describe, expect, it } from 'vitest';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { TableMap } from 'prosemirror-tables';
import { addTableRowAfter, createTableNode, resizeCurrentTable } from './tableCommands';
import { schema } from './schema';

function findCellTextPosition(doc: ProseMirrorNode, rowIndex: number, columnIndex: number): number {
  let tableStart = -1;
  let tableNode: ProseMirrorNode | null = null;

  doc.descendants((node, pos) => {
    if (node.type.name === 'table') {
      tableStart = pos + 1;
      tableNode = node;
      return false;
    }
    return true;
  });

  if (!tableNode) throw new Error('table not found');
  const map = TableMap.get(tableNode);
  const cellPos = tableStart + map.positionAt(rowIndex, columnIndex, tableNode);
  return cellPos + 2;
}

function createTextTable(rows: string[][], headerFirstRow = true): ProseMirrorNode {
  const tableRows = rows.map((row, rowIndex) => {
    const cellType =
      headerFirstRow && rowIndex === 0 ? schema.nodes.table_header : schema.nodes.table_cell;
    const cells = row.map((text) =>
      cellType.create(null, schema.nodes.paragraph.create(null, text ? schema.text(text) : null)),
    );
    return schema.nodes.table_row.create(null, cells);
  });
  return schema.nodes.table.create(null, tableRows);
}

function findFirstTable(doc: ProseMirrorNode): ProseMirrorNode {
  let table: ProseMirrorNode | null = null;
  doc.descendants((node) => {
    if (node.type.name === 'table') {
      table = node;
      return false;
    }
    return true;
  });
  if (!table) throw new Error('table not found');
  return table;
}

function getTableSize(table: ProseMirrorNode): { rows: number; columns: number } {
  const map = TableMap.get(table);
  return { rows: map.height, columns: map.width };
}

describe('tableCommands', () => {
  it('新增下方行后把光标移动到新行同列单元格', () => {
    const table = createTableNode(1, 2);
    const doc = schema.nodes.doc.create(null, [table]);
    let state = EditorState.create({
      doc,
    });
    const cellTextPos = findCellTextPosition(state.doc, 1, 0);
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, cellTextPos)));

    addTableRowAfter()(state, (tr) => {
      state = state.apply(tr);
    });

    const { $from } = state.selection;
    let rowIndex = -1;
    let cellIndex = -1;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name === 'table_row') {
        rowIndex = $from.index(depth - 1);
      }
      if (
        $from.node(depth).type.name === 'table_cell' ||
        $from.node(depth).type.name === 'table_header'
      ) {
        cellIndex = $from.index(depth - 1);
      }
    }

    expect(rowIndex).toBe(2);
    expect(cellIndex).toBe(0);
  });

  it('调整表格变大时保留已有单元格内容', () => {
    const table = createTextTable([
      ['A1', 'A2'],
      ['B1', 'B2'],
    ]);
    const doc = schema.nodes.doc.create(null, [table]);
    let state = EditorState.create({ doc });
    state = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, findCellTextPosition(state.doc, 1, 0))),
    );

    resizeCurrentTable(3, 4)(state, (tr) => {
      state = state.apply(tr);
    });

    const resizedTable = findFirstTable(state.doc);
    expect(getTableSize(resizedTable)).toEqual({ rows: 3, columns: 4 });
    expect(resizedTable.textContent).toContain('A1');
    expect(resizedTable.textContent).toContain('B2');
  });

  it('调整表格变小时直接删除超出的行列内容', () => {
    const table = createTextTable([
      ['A1', 'A2', 'A3'],
      ['B1', 'B2', 'B3'],
      ['C1', 'C2', 'C3'],
    ]);
    const doc = schema.nodes.doc.create(null, [table]);
    let state = EditorState.create({ doc });
    state = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, findCellTextPosition(state.doc, 1, 0))),
    );

    resizeCurrentTable(2, 2)(state, (tr) => {
      state = state.apply(tr);
    });

    const resizedTable = findFirstTable(state.doc);
    expect(getTableSize(resizedTable)).toEqual({ rows: 2, columns: 2 });
    expect(resizedTable.textContent).toContain('A1');
    expect(resizedTable.textContent).toContain('B2');
    expect(resizedTable.textContent).not.toContain('A3');
    expect(resizedTable.textContent).not.toContain('C1');
  });

  it('调整表格变大时保留表头行并让新增行保持普通单元格', () => {
    const table = createTextTable([
      ['H1', 'H2'],
      ['B1', 'B2'],
    ]);
    const doc = schema.nodes.doc.create(null, [table]);
    let state = EditorState.create({ doc });
    state = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, findCellTextPosition(state.doc, 1, 0))),
    );

    resizeCurrentTable(3, 3)(state, (tr) => {
      state = state.apply(tr);
    });

    const resizedTable = findFirstTable(state.doc);
    const firstRow = resizedTable.child(0);
    const newBodyRow = resizedTable.child(2);
    expect(firstRow.child(0).type).toBe(schema.nodes.table_header);
    expect(firstRow.child(2).type).toBe(schema.nodes.table_header);
    expect(newBodyRow.child(0).type).toBe(schema.nodes.table_cell);
    expect(newBodyRow.child(2).type).toBe(schema.nodes.table_cell);
  });
});
