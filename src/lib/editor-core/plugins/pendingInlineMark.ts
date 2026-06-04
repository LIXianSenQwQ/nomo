import { toggleMark } from 'prosemirror-commands';
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import type { Mark, MarkType, ResolvedPos } from 'prosemirror-model';
import { Decoration, DecorationSet } from 'prosemirror-view';

/**
 * 行内格式编辑态插件：
 * 当 selection collapsed 时点击加粗/斜体/删除线/下划线，
 * 不直接插入 Markdown 字符，而是进入 pending mark 状态。
 * 语义模式下用 WidgetDecoration 显示灰色语法提示（**|**），模拟 Typora / Typedown 的编辑态。
 * 用户继续输入时，新内容自动带对应 mark；退出条件：
 * - 再次点击相同按钮
 * - 按 Esc
 * - 光标移出当前块
 * 光标回到已有 mark 范围内（包含范围头尾）时，也会显示该范围的灰色头尾标记。
 */

interface PendingMarkState {
  /** 是否处于 pending 状态 */
  active: boolean;
  /** 当前待定的 mark 类型名称列表，可同时包含加粗、斜体、删除线、下划线 */
  markTypeNames: string[];
  /** 锚点位置：进入 pending 时光标所在的文档位置，用于检测光标是否移出当前块 */
  anchorPos: number;
  /** 当前光标位置：用于把闭合语法提示固定在已输入内容之后 */
  headPos: number;
}

const INACTIVE_STATE: PendingMarkState = {
  active: false,
  markTypeNames: [],
  anchorPos: 0,
  headPos: 0,
};

// 每种 mark 对应的开闭分隔符文本
const MARK_SYNTAX: Record<string, { open: string; close: string }> = {
  strong: { open: '**', close: '**' },
  em: { open: '*', close: '*' },
  strikethrough: { open: '~~', close: '~~' },
  underline: { open: '<u>', close: '</u>' },
};

type MarkEditRange = {
  markTypeName: string;
  from: number;
  to: number;
};

type GroupedMarkEditRange = {
  markTypeNames: string[];
  from: number;
  to: number;
};

export const pendingInlineMarkKey = new PluginKey<PendingMarkState>('pendingInlineMark');

/** 安全获取 pending mark 插件状态，未注册时返回 INACTIVE_STATE */
function getPendingState(state: EditorState): PendingMarkState {
  return pendingInlineMarkKey.getState(state) ?? INACTIVE_STATE;
}

/**
 * 判断指定 mark 类型是否处于 pending 状态
 */
export function isPendingMarkActive(state: EditorState, markType: MarkType): boolean {
  const s = getPendingState(state);
  return s.active && s.markTypeNames.includes(markType.name);
}

export function pendingInlineMarkPlugin(): Plugin<PendingMarkState> {
  return new Plugin<PendingMarkState>({
    key: pendingInlineMarkKey,

    state: {
      init(): PendingMarkState {
        return INACTIVE_STATE;
      },
      apply(tr, value): PendingMarkState {
        const meta = tr.getMeta(pendingInlineMarkKey) as
          | { action: 'set'; markTypeNames: string[] }
          | { action: 'exit' }
          | undefined;

        // 显式设置/退出 pending
        if (meta?.action === 'set') {
          if (meta.markTypeNames.length === 0) return INACTIVE_STATE;
          return {
            active: true,
            markTypeNames: meta.markTypeNames,
            anchorPos: tr.selection.from,
            headPos: tr.selection.from,
          };
        }
        if (meta?.action === 'exit') {
          return INACTIVE_STATE;
        }

        // 未激活时不跟踪
        if (!value.active) return value;

        const anchorPos = tr.docChanged ? tr.mapping.map(value.anchorPos, -1) : value.anchorPos;
        const headPos = tr.selection.from;

        // 用户主动拉起选区或把光标移出原块时，结束 pending，避免后续输入带上旧格式。
        if (!tr.selection.empty || !isSameTextblock(tr.doc, anchorPos, headPos)) {
          return INACTIVE_STATE;
        }

        if (tr.selectionSet && !tr.docChanged && headPos !== value.headPos) {
          return INACTIVE_STATE;
        }

        return { ...value, anchorPos, headPos };
      },
    },

    props: {
      decorations(state) {
        const pending = getPendingState(state);
        const ranges = pending.active
          ? pending.markTypeNames.map((markTypeName) => ({
              markTypeName,
              from: pending.anchorPos,
              to: pending.headPos,
            }))
          : findMarkEditRangesAtCursor(state);

        if (ranges.length === 0) return DecorationSet.empty;

        return DecorationSet.create(state.doc, createDelimiterDecorations(state, ranges));
      },

      handleDOMEvents: {
        mousedown(view, event) {
          return handleEditRangeBoundaryMouseDown(view, event);
        },

        blur(view) {
          if (!getPendingState(view.state).active) return false;

          window.setTimeout(() => {
            if (view.hasFocus() || !getPendingState(view.state).active) return;
            exitPending(view.dispatch, view.state);
          }, 0);

          return false;
        },
      },

      handleKeyDown(view, event) {
        // Esc → 退出 pending 状态
        if (event.key === 'Escape') {
          const pending = getPendingState(view.state);
          if (pending.active) {
            exitPending(view.dispatch, view.state);
            return true;
          }
        }
        // 方向键 → 退出 pending 状态（用户主动移动光标，结束格式输入）
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          const pending = getPendingState(view.state);
          if (pending.active) {
            exitPending(view.dispatch, view.state);
            // 不 return true，让 ProseMirror 正常处理光标移动
          }
        }
        return false;
      },
    },
  });
}

/** 退出 pending mark 状态，清除 storedMarks */
function exitPending(
  dispatch: (tr: Transaction) => void,
  state: EditorState,
): void {
  const tr = state.tr;
  // 清除所有 storedMarks，防止后续输入意外带格式
  const storedMarks = state.storedMarks;
  if (storedMarks) {
    for (const mark of storedMarks) {
      tr.removeStoredMark(mark);
    }
  }
  tr.setMeta(pendingInlineMarkKey, { action: 'exit' });
  dispatch(tr);
}

/**
 * 切换行内格式的 pending 状态（用于 collapsed selection）。
 * 有选区时走标准 toggleMark 逻辑；无选区时进入/退出 pending 状态。
 */
export function toggleMarkPending(markType: MarkType): Command {
  return (state, dispatch) => {
    const { empty } = state.selection;

    // 有选区：使用标准 toggleMark 逻辑
    if (!empty) {
      return toggleMark(markType)(state, dispatch);
    }

    // 无选区：切换 pending 状态
    const pending = getPendingState(state);

    if (pending.active && pending.markTypeNames.includes(markType.name)) {
      // 同一个 mark → 仅退出当前 mark，其他 pending mark 保持
      if (dispatch) {
        const tr = state.tr.removeStoredMark(markType);
        const markTypeNames = pending.markTypeNames.filter((name) => name !== markType.name);
        if (markTypeNames.length === 0) {
          tr.setMeta(pendingInlineMarkKey, { action: 'exit' });
        } else {
          tr.setMeta(pendingInlineMarkKey, { action: 'set', markTypeNames });
        }
        dispatch(tr);
      }
      return true;
    }

    // 不同 mark 或无 pending → 叠加新的 pending 状态
    if (dispatch) {
      const tr = state.tr;
      tr.addStoredMark(markType.create());
      tr.setMeta(pendingInlineMarkKey, {
        action: 'set',
        markTypeNames: uniqueMarkTypeNames([...pending.markTypeNames, markType.name]),
      });
      dispatch(tr);
    }
    return true;
  };
}

function uniqueMarkTypeNames(markTypeNames: string[]): string[] {
  return Array.from(new Set(markTypeNames.filter((name) => MARK_SYNTAX[name])));
}

function createDelimiterElement(text: string, markTypeName: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'pm-inline-mark-edit-delimiter pm-pending-mark-delimiter';
  el.setAttribute('data-mark', markTypeName);
  el.textContent = text;
  // 不可选中，避免干扰光标定位和复制
  el.contentEditable = 'false';
  return el;
}

function createDelimiterDecorations(
  state: EditorState,
  ranges: readonly MarkEditRange[],
): Decoration[] {
  const docSize = state.doc.content.size;
  const decorations: Decoration[] = [];

  for (const range of groupMarkEditRanges(ranges)) {
    const openPos = clampDocPos(range.from, docSize);
    const closePos = clampDocPos(range.to, docSize);
    const openText = range.markTypeNames.map((markTypeName) => MARK_SYNTAX[markTypeName]?.open ?? '').join('');
    const closeText = [...range.markTypeNames]
      .reverse()
      .map((markTypeName) => MARK_SYNTAX[markTypeName]?.close ?? '')
      .join('');

    if (openPos < closePos) {
      decorations.push(
        Decoration.inline(
          openPos,
          closePos,
          {
            class: 'pm-inline-mark-edit-range',
            'data-mark': range.markTypeNames[0],
            'data-marks': range.markTypeNames.join(' '),
            'data-from': String(openPos),
            'data-to': String(closePos),
            'data-open': openText,
            'data-close': closeText,
            style: `--pm-inline-mark-open-ch: ${openText.length}; --pm-inline-mark-close-ch: ${closeText.length};`,
          },
          {
            inclusiveStart: false,
            inclusiveEnd: false,
          },
        ),
      );
      continue;
    }

    decorations.push(
      Decoration.widget(openPos, () => createDelimiterElement(openText, range.markTypeNames[0]), {
        // 空 pending 没有可包裹的范围，用 widget 作为临时占位；让真实光标停在两个标记之间。
        side: -1,
        marks: [],
      }),
      Decoration.widget(closePos, () => createDelimiterElement(closeText, range.markTypeNames[0]), {
        side: 1,
        marks: [],
      }),
    );
  }

  return decorations;
}

function groupMarkEditRanges(ranges: readonly MarkEditRange[]): GroupedMarkEditRange[] {
  const groups = new Map<string, GroupedMarkEditRange>();
  for (const range of ranges) {
    if (!MARK_SYNTAX[range.markTypeName]) continue;

    const key = `${range.from}:${range.to}`;
    const group = groups.get(key);
    if (group) {
      group.markTypeNames = uniqueMarkTypeNames([...group.markTypeNames, range.markTypeName]);
      continue;
    }

    groups.set(key, {
      markTypeNames: uniqueMarkTypeNames([range.markTypeName]),
      from: range.from,
      to: range.to,
    });
  }

  return Array.from(groups.values());
}

function findMarkEditRangesAtCursor(state: EditorState): MarkEditRange[] {
  if (!state.selection.empty) return [];

  const $cursor = state.selection.$from;
  if (!$cursor.parent.isTextblock) return [];

  const ranges: MarkEditRange[] = [];
  for (const markTypeName of Object.keys(MARK_SYNTAX)) {
    const markType = state.schema.marks[markTypeName];
    if (!markType) continue;

    const range = findMarkRangeAtCursor($cursor, markType);
    if (range) ranges.push({ markTypeName, ...range });
  }

  return ranges;
}

function handleEditRangeBoundaryMouseDown(
  view: {
    state: EditorState;
    dispatch: (tr: Transaction) => void;
    focus: () => void;
    dom: HTMLElement;
  },
  event: MouseEvent,
): boolean {
  const rangeHit = findEditRangeBoundaryHit(view.dom, event);
  if (!rangeHit) return false;

  const { edge, rangeElement } = rangeHit;
  const markTypeNames =
    rangeElement.dataset.marks?.split(/\s+/).filter(Boolean) ??
    [rangeElement.dataset.mark ?? ''];
  const from = Number(rangeElement.dataset.from);
  const to = Number(rangeElement.dataset.to);
  const markTypes = markTypeNames
    .map((markTypeName) => view.state.schema.marks[markTypeName])
    .filter((markType): markType is MarkType => Boolean(markType));
  if (markTypes.length === 0 || !Number.isFinite(from) || !Number.isFinite(to)) return false;

  if (edge === 'open') {
    event.preventDefault();
    const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, from));
    for (const markType of markTypes) tr.addStoredMark(markType.create());
    view.dispatch(tr);
    view.focus();
    return true;
  }

  if (edge === 'close') {
    event.preventDefault();
    const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, to));
    for (const markType of markTypes) tr.removeStoredMark(markType);
    view.dispatch(tr);
    view.focus();
    return true;
  }

  return false;
}

function findEditRangeBoundaryHit(
  root: HTMLElement,
  event: MouseEvent,
): { edge: 'open' | 'close'; rangeElement: HTMLElement } | null {
  const target = event.target;
  const targetRange =
    target instanceof Element ? target.closest<HTMLElement>('.pm-inline-mark-edit-range') : null;
  const ranges = targetRange
    ? [targetRange]
    : Array.from(root.querySelectorAll<HTMLElement>('.pm-inline-mark-edit-range'));

  let nearest: { edge: 'open' | 'close'; rangeElement: HTMLElement; distance: number } | null =
    null;

  for (const rangeElement of ranges) {
    const hit = getBoundaryHitForElement(rangeElement, event);
    if (!hit) continue;

    if (!nearest || hit.distance < nearest.distance) {
      nearest = { ...hit, rangeElement };
    }
  }

  if (!nearest) return null;
  return { edge: nearest.edge, rangeElement: nearest.rangeElement };
}

function getBoundaryHitForElement(
  rangeElement: HTMLElement,
  event: MouseEvent,
): { edge: 'open' | 'close'; distance: number } | null {
  const rect = rangeElement.getBoundingClientRect();
  const verticalSlop = Math.max(4, rect.height * 0.35);
  if (event.clientY < rect.top - verticalSlop || event.clientY > rect.bottom + verticalSlop) {
    return null;
  }

  const openWidth = estimateDelimiterWidth(rangeElement.dataset.open ?? '', rangeElement);
  const closeWidth = estimateDelimiterWidth(rangeElement.dataset.close ?? '', rangeElement);
  const openStart = rect.left;
  const openEnd = rect.left + openWidth;
  const closeStart = rect.right - closeWidth;
  const closeEnd = rect.right;
  const outsideSlop = 6;

  if (event.clientX >= openStart - outsideSlop && event.clientX <= openEnd) {
    return {
      edge: 'open',
      distance: distanceToSegment(event.clientX, openStart, openEnd),
    };
  }

  if (event.clientX >= closeStart && event.clientX <= closeEnd + outsideSlop) {
    return {
      edge: 'close',
      distance: distanceToSegment(event.clientX, closeStart, closeEnd),
    };
  }

  return null;
}

function distanceToSegment(value: number, from: number, to: number): number {
  if (value < from) return from - value;
  if (value > to) return value - to;
  return 0;
}

function estimateDelimiterWidth(text: string, element: HTMLElement): number {
  if (!text) return 0;

  const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
  const charWidth = Number.isFinite(fontSize) ? fontSize * 0.56 : 8;
  return Math.max(8, text.length * charWidth);
}

function findMarkRangeAtCursor(
  $cursor: ResolvedPos,
  markType: MarkType,
): { from: number; to: number } | null {
  const parent = $cursor.parent;
  const cursorOffset = $cursor.parentOffset;
  const start = $cursor.start();
  let offset = 0;
  let markedChildIndex = -1;

  parent.forEach((child, childOffset, index) => {
    if (markedChildIndex >= 0 || !child.isInline) return;
    const childEnd = childOffset + child.nodeSize;
    const containsCursor =
      (cursorOffset > childOffset && cursorOffset < childEnd) ||
      (cursorOffset === childOffset && hasMark(child.marks, markType)) ||
      (cursorOffset === childEnd && hasMark(child.marks, markType));

    if (containsCursor && hasMark(child.marks, markType)) {
      markedChildIndex = index;
    }
  });

  if (markedChildIndex < 0) return null;

  let fromOffset = 0;
  let toOffset = 0;
  let childStart = 0;
  let found = false;
  const children: Array<{ marks: readonly Mark[]; nodeSize: number; start: number }> = [];

  parent.forEach((child) => {
    children.push({ marks: child.marks, nodeSize: child.nodeSize, start: offset });
    offset += child.nodeSize;
  });

  for (let index = markedChildIndex; index >= 0; index -= 1) {
    const child = children[index];
    if (!hasMark(child.marks, markType)) break;
    childStart = child.start;
  }
  fromOffset = childStart;

  for (let index = markedChildIndex; index < children.length; index += 1) {
    const child = children[index];
    if (!hasMark(child.marks, markType)) break;
    toOffset = child.start + child.nodeSize;
    found = true;
  }

  if (!found || fromOffset === toOffset) return null;
  return { from: start + fromOffset, to: start + toOffset };
}

function hasMark(marks: readonly Mark[], markType: MarkType): boolean {
  return marks.some((mark) => mark.type === markType);
}

function clampDocPos(pos: number, docSize: number): number {
  return Math.min(Math.max(pos, 0), docSize);
}

function isSameTextblock(doc: EditorState['doc'], anchorPos: number, headPos: number): boolean {
  if (anchorPos < 0 || headPos < 0 || anchorPos > doc.content.size || headPos > doc.content.size) {
    return false;
  }

  const $anchor = doc.resolve(anchorPos);
  const $head = doc.resolve(headPos);
  return $anchor.parent.isTextblock && $anchor.sameParent($head);
}
