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
 *
 * 架构：
 * - Mark 负责语义（strong、em、strikethrough、underline）
 * - Decoration 负责判断当前哪些 mark 需要显示语法提示
 * - WidgetDecoration 渲染不可编辑的灰色占位标签
 *
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
  code: { open: '`', close: '`' },
  strikethrough: { open: '~~', close: '~~' },
  underline: { open: '<u>', close: '</u>' },
  highlight: { open: '<mark>', close: '</mark>' },
};

const DELIMITER_CLICK_SLOP_PX = 6;

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

type MarkBoundaryMouseView = {
  state: EditorState;
  dispatch: (tr: Transaction) => void;
  focus: () => void;
  dom: HTMLElement;
  posAtCoords: (coords: { left: number; top: number }) => { pos: number; inside: number } | null;
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

        return DecorationSet.create(state.doc, createInlineDecorations(state, ranges));
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
          if (handleMarkBoundaryArrowKey(view.state, view.dispatch, event.key)) {
            return true;
          }
        }
        return false;
      },

      handleTextInput(view, from, to, text) {
        if (from !== to || !view.state.selection.empty) return false;

        const starting = getMarkTypeNamesStartingAtCursor(view.state);
        const ending = getMarkTypeNamesEndingAtCursor(view.state);

        const markTypeNames =
          starting?.length
            ? starting
            : ending?.length
              ? ending
              : null;

        if (!markTypeNames || markTypeNames.length === 0) {
          return false;
        }

        // 如果当前是在 mark 内侧，说明用户就是想继续输入 code / strong / em
        if (isCursorOnMarkedSide(view.state, from, markTypeNames)) {
          return false;
        }

        // 如果当前是在 mark 外侧，则强制插入无 mark 文本。
        // 不能使用 insertText 后再 setStoredMarks([])，因为边界位置会先沿用左侧 mark。
        const tr = view.state.tr.replaceRangeWith(from, to, view.state.schema.text(text));
        view.dispatch(
          tr
            .setSelection(TextSelection.create(tr.doc, from + text.length))
            .setStoredMarks([]),
        );

        return true;
      },
    },

    appendTransaction(transactions, oldState, newState) {
      const hasDocChanged = transactions.some((tr) => tr.docChanged);
      const hasSelectionMoved = transactions.some((tr) => tr.selectionSet);

      if (!hasDocChanged && hasSelectionMoved) {
        const tr = restoreMarkedSideAfterSelectionMove(oldState, newState);
        if (tr) return tr;
      }

      if (!hasDocChanged) return null;
      if (!newState.selection.empty || newState.storedMarks) return null;

      const markTypeNames = getMarkTypeNamesEndingAtCursor(newState);
      if (!markTypeNames || markTypeNames.length === 0) return null;

      return newState.tr.setStoredMarks(createMarks(newState, markTypeNames));
    },
  });
}

/** 退出 pending mark 状态，清除 storedMarks */
function exitPending(dispatch: (tr: Transaction) => void, state: EditorState): void {
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

function handleMarkBoundaryArrowKey(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
  key: 'ArrowLeft' | 'ArrowRight',
): boolean {
  if (!state.selection.empty) return false;

  const starting = getMarkTypeNamesStartingAtCursor(state);
  const ending = getMarkTypeNamesEndingAtCursor(state);

  const markTypeNames =
    key === 'ArrowRight'
      ? starting?.length
        ? starting
        : ending
      : ending?.length
        ? ending
        : starting;

  if (!markTypeNames || markTypeNames.length === 0) return false;

  const pos = state.selection.from;

  const atOpeningBoundary = Boolean(
    starting?.some((name) => markTypeNames.includes(name)),
  );
  const currentlyInside = isCursorOnMarkedSide(state, pos, markTypeNames);

  if (key === 'ArrowRight' && atOpeningBoundary && !currentlyInside) {
    dispatch(state.tr.setStoredMarks(createMarks(state, markTypeNames)));
    return true;
  }

  if (key === 'ArrowLeft' && atOpeningBoundary && currentlyInside) {
    dispatch(state.tr.setStoredMarks([]));
    return true;
  }

  if (key === 'ArrowRight' && !atOpeningBoundary && currentlyInside) {
    dispatch(state.tr.setStoredMarks([]));
    return true;
  }

  if (key === 'ArrowLeft' && !atOpeningBoundary && !currentlyInside) {
    dispatch(state.tr.setStoredMarks(createMarks(state, markTypeNames)));
    return true;
  }

  return false;
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

    if (isMarkActiveAtCursor(state, markType)) {
      if (dispatch) {
        dispatch(removeActiveMarkAtCursor(state, markType));
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

function isMarkActiveAtCursor(state: EditorState, markType: MarkType): boolean {
  if (!state.selection.empty) return false;

  const storedMarks = state.storedMarks;
  if (storedMarks) return storedMarks.some((mark) => mark.type === markType);

  return markType.isInSet(state.selection.$from.marks()) != null;
}

function removeActiveMarkAtCursor(state: EditorState, markType: MarkType): Transaction {
  const range = findMarkRangeAtCursor(state.selection.$from, markType);
  const marks = state.storedMarks ?? state.selection.$from.marks();
  const tr = state.tr.setStoredMarks(marks.filter((mark) => mark.type !== markType));
  if (range) tr.removeMark(range.from, range.to, markType);
  return tr;
}

function uniqueMarkTypeNames(markTypeNames: string[]): string[] {
  return Array.from(new Set(markTypeNames.filter((name) => MARK_SYNTAX[name])));
}

/**
 * 创建语法提示装饰。
 *
 * 标签使用 WidgetDecoration 渲染成真实占位节点，但节点本身不可编辑。
 * 这样 `**` / `~~` / `<u>` 作为一个整体参与排版，不会被光标插入到内部。
 */
function createInlineDecorations(
  state: EditorState,
  ranges: readonly MarkEditRange[],
): Decoration[] {
  const docSize = state.doc.content.size;
  const decorations: Decoration[] = [];

  for (const range of groupMarkEditRanges(ranges)) {
    const from = clampDocPos(range.from, docSize);
    const to = clampDocPos(range.to, docSize);
    const markTypeNames = range.markTypeNames;

    // 计算开闭语法文本（按 markTypeNames 顺序拼接 open，逆序拼接 close）
    const openText = markTypeNames.map((name) => MARK_SYNTAX[name]?.open ?? '').join('');
    const closeText = [...markTypeNames]
      .reverse()
      .map((name) => MARK_SYNTAX[name]?.close ?? '')
      .join('');

    if (from < to) {
      decorations.push(
        Decoration.inline(from, to, {
          class: 'pm-mark-delimiter-range',
          'data-mark': markTypeNames[0],
          'data-marks': markTypeNames.join(' '),
          'data-from': String(from),
          'data-to': String(to),
        }),
        Decoration.widget(
          from,
          () => createDelimiterWidget(openText, 'open', markTypeNames, from, to),
          {
            side: getOpenDelimiterSide(state, from, markTypeNames),
            marks: [],
          },
        ),
        Decoration.widget(
          to,
          () => createDelimiterWidget(closeText, 'close', markTypeNames, from, to),
          {
            side: getCloseDelimiterSide(state, to, markTypeNames),
            marks: [],
          },
        ),
      );
    } else {
      decorations.push(
        Decoration.widget(
          from,
          () => createDelimiterWidget(openText, 'open', markTypeNames, from, to),
          {
            side: getOpenDelimiterSide(state, from, markTypeNames),
            marks: [],
          },
        ),
        Decoration.widget(
          from,
          () => createDelimiterWidget(closeText, 'close', markTypeNames, from, to),
          {
            side: getCloseDelimiterSide(state, from, markTypeNames),
            marks: [],
          },
        ),
      );
    }
  }

  return decorations;
}

function getOpenDelimiterSide(
  state: EditorState,
  pos: number,
  markTypeNames: readonly string[],
): number {
  return isCursorOnMarkedSide(state, pos, markTypeNames) ? -1 : 1;
}

function getCloseDelimiterSide(
  state: EditorState,
  pos: number,
  markTypeNames: readonly string[],
): number {
  return isCursorOnMarkedSide(state, pos, markTypeNames) ? 1 : -1;
}

function isCursorOnMarkedSide(
  state: EditorState,
  pos: number,
  markTypeNames: readonly string[],
): boolean {
  if (!state.selection.empty || state.selection.from !== pos) return false;
  const storedMarks = state.storedMarks;
  if (!storedMarks) return false;
  return markTypeNames.every((markTypeName) =>
    storedMarks.some((mark) => mark.type.name === markTypeName),
  );
}

function createMarks(state: EditorState, markTypeNames: readonly string[]): Mark[] {
  return markTypeNames
    .map((markTypeName) => state.schema.marks[markTypeName])
    .filter((markType): markType is MarkType => Boolean(markType))
    .map((markType) => markType.create());
}

function getMarkTypeNamesStartingAtCursor(state: EditorState): string[] | null {
  return getBoundaryMarkTypeNames(state, 'start');
}

function getMarkTypeNamesEndingAtCursor(state: EditorState): string[] | null {
  return getBoundaryMarkTypeNames(state, 'end');
}

function getBoundaryMarkTypeNames(
  state: EditorState,
  boundary: 'start' | 'end',
): string[] | null {
  if (!state.selection.empty) return null;

  const $cursor = state.selection.$from;
  if (!$cursor.parent.isTextblock) return null;

  const leftNames = getSupportedMarkTypeNames($cursor.nodeBefore?.marks ?? []);
  const rightNames = getSupportedMarkTypeNames($cursor.nodeAfter?.marks ?? []);

  const leftSet = new Set(leftNames);
  const rightSet = new Set(rightNames);

  const names =
    boundary === 'start'
      ? rightNames.filter((name) => !leftSet.has(name))
      : leftNames.filter((name) => !rightSet.has(name));

  return names.length > 0 ? uniqueMarkTypeNames(names) : null;
}

function getSupportedMarkTypeNames(marks: readonly Mark[]): string[] {
  return marks
    .map((mark) => mark.type.name)
    .filter((markTypeName) => MARK_SYNTAX[markTypeName]);
}

function restoreMarkedSideAfterSelectionMove(
  oldState: EditorState,
  newState: EditorState,
): Transaction | null {
  if (!oldState.selection.empty || !newState.selection.empty) return null;

  const oldPos = oldState.selection.from;
  const newPos = newState.selection.from;

  if (oldPos === newPos) return null;
  if (newState.storedMarks !== null) return null;

  const movedLeft = newPos < oldPos;
  const movedRight = newPos > oldPos;

  if (!movedLeft && !movedRight) return null;

  const boundaryMarkTypeNames = movedLeft
    ? getMarkTypeNamesStartingAtCursor(newState)
    : getMarkTypeNamesEndingAtCursor(newState);

  if (!boundaryMarkTypeNames || boundaryMarkTypeNames.length === 0) {
    return null;
  }

  if (!wasCursorInsideMarks(oldState, boundaryMarkTypeNames)) {
    return null;
  }

  return newState.tr.setStoredMarks(createMarks(newState, boundaryMarkTypeNames));
}

function wasCursorInsideMarks(
  state: EditorState,
  markTypeNames: readonly string[],
): boolean {
  if (!state.selection.empty) return false;

  const marks = state.storedMarks ?? state.selection.$from.marks();

  return markTypeNames.every((markTypeName) =>
    marks.some((mark) => mark.type.name === markTypeName),
  );
}

function createDelimiterWidget(
  text: string,
  edge: 'open' | 'close',
  markTypeNames: readonly string[],
  from: number,
  to: number,
): HTMLElement {
  const el = document.createElement('span');
  el.className = 'pm-mark-delimiter-widget';
  el.textContent = text;
  el.contentEditable = 'false';
  el.dataset.edge = edge;
  el.dataset.mark = markTypeNames[0] ?? '';
  el.dataset.marks = markTypeNames.join(' ');
  el.dataset.from = String(from);
  el.dataset.to = String(to);
  return el;
}

/**
 * 处理行内 mark 的边界点击。
 *
 * 语法提示标签是不可编辑的整体占位节点。点击标签左半边表示落到标签前，
 * 点击右半边表示落到标签后；如果用户点击标签外侧空白或边界正文字符，
 * 也需要显式设置 storedMarks 来区分同一文档位置的“mark 内侧/外侧”。
 *
 * 内/外判定镜像方向键逻辑（见 handleMarkBoundaryArrowKey）：
 * - 目标位置由 widget 物理半边决定（open→from，close→to）。
 * - 目标侧（要带 mark 还是清空）也由物理半边决定：open 左半/close 右半=外侧，
 *   open 右半/close 左半=内侧。
 * - 只有当光标正好落在该 widget 边界时，才读取当前侧并镜像方向键保护：
 *   当前侧 == 目标侧时不切换 storedMarks（避免已在内侧点内侧 widget 还反向跳）；
 *   当前侧 != 目标侧时按目标侧切换 storedMarks。
 * - 光标不在边界（mark 内部、跨段、选区非空等无法判定当前侧）时退回物理半边硬编码，
 *   保证从别处点过来进入 mark 的正常路径不受影响。
 */
function handleEditRangeBoundaryMouseDown(
  view: MarkBoundaryMouseView,
  event: MouseEvent,
): boolean {
  const rangeHit = findDelimiterWidgetHit(view.dom, event);
  if (!rangeHit) {
    return (
      handleMarkedTextBoundaryMouseDown(view, event) ||
      handleOutsideMarkBoundaryMouseDown(view, event)
    );
  }

  const { edge, widgetElement } = rangeHit;
  const markTypeNames = widgetElement.dataset.marks?.split(/\s+/).filter(Boolean) ?? [
    widgetElement.dataset.mark ?? '',
  ];
  const from = Number(widgetElement.dataset.from);
  const to = Number(widgetElement.dataset.to);
  const markTypes = markTypeNames
    .map((markTypeName) => view.state.schema.marks[markTypeName])
    .filter((markType): markType is MarkType => Boolean(markType));
  if (markTypes.length === 0 || !Number.isFinite(from) || !Number.isFinite(to)) return false;

  event.preventDefault();
  event.stopPropagation();

  const target = resolveBoundaryTarget(edge, from, to);
  const cursorPos = view.state.selection.from;
  // 仅当光标正好落在 widget 的某个边界位置时，才能可靠读取"当前在内侧还是外侧"。
  // 此时镜像方向键逻辑：当前侧 == 目标侧时不反向跳（不切 storedMarks）。
  // 否则（光标在 mark 内部、跨段、选区非空等无法判定当前侧的情况），
  // 退回物理半边硬编码，保证从别处点过来进入 mark 的正常路径不受影响。
  const cursorOnBoundary = view.state.selection.empty && (cursorPos === from || cursorPos === to);

  let wantInside = target.wantInside;
  if (cursorOnBoundary) {
    const currentlyInside = isCursorOnMarkedSide(view.state, cursorPos, markTypeNames);
    // 当前侧与点击的目标侧一致：保持当前 storedMarks，只挪光标位置（避免反向跳）。
    if (currentlyInside === target.wantInside) {
      const marks = target.wantInside ? markTypes.map((markType) => markType.create()) : [];
      const tr = view.state.tr
        .setSelection(TextSelection.create(view.state.doc, target.pos))
        .setStoredMarks(marks);
      view.dispatch(tr);
      view.focus();
      return true;
    }
    // 否则按目标侧切换 storedMarks（与 wantInside 一致，下面统一处理）。
    wantInside = target.wantInside;
  }

  const marks = wantInside ? markTypes.map((markType) => markType.create()) : [];
  const tr = view.state.tr
    .setSelection(TextSelection.create(view.state.doc, target.pos))
    .setStoredMarks(marks);
  view.dispatch(tr);
  view.focus();
  return true;
}

function handleMarkedTextBoundaryMouseDown(
  view: MarkBoundaryMouseView,
  event: MouseEvent,
): boolean {
  if (!view.state.selection.empty) return false;

  let coords: { pos: number; inside: number } | null = null;
  try {
    coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  } catch {
    return false;
  }
  if (!coords) return false;

  for (const range of groupMarkEditRanges(findMarkEditRangesAtCursor(view.state))) {
    if (isCursorOnMarkedSide(view.state, view.state.selection.from, range.markTypeNames)) {
      continue;
    }

    const markTypes = range.markTypeNames
      .map((markTypeName) => view.state.schema.marks[markTypeName])
      .filter((markType): markType is MarkType => Boolean(markType));
    if (markTypes.length === 0) continue;

    const openWidget = findDelimiterWidgetForRange(view.dom, 'open', range);
    const closeWidget = findDelimiterWidgetForRange(view.dom, 'close', range);
    if (!openWidget || !closeWidget) continue;

    const openRect = openWidget.getBoundingClientRect();
    const closeRect = closeWidget.getBoundingClientRect();
    if (!isSameDelimiterLine(event.clientY, openRect, closeRect)) continue;

    const clickedInMarkedText =
      event.clientX > openRect.right && event.clientX < closeRect.left;
    const clickedOpeningTextBoundary = coords.pos === range.from && clickedInMarkedText;
    const clickedClosingTextBoundary = coords.pos === range.to && clickedInMarkedText;
    if (!clickedOpeningTextBoundary && !clickedClosingTextBoundary) continue;

    event.preventDefault();
    event.stopPropagation();

    const pos = clickedOpeningTextBoundary ? range.from : range.to;
    const tr = view.state.tr
      .setSelection(TextSelection.create(view.state.doc, pos))
      .setStoredMarks(markTypes.map((markType) => markType.create()));
    view.dispatch(tr);
    view.focus();
    return true;
  }

  return false;
}

function handleOutsideMarkBoundaryMouseDown(
  view: MarkBoundaryMouseView,
  event: MouseEvent,
): boolean {
  if (!view.state.selection.empty) return false;

  let coords: { pos: number; inside: number } | null = null;
  try {
    coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  } catch {
    coords = null;
  }

  for (const range of groupMarkEditRanges(findMarkEditRangesAtCursor(view.state))) {
    const markTypes = range.markTypeNames
      .map((markTypeName) => view.state.schema.marks[markTypeName])
      .filter((markType): markType is MarkType => Boolean(markType));
    if (markTypes.length === 0) continue;

    const openWidget = findDelimiterWidgetForRange(view.dom, 'open', range);
    const closeWidget = findDelimiterWidgetForRange(view.dom, 'close', range);
    if (!openWidget || !closeWidget) continue;

    const openRect = openWidget.getBoundingClientRect();
    const closeRect = closeWidget.getBoundingClientRect();
    if (!isSameDelimiterLine(event.clientY, openRect, closeRect)) continue;

    const clickedBeforeOpening =
      event.clientX < openRect.left &&
      (coords?.pos === range.from ||
        (!coords && isTextblockBoundary(view.state, range.from, 'start')));
    const clickedAfterClosing =
      event.clientX > closeRect.right &&
      (coords?.pos === range.to ||
        (!coords && isTextblockBoundary(view.state, range.to, 'end')));
    if (!clickedBeforeOpening && !clickedAfterClosing) continue;

    event.preventDefault();
    event.stopPropagation();

    const pos = clickedBeforeOpening ? range.from : range.to;
    const tr = view.state.tr
      .setSelection(TextSelection.create(view.state.doc, pos))
      .setStoredMarks([]);
    view.dispatch(tr);
    view.focus();
    return true;
  }

  return false;
}

function isTextblockBoundary(
  state: EditorState,
  pos: number,
  boundary: 'start' | 'end',
): boolean {
  if (pos < 0 || pos > state.doc.content.size) return false;
  const $pos = state.doc.resolve(pos);
  if (!$pos.parent.isTextblock) return false;
  return boundary === 'start'
    ? $pos.parentOffset === 0
    : $pos.parentOffset === $pos.parent.content.size;
}

/**
 * 根据物理半边计算点击目标位置和目标侧。
 *
 * - open widget：左半落在 from（外侧），右半落在 from（内侧，开标签之后即进入 mark）。
 * - close widget：左半落在 to（内侧，闭标签之前仍是 mark），右半落在 to（外侧）。
 */
function resolveBoundaryTarget(
  edge: MarkBoundaryEdge,
  from: number,
  to: number,
): { pos: number; wantInside: boolean } {
  switch (edge) {
    case 'open-before':
      return { pos: from, wantInside: false };
    case 'open-after':
      return { pos: from, wantInside: true };
    case 'close-before':
      return { pos: to, wantInside: true };
    case 'close-after':
      return { pos: to, wantInside: false };
  }
}

function findDelimiterWidgetHit(
  root: HTMLElement,
  event: MouseEvent,
): { edge: MarkBoundaryEdge; widgetElement: HTMLElement } | null {
  const widgetElement = findDelimiterWidgetFromTarget(event.target);
  if (!widgetElement) {
    return findDelimiterWidgetNearPointer(root, event);
  }

  const rect = widgetElement.getBoundingClientRect();
  const middle = rect.left + rect.width / 2;
  const widgetEdge = widgetElement.dataset.edge;
  if (widgetEdge === 'open') {
    return {
      edge: event.clientX < middle ? 'open-before' : 'open-after',
      widgetElement,
    };
  }

  if (widgetEdge === 'close') {
    return {
      edge: event.clientX < middle ? 'close-before' : 'close-after',
      widgetElement,
    };
  }

  return null;
}

type MarkBoundaryEdge = 'open-before' | 'open-after' | 'close-before' | 'close-after';

function findDelimiterWidgetForRange(
  root: HTMLElement,
  edge: 'open' | 'close',
  range: GroupedMarkEditRange,
): HTMLElement | null {
  const widgets = Array.from(
    root.querySelectorAll<HTMLElement>(`.pm-mark-delimiter-widget[data-edge="${edge}"]`),
  );
  return (
    widgets.find(
      (widget) =>
        Number(widget.dataset.from) === range.from &&
        Number(widget.dataset.to) === range.to &&
        widget.dataset.marks === range.markTypeNames.join(' '),
    ) ?? null
  );
}

function isSameDelimiterLine(clientY: number, openRect: DOMRect, closeRect: DOMRect): boolean {
  const top = Math.min(openRect.top, closeRect.top) - DELIMITER_CLICK_SLOP_PX;
  const bottom = Math.max(openRect.bottom, closeRect.bottom) + DELIMITER_CLICK_SLOP_PX;
  return clientY >= top && clientY <= bottom;
}

function findDelimiterWidgetFromTarget(target: EventTarget | null): HTMLElement | null {
  if (target instanceof Element) {
    return target.closest<HTMLElement>('.pm-mark-delimiter-widget');
  }

  if (target instanceof Node && target.parentElement) {
    return target.parentElement.closest<HTMLElement>('.pm-mark-delimiter-widget');
  }

  return null;
}

function findDelimiterWidgetNearPointer(
  root: HTMLElement,
  event: MouseEvent,
): { edge: MarkBoundaryEdge; widgetElement: HTMLElement } | null {
  const target = event.target;
  if (!(target instanceof Node) || !root.contains(target)) return null;

  const widgets = Array.from(root.querySelectorAll<HTMLElement>('.pm-mark-delimiter-widget'));
  let nearest: { edge: MarkBoundaryEdge; widgetElement: HTMLElement; distance: number } | null =
    null;

  for (const widgetElement of widgets) {
    const rect = widgetElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (
      event.clientY < rect.top - DELIMITER_CLICK_SLOP_PX ||
      event.clientY > rect.bottom + DELIMITER_CLICK_SLOP_PX
    ) {
      continue;
    }

    const widgetEdge = widgetElement.dataset.edge;
    const beforeDistance = rect.left - event.clientX;
    const afterDistance = event.clientX - rect.right;
    let edge: MarkBoundaryEdge | null = null;
    let distance = Number.POSITIVE_INFINITY;

    // 步骤1：真实浏览器在点击 widget 视觉边缘时，事件 target 可能是外层段落。
    // 因此这里按坐标补判 widget 内部和两侧极小空隙，避免原生 pointer selection 抢回光标。
    if (event.clientX >= rect.left && event.clientX <= rect.right) {
      const middle = rect.left + rect.width / 2;
      if (widgetEdge === 'open') {
        edge = event.clientX < middle ? 'open-before' : 'open-after';
      } else if (widgetEdge === 'close') {
        edge = event.clientX < middle ? 'close-before' : 'close-after';
      }
      distance = 0;
    } else if (beforeDistance >= 0 && beforeDistance <= DELIMITER_CLICK_SLOP_PX) {
      edge = widgetEdge === 'open' ? 'open-before' : widgetEdge === 'close' ? 'close-before' : null;
      distance = beforeDistance;
    } else if (afterDistance >= 0 && afterDistance <= DELIMITER_CLICK_SLOP_PX) {
      edge = widgetEdge === 'open' ? 'open-after' : widgetEdge === 'close' ? 'close-after' : null;
      distance = afterDistance;
    }

    if (!edge) continue;
    if (!nearest || distance < nearest.distance) {
      nearest = { edge, widgetElement, distance };
    }
  }

  return nearest ? { edge: nearest.edge, widgetElement: nearest.widgetElement } : null;
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
