import type { EditorView } from 'prosemirror-view';

/**
 * 定位当前光标所在表格对应的 DOM 节点。
 * 表格可能被 ProseMirror 包装在外层元素中，因此需要兼容直接 table 和内层 table 两种结构。
 */
export function findActiveTableElement(view: EditorView): HTMLTableElement | null {
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.spec.tableRole === 'table') {
      const tablePosition = $from.before(depth);
      const dom = view.nodeDOM(tablePosition);
      return dom instanceof HTMLTableElement
        ? dom
        : dom instanceof HTMLElement
          ? dom.querySelector('table')
          : null;
    }
  }
  return null;
}
