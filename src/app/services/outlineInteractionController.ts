import type { EditorCore, EditorMode } from '../../lib/editor-core';
import {
  reorderOutlineSection,
  type OutlineMoveFailureReason,
  type OutlineSectionMoveRequest,
} from '../../lib/outline/outlineReorder';
import type { OutlineItem } from '../../lib/outline/outlineService';
import { t } from '../i18n';
import {
  getActiveOutlineIdFromSemantic,
  getActiveOutlineIdFromSource,
  getSourceHeadingSelection,
  getSourceLineHeight as getTextareaLineHeight,
  scrollSemanticToAnchor,
  setScrollTop,
  smoothScrollElementTo,
} from './outlineNavigation';
import {
  isOutlineItemExpandable as getOutlineItemExpandable,
  pruneCollapsedOutlineIds as getPrunedCollapsedOutlineIds,
  toggleOutlineItemExpanded as getToggledOutlineItemIds,
} from './outlineState';

interface OutlineInteractionOptions {
  getMode(): EditorMode;
  getMarkdown(): string;
  getOutline(): OutlineItem[];
  getCollapsedOutlineIds(): Set<string>;
  setCollapsedOutlineIds(value: Set<string>): void;
  getOutlineVisible(): boolean;
  setOutlineVisible(value: boolean): void;
  setActiveOutlineId(value: string): void;
  getSuppressOutlineScrollUntil(): number;
  setSuppressOutlineScrollUntil(value: number): void;
  getSemanticPane(): HTMLElement;
  getSourcePane(): HTMLElement;
  getSourceTextarea(): HTMLTextAreaElement;
  getEditor(): EditorCore;
  getReadonly(): boolean;
  setStatusMessage(value: string): void;
  onExplicitJumpIntent?(): void;
}

export function replaceTextareaWithNativeUndo(
  textarea: HTMLTextAreaElement,
  nextValue: string,
): boolean {
  const previousValue = textarea.value;
  const previousStart = textarea.selectionStart;
  const previousEnd = textarea.selectionEnd;
  const replacement = getMinimalTextReplacement(previousValue, nextValue);
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(replacement.from, replacement.to);
  let replaced = false;
  try {
    replaced =
      typeof document.execCommand === 'function' &&
      document.execCommand('insertText', false, replacement.text);
  } catch {
    replaced = false;
  }
  if (replaced && textarea.value === nextValue) return true;

  if (textarea.value !== previousValue) {
    try {
      document.execCommand('undo');
    } catch {
      // 下方仍会恢复 textarea 展示值；编辑器状态从未写入。
    }
    if (textarea.value !== previousValue) textarea.value = previousValue;
  }
  textarea.setSelectionRange(previousStart, previousEnd);
  return false;
}

function getMinimalTextReplacement(previousValue: string, nextValue: string) {
  let from = 0;
  const maxPrefix = Math.min(previousValue.length, nextValue.length);
  while (from < maxPrefix && previousValue[from] === nextValue[from]) from += 1;

  let previousEnd = previousValue.length;
  let nextEnd = nextValue.length;
  while (
    previousEnd > from &&
    nextEnd > from &&
    previousValue[previousEnd - 1] === nextValue[nextEnd - 1]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  return { from, to: previousEnd, text: nextValue.slice(from, nextEnd) };
}

export function createOutlineInteractionController(options: OutlineInteractionOptions) {
  let outlineMoveGeneration = 0;

  function toggleOutlineVisible() {
    options.setOutlineVisible(!options.getOutlineVisible());
  }

  function isOutlineItemExpandable(index: number) {
    return getOutlineItemExpandable(options.getOutline(), index);
  }

  function toggleOutlineItemExpanded(item: OutlineItem) {
    options.setCollapsedOutlineIds(
      getToggledOutlineItemIds(options.getCollapsedOutlineIds(), item),
    );
  }

  function expandAllOutline() {
    options.setCollapsedOutlineIds(new Set());
  }

  function collapseAllOutline() {
    const outline = options.getOutline();
    options.setCollapsedOutlineIds(
      new Set(
        outline
          .filter((_item, index) => getOutlineItemExpandable(outline, index))
          .map((item) => item.id),
      ),
    );
  }

  function pruneCollapsedOutlineIds() {
    options.setCollapsedOutlineIds(
      getPrunedCollapsedOutlineIds(options.getOutline(), options.getCollapsedOutlineIds()),
    );
  }

  function jumpToOutlineItem(item: OutlineItem) {
    options.setActiveOutlineId(item.id);
    options.setSuppressOutlineScrollUntil(Date.now() + 800);
    options.onExplicitJumpIntent?.();

    requestAnimationFrame(() => {
      if (options.getMode() === 'semantic') {
        scrollSemanticToAnchor(options.getOutline(), options.getSemanticPane(), {
          outlineId: item.id,
          sectionProgress: 0,
        });
        return;
      }

      const sourceTextarea = options.getSourceTextarea();
      const sourcePane = options.getSourcePane();
      const selection = getSourceHeadingSelection(options.getMarkdown(), item);
      const restoreScrollTop = sourcePane?.scrollTop ?? 0;

      sourceTextarea.focus({ preventScroll: true });
      sourceTextarea.setSelectionRange(selection.end, selection.end);
      const lineHeightPx = getSourceLineHeight();
      if (sourcePane) {
        setScrollTop(sourcePane, restoreScrollTop);
        smoothScrollElementTo(sourcePane, Math.max(0, (item.line - 1) * lineHeightPx - 40));
      }
    });
  }

  function moveOutlineSection(request: OutlineSectionMoveRequest): boolean {
    if (options.getReadonly()) {
      options.setStatusMessage(t.outlineMoveReadonly());
      return false;
    }

    const previousOutline = options.getOutline();
    const previousCollapsedOutlineIds = new Set(options.getCollapsedOutlineIds());
    const result = reorderOutlineSection(options.getMarkdown(), previousOutline, request);
    if (!result.ok) {
      options.setStatusMessage(getOutlineMoveFailureMessage(result.reason));
      return false;
    }

    if (options.getMode() === 'source') {
      const textarea = options.getSourceTextarea();
      let nativeInputObserved = false;
      const observeNativeInput = () => {
        nativeInputObserved = true;
      };
      textarea.addEventListener('input', observeNativeInput, { once: true });
      if (!replaceTextareaWithNativeUndo(textarea, result.markdown)) {
        textarea.removeEventListener('input', observeNativeInput);
        options.setStatusMessage(t.outlineMoveUndoUnavailable());
        return false;
      }
      textarea.removeEventListener('input', observeNativeInput);
      if (!nativeInputObserved) {
        textarea.dispatchEvent(
          new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }),
        );
      }
      const generation = ++outlineMoveGeneration;
      options.setStatusMessage(
        t.outlineSectionMoved({ title: previousOutline[request.sourceIndex].title }),
      );
      window.setTimeout(() => {
        if (generation !== outlineMoveGeneration) return;
        restoreOutlineMoveState(
          previousOutline,
          previousCollapsedOutlineIds,
          options.getOutline(),
          result.indexMap,
          result.movedHeadingIndex,
          true,
        );
      }, 150);
      return true;
    } else {
      const moved = options.getEditor().execute({ type: 'moveOutlineSection', ...request });
      if (!moved) {
        options.setStatusMessage(t.outlineMoveFailed());
        return false;
      }
      // 章节移动必须让正文与大纲同一拍更新，不能等待常规输入事务的延迟序列化。
      options.getEditor().getMarkdown();
    }

    outlineMoveGeneration += 1;
    restoreOutlineMoveState(
      previousOutline,
      previousCollapsedOutlineIds,
      options.getOutline(),
      result.indexMap,
      result.movedHeadingIndex,
      false,
    );
    return true;
  }

  function restoreOutlineMoveState(
    previousOutline: readonly OutlineItem[],
    previousCollapsedOutlineIds: ReadonlySet<string>,
    nextOutline: readonly OutlineItem[],
    indexMap: readonly number[],
    movedHeadingIndex: number,
    jumpInSource: boolean,
  ) {
    const nextCollapsedIds = new Set<string>();
    previousOutline.forEach((item, originalIndex) => {
      if (!previousCollapsedOutlineIds.has(item.id)) return;
      const nextItem = nextOutline[indexMap[originalIndex]];
      if (nextItem) nextCollapsedIds.add(nextItem.id);
    });
    options.setCollapsedOutlineIds(nextCollapsedIds);
    const movedItem = nextOutline[movedHeadingIndex];
    if (!movedItem) return;
    options.setActiveOutlineId(movedItem.id);
    options.setSuppressOutlineScrollUntil(Date.now() + 800);
    if (jumpInSource) requestAnimationFrame(() => jumpToOutlineItem(movedItem));
    options.setStatusMessage(t.outlineSectionMoved({ title: movedItem.title }));
  }

  function updateActiveOutlineFromSourceScroll() {
    if (Date.now() < options.getSuppressOutlineScrollUntil()) {
      return;
    }
    const sourcePane = options.getSourcePane();
    if (!sourcePane) {
      options.setActiveOutlineId('');
      return;
    }
    options.setActiveOutlineId(
      getActiveOutlineIdFromSource(
        options.getOutline(),
        sourcePane.scrollTop,
        getSourceLineHeight(),
        options.getSourceTextarea(),
        sourcePane,
      ),
    );
  }

  function updateActiveOutlineFromSemanticScroll() {
    if (Date.now() < options.getSuppressOutlineScrollUntil()) {
      return;
    }
    options.setActiveOutlineId(
      getActiveOutlineIdFromSemantic(options.getOutline(), options.getSemanticPane()),
    );
  }

  function getSourceLineHeight() {
    return getTextareaLineHeight(options.getSourceTextarea());
  }

  return {
    toggleOutlineVisible,
    isOutlineItemExpandable,
    toggleOutlineItemExpanded,
    expandAllOutline,
    collapseAllOutline,
    pruneCollapsedOutlineIds,
    jumpToOutlineItem,
    moveOutlineSection,
    updateActiveOutlineFromSourceScroll,
    updateActiveOutlineFromSemanticScroll,
    getSourceLineHeight,
  };
}

function getOutlineMoveFailureMessage(reason: OutlineMoveFailureReason): string {
  switch (reason) {
    case 'self-or-descendant':
      return t.outlineMoveSelfOrDescendant();
    case 'heading-level-overflow':
      return t.outlineMoveLevelOverflow();
    case 'no-change':
      return t.outlineMoveNoChange();
    default:
      return t.outlineMoveFailed();
  }
}
