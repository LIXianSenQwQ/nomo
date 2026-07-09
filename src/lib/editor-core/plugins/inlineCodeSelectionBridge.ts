import { Plugin } from 'prosemirror-state';
import type { Mark, Node as ProseMirrorNode } from 'prosemirror-model';
import { Decoration, DecorationSet } from 'prosemirror-view';

const SELECTION_BRIDGE_CLASS = 'pm-inline-selection-bridge';
const CODE_BRIDGE_CLASS = 'pm-inline-code-selection-bridge';

type CodeRange = {
  from: number;
  to: number;
};

/**
 * 行内代码选区桥接插件。
 *
 * 浏览器原生选区只绘制字形区域，行内 code 的 padding/border 会把选区切断。
 * 这里给真实选区加一层可控背景，并在选区碰到 code 时临时移除 code 胶囊外观。
 */
export function inlineCodeSelectionBridgePlugin(): Plugin<DecorationSet> {
  return new Plugin({
    state: {
      init(_, state) {
        return buildInlineCodeSelectionBridgeDecorations(
          state.doc,
          state.selection.from,
          state.selection.to,
        );
      },
      apply(tr, value, _oldState, newState) {
        if (tr.docChanged || tr.selectionSet) {
          return buildInlineCodeSelectionBridgeDecorations(
            newState.doc,
            newState.selection.from,
            newState.selection.to,
          );
        }
        return value;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}

export function buildInlineCodeSelectionBridgeDecorations(
  doc: ProseMirrorNode,
  selectionFrom: number,
  selectionTo: number,
): DecorationSet {
  if (selectionFrom === selectionTo) {
    return DecorationSet.empty;
  }

  const from = Math.min(selectionFrom, selectionTo);
  const to = Math.max(selectionFrom, selectionTo);
  const decorations: Decoration[] = [
    Decoration.inline(from, to, {
      class: SELECTION_BRIDGE_CLASS,
    }),
  ];

  for (const range of findCodeRanges(doc)) {
    const overlap = getSelectionOverlap(range, from, to);
    if (!overlap) continue;
    decorations.push(
      Decoration.inline(overlap.from, overlap.to, {
        class: CODE_BRIDGE_CLASS,
      }),
    );
  }

  return decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty;
}

function findCodeRanges(doc: ProseMirrorNode): CodeRange[] {
  const ranges: CodeRange[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text || !hasCodeMark(node.marks)) return true;

    const from = pos;
    const to = pos + node.nodeSize;
    const previous = ranges[ranges.length - 1];
    if (previous && previous.to === from) {
      previous.to = to;
      return true;
    }

    ranges.push({ from, to });
    return true;
  });

  return ranges;
}

function hasCodeMark(marks: readonly Mark[]): boolean {
  return marks.some((mark) => mark.type.name === 'code');
}

function getSelectionOverlap(
  range: CodeRange,
  selectionFrom: number,
  selectionTo: number,
): CodeRange | null {
  const from = Math.max(range.from, selectionFrom);
  const to = Math.min(range.to, selectionTo);
  return from < to ? { from, to } : null;
}
