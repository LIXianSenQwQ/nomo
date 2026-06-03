import { Plugin, PluginKey, NodeSelection } from 'prosemirror-state';
import type { Node as ProseMirrorNode, ResolvedPos } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';

/**
 * codeBlockNavigation 插件 —— 处理代码块的上下方向键导航
 *
 * ProseMirror 默认会跳过 atomic 节点（code_block），导致 ↓ 直接跳到代码块下方。
 * 本插件在 handleKeyDown（早于 keymap 和默认处理）中拦截：
 *   1. 光标在文本块边界且紧邻代码块 → 直接进入代码块编辑态
 *   2. 代码块已选中 → 进入编辑态
 */

// 对外暴露的回调：由 ProseMirrorEditorCore 注入，用于获取 NodeView 实例
export type CodeBlockNavCallback = {
  /** 阶段2：代码块已选中，调用 enterEdit 进入编辑态 */
  enterEditAt: (view: EditorView, pos: number, clickLine: number, caret: 'start' | 'end') => void;
};

export const codeBlockNavigationKey = new PluginKey('codeBlockNavigation');

type AdjacentCodeBlock = {
  node: ProseMirrorNode;
  pos: number;
};

const VISUAL_LINE_TOLERANCE_PX = 4;

function isSameVisualLine(view: EditorView, a: number, b: number): boolean {
  try {
    const aRect = view.coordsAtPos(a);
    const bRect = view.coordsAtPos(b);
    return Math.abs(aRect.top - bRect.top) <= VISUAL_LINE_TOLERANCE_PX;
  } catch {
    return false;
  }
}

function isOnLastVisualLine(view: EditorView, $from: ResolvedPos): boolean {
  if ($from.parentOffset === $from.parent.content.size) return true;
  const textblockEnd = $from.start($from.depth) + $from.parent.content.size;
  return isSameVisualLine(view, $from.pos, textblockEnd);
}

function isOnFirstVisualLine(view: EditorView, $from: ResolvedPos): boolean {
  if ($from.parentOffset === 0) return true;
  const textblockStart = $from.start($from.depth);
  return isSameVisualLine(view, $from.pos, textblockStart);
}

function findNextCodeBlock(
  $from: ResolvedPos,
  canLeaveTextblock: boolean,
): AdjacentCodeBlock | null {
  if (!canLeaveTextblock) return null;

  for (let depth = $from.depth; depth > 0; depth--) {
    // 只有光标位于当前文本块以及所有祖先容器的末端时，才允许向外寻找下一个文档块。
    if (depth < $from.depth && $from.indexAfter(depth) !== $from.node(depth).childCount) {
      return null;
    }

    const nextPos = $from.after(depth);
    const nodeAfter = $from.doc.resolve(nextPos).nodeAfter;
    if (nodeAfter?.type.name === 'code_block') {
      return { node: nodeAfter, pos: nextPos };
    }
    if (nodeAfter) return null;
  }

  return null;
}

function findPreviousCodeBlock(
  $from: ResolvedPos,
  canLeaveTextblock: boolean,
): AdjacentCodeBlock | null {
  if (!canLeaveTextblock) return null;

  for (let depth = $from.depth; depth > 0; depth--) {
    // 只有光标位于当前文本块以及所有祖先容器的开端时，才允许向外寻找上一个文档块。
    if (depth < $from.depth && $from.index(depth) !== 0) {
      return null;
    }

    const currentPos = $from.before(depth);
    const nodeBefore = $from.doc.resolve(currentPos).nodeBefore;
    if (nodeBefore?.type.name === 'code_block') {
      return { node: nodeBefore, pos: currentPos - nodeBefore.nodeSize };
    }
    if (nodeBefore) return null;
  }

  return null;
}

export function codeBlockNavigationPlugin(callback: CodeBlockNavCallback): Plugin {
  return new Plugin({
    key: codeBlockNavigationKey,
    props: {
      handleKeyDown(_view, event) {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false;

        const view = _view;
        const state = view.state;
        const { selection } = state;

        // 代码块已选中（NodeSelection）→ 进入编辑态
        if (selection instanceof NodeSelection && selection.node.type.name === 'code_block') {
          event.preventDefault();
          if (event.key === 'ArrowDown') {
            callback.enterEditAt(view, selection.from, 0, 'end');
          } else {
            // ArrowUp：光标在末行末尾
            const code = selection.node.textContent;
            const lastLine = code.split('\n').length - 1;
            callback.enterEditAt(view, selection.from, lastLine, 'end');
          }
          return true;
        }

        // 光标在文本块边界且紧邻代码块 → 直接进入代码块编辑态
        const { $from, empty } = selection;
        if (!empty) return false;
        if (!$from.parent.isTextblock) return false;

        if (event.key === 'ArrowDown') {
          const nextCodeBlock = findNextCodeBlock($from, isOnLastVisualLine(view, $from));
          if (nextCodeBlock) {
            event.preventDefault();
            callback.enterEditAt(view, nextCodeBlock.pos, 0, 'end');
            return true;
          }
        } else {
          const previousCodeBlock = findPreviousCodeBlock($from, isOnFirstVisualLine(view, $from));
          if (previousCodeBlock) {
            event.preventDefault();
            const lastLine = previousCodeBlock.node.textContent.split('\n').length - 1;
            callback.enterEditAt(view, previousCodeBlock.pos, lastLine, 'end');
            return true;
          }
        }

        return false;
      },
    },
  });
}
