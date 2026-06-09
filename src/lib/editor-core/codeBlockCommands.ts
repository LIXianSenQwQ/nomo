import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';

/**
 * 在代码块下方块的开头按 Backspace 时，直接删除前一个代码块。
 *
 * ProseMirror 默认会先选中前一个可选块节点；但 code_block 的 NodeView 在选中后会进入编辑态，
 * 导致用户想“删除上方代码块”时被带进代码编辑。这里仅处理光标位于文本块起始处且前一个同级节点
 * 正好是 code_block 的场景，其它 Backspace 行为继续交给默认命令链。
 */
export function deleteCodeBlockBeforeCursor(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const { $from, empty } = state.selection;
  if (
    !empty ||
    !$from.parent.isTextblock ||
    $from.parent.type === state.schema.nodes.code_block ||
    $from.parentOffset !== 0
  ) {
    return false;
  }

  const currentBlockStart = $from.before($from.depth);
  const nodeBefore = state.doc.resolve(currentBlockStart).nodeBefore;
  if (!nodeBefore || nodeBefore.type !== state.schema.nodes.code_block) {
    return false;
  }

  if (dispatch) {
    const deleteFrom = currentBlockStart - nodeBefore.nodeSize;
    const tr = state.tr.delete(deleteFrom, currentBlockStart);
    const cursorPos = tr.mapping.map($from.pos, -1);
    dispatch(tr.setSelection(TextSelection.create(tr.doc, cursorPos)).scrollIntoView());
  }

  return true;
}
