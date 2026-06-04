import { describe, expect, it } from 'vitest';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { TableMap } from 'prosemirror-tables';
import { addTableRowAfter, createTableNode } from './tableCommands';
import { schema } from './schema';

function findCellTextPosition(
  doc: ProseMirrorNode,
  rowIndex: number,
  columnIndex: number,
): number {
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
});
