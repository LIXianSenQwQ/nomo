import { tick } from 'svelte';
import type { EditorCommand, EditorCore, EditorMode } from '../../lib/editor-core';
import type { OutlineItem } from '../../lib/outline/outlineService';
import { createTocBlock } from '../../lib/toc/tocService';
import { t } from '../i18n';
import {
  type OutlineScrollAnchor,
  getSemanticScrollAnchorForBlock,
  getSourceScrollAnchorAtLine,
  scrollSemanticToAnchor,
  scrollSourceToAnchor,
  setScrollTop,
} from './outlineNavigation';

interface EditorInteractionOptions {
  getEditor(): EditorCore;
  getLargeDocumentMode(): boolean;
  getMode(): EditorMode;
  getOutline(): OutlineItem[];
  getSemanticPane(): HTMLElement | undefined;
  getSourcePane(): HTMLElement | undefined;
  getSourceTextarea(): HTMLTextAreaElement | undefined;
  getPendingSourceScrollTop(): number | null;
  setPendingSourceScrollTop(value: number | null): void;
  setSuppressOutlineScrollUntil(value: number): void;
  setStatusMessage(value: string): void;
  getSourceLineHeight(): number;
}

export function createEditorInteractionController(options: EditorInteractionOptions) {
  let pendingSourceCaretLine: number | null = null;

  async function setMode(nextMode: EditorMode) {
    if (options.getLargeDocumentMode() && nextMode === 'semantic') {
      options.setStatusMessage(t.largeDocumentStayReadonlySource());
      return;
    }
    if (nextMode === options.getMode()) {
      return;
    }

    // 在切换模式前保存两个面板的滚动位置。
    // 浏览器会将 display:none 的元素 scrollTop 重置为 0，
    // 因此必须在 CSS 生效前捕获当前值。
    const outline = options.getOutline();
    const semanticPane = options.getSemanticPane();
    const sourcePane = options.getSourcePane();
    const savedSemanticScrollTop = semanticPane?.scrollTop ?? 0;
    const savedSourceScrollTop = sourcePane?.scrollTop ?? 0;
    const scrollAnchor =
      options.getMode() === 'semantic'
        ? getSemanticModeSwitchAnchor(outline, semanticPane, savedSemanticScrollTop)
        : getSourceModeSwitchAnchor(outline, sourcePane, savedSourceScrollTop);
    options.getEditor().updateOptions({ mode: nextMode });
    await tick();
    options.setSuppressOutlineScrollUntil(Date.now() + 300);

    scheduleAfterFrames(() => {
      if (nextMode === 'semantic') {
        scrollSemanticToAnchor(options.getOutline(), options.getSemanticPane(), scrollAnchor);
        refreshEditorViewportLayout();
        return;
      }

      restoreSourceScrollAnchorWhenReady(scrollAnchor);
    }, 2);
  }

  function updateMarkdown(event: Event) {
    const sourceTextarea = event.currentTarget as HTMLTextAreaElement;
    options.setPendingSourceScrollTop(options.getSourcePane()?.scrollTop ?? null);
    pendingSourceCaretLine = getSourceSelectionLine(sourceTextarea);
    options.getEditor().setMarkdown(sourceTextarea.value, {
      reason: 'source-input',
      sourceInput: true,
    });
    syncSourceTextareaHeight(options.getPendingSourceScrollTop());
  }

  function runCommand(command: EditorCommand) {
    if (command.type === 'insertToc' && options.getMode() === 'source') {
      insertTocAtSourceSelection();
      return;
    }

    options.getEditor().execute(command);
    options.getEditor().focus();
  }

  function insertTocAtSourceSelection() {
    const sourceTextarea = options.getSourceTextarea();
    const markdown = options.getEditor().getMarkdown();
    const start = sourceTextarea?.selectionStart ?? markdown.length;
    const end = sourceTextarea?.selectionEnd ?? start;
    const tocBlock = createTocBlock(markdown);
    const prefix = markdown.slice(0, start);
    const suffix = markdown.slice(end);
    const before = prefix.endsWith('\n') || prefix.length === 0 ? '' : '\n\n';
    const after = suffix.startsWith('\n') || suffix.length === 0 ? '' : '\n\n';
    const nextMarkdown = `${prefix}${before}${tocBlock}${after}${suffix}`;
    const nextSelection = prefix.length + before.length + tocBlock.length;

    options.getEditor().setMarkdown(nextMarkdown);
    requestAnimationFrame(() => {
      if (!sourceTextarea) {
        return;
      }
      sourceTextarea.focus();
      sourceTextarea.setSelectionRange(nextSelection, nextSelection);
      syncSourceTextareaHeight();
    });
  }

  function syncSourceTextareaHeight(
    restoreScrollTop: number | null = options.getPendingSourceScrollTop(),
  ) {
    scheduleViewportMeasure(() => measureEditorViewportLayout(restoreScrollTop));
  }

  function refreshEditorViewportLayout() {
    scheduleViewportMeasure(() => measureEditorViewportLayout(null), 2);
  }

  function restoreSourceScrollAnchorWhenReady(
    scrollAnchor: OutlineScrollAnchor | null,
    attemptsRemaining = 120,
  ) {
    measureEditorViewportLayout(null);
    const sourcePane = options.getSourcePane();
    const maxScrollTop = sourcePane ? Math.max(0, sourcePane.scrollHeight - sourcePane.clientHeight) : 0;
    const expectedProgress = getAnchorDocumentProgress(scrollAnchor);

    if (sourcePane && maxScrollTop > 0) {
      scrollSourceToAnchor(
        options.getOutline(),
        sourcePane,
        options.getSourceTextarea(),
        scrollAnchor,
      );
      refreshEditorViewportLayout();
    }

    const needsRetry =
      attemptsRemaining > 0 &&
      (!sourcePane ||
        maxScrollTop <= 0 ||
        (expectedProgress > 0.01 && sourcePane.scrollTop <= 1));
    if (needsRetry) {
      scheduleAfterFrames(() =>
        restoreSourceScrollAnchorWhenReady(scrollAnchor, attemptsRemaining - 1),
      );
    }
  }

  function measureEditorViewportLayout(restoreScrollTop: number | null) {
    if (options.getMode() === 'semantic') {
      clampPaneScrollTop(options.getSemanticPane());
      return;
    }

    const sourcePane = options.getSourcePane();
    if (!isPaneLayoutVisible(sourcePane)) {
      return;
    }
    const scrollTopBeforeMeasure = sourcePane?.scrollTop ?? 0;

    const sourceTextarea = options.getSourceTextarea();
    if (sourceTextarea) {
      sourceTextarea.style.height = 'auto';
      sourceTextarea.style.height = `${Math.max(
        sourceTextarea.scrollHeight,
        sourceTextarea.clientHeight,
        estimateSourceTextareaContentHeight(sourceTextarea),
      )}px`;
    }

    if (restoreScrollTop !== null && sourcePane) {
      const nextScrollTop = getSourceScrollTopWithVisibleCaret(
        sourcePane,
        sourceTextarea,
        restoreScrollTop,
        pendingSourceCaretLine,
      );
      clampPaneScrollTop(sourcePane, nextScrollTop);
      options.setPendingSourceScrollTop(null);
      pendingSourceCaretLine = null;
    } else {
      clampPaneScrollTop(sourcePane, scrollTopBeforeMeasure);
    }
  }

  function scheduleViewportMeasure(callback: () => void, frameCount = 1) {
    const raf = getRequestAnimationFrame();
    raf(() => {
      callback();
      if (frameCount > 1) {
        raf(callback);
      }
    });
  }

  function scheduleAfterFrames(callback: () => void, frameCount = 1) {
    const raf = getRequestAnimationFrame();
    const run = (remainingFrames: number) => {
      raf(() => {
        if (remainingFrames <= 1) {
          callback();
          return;
        }
        run(remainingFrames - 1);
      });
    };
    run(Math.max(1, frameCount));
  }

  function clampPaneScrollTop(pane: HTMLElement | undefined, preferredScrollTop?: number) {
    if (!pane) {
      return;
    }
    const maxScrollTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
    const nextScrollTop = Math.min(
      maxScrollTop,
      Math.max(0, preferredScrollTop ?? pane.scrollTop),
    );
    if (pane.scrollTop !== nextScrollTop) {
      setScrollTop(pane, nextScrollTop);
    }
  }

  function getSourceScrollTopWithVisibleCaret(
    sourcePane: HTMLElement,
    sourceTextarea: HTMLTextAreaElement | undefined,
    preferredScrollTop: number,
    caretLine: number | null,
  ) {
    if (!sourceTextarea || caretLine == null) {
      return preferredScrollTop;
    }

    const lineHeight = options.getSourceLineHeight();
    const textareaTop = getSourceTextareaTopInPane(sourcePane, sourceTextarea);
    const caretTop = textareaTop + Math.max(0, caretLine - 1) * lineHeight;
    const caretBottom = caretTop + lineHeight;
    const visibleTop = preferredScrollTop;
    const visibleBottom = preferredScrollTop + sourcePane.clientHeight;

    if (caretBottom > visibleBottom) {
      return caretBottom - sourcePane.clientHeight + lineHeight;
    }
    if (caretTop < visibleTop) {
      return Math.max(0, caretTop - lineHeight);
    }
    return preferredScrollTop;
  }

  function getSourceTextareaTopInPane(
    sourcePane: HTMLElement,
    sourceTextarea: HTMLTextAreaElement,
  ) {
    const paneRect = sourcePane.getBoundingClientRect();
    const textareaRect = sourceTextarea.getBoundingClientRect();
    const hasUsableRect =
      paneRect.top !== 0 ||
      textareaRect.top !== 0 ||
      textareaRect.height > 0 ||
      textareaRect.bottom > 0;

    if (hasUsableRect) {
      return textareaRect.top - paneRect.top + sourcePane.scrollTop;
    }

    return sourceTextarea.offsetTop || 0;
  }

  function isPaneLayoutVisible(pane: HTMLElement | undefined) {
    return Boolean(pane && pane.getClientRects().length > 0);
  }

  function estimateSourceTextareaContentHeight(sourceTextarea: HTMLTextAreaElement) {
    const lineCount = Math.max(1, sourceTextarea.value.split(/\r?\n/).length);
    return Math.ceil(lineCount * options.getSourceLineHeight());
  }

  function getSemanticModeSwitchAnchor(
    outline: OutlineItem[],
    semanticPane: HTMLElement | undefined,
    savedScrollTop: number,
  ): OutlineScrollAnchor | null {
    if (!semanticPane) {
      return null;
    }

    const selectionRect = options.getEditor().getSelectionAnchorRect();
    const anchorBlock = isRectVisibleInPane(selectionRect, semanticPane)
      ? findSemanticBlockAtRect(semanticPane, selectionRect)
      : findFirstVisibleSemanticBlock(semanticPane);

    return getSemanticScrollAnchorForBlock(
      outline,
      semanticPane,
      anchorBlock,
      savedScrollTop,
    );
  }

  function getSourceModeSwitchAnchor(
    outline: OutlineItem[],
    sourcePane: HTMLElement | undefined,
    savedScrollTop: number,
  ): OutlineScrollAnchor | null {
    const sourceTextarea = options.getSourceTextarea();
    const lineHeight = options.getSourceLineHeight();
    const selectionLine = getSourceSelectionLine(sourceTextarea);
    const anchorLine =
      sourcePane && selectionLine && isSourceLineVisible(sourcePane, selectionLine, lineHeight)
        ? selectionLine
        : Math.max(1, Math.floor(savedScrollTop / lineHeight) + 1);

    return getSourceScrollAnchorAtLine(
      outline,
      anchorLine,
      savedScrollTop,
      lineHeight,
      sourceTextarea,
      sourcePane,
    );
  }

  function isRectVisibleInPane(rect: DOMRect | null, pane: HTMLElement) {
    if (!rect) {
      return false;
    }
    const paneRect = pane.getBoundingClientRect();
    if (rect.height > paneRect.height * 1.5) {
      return false;
    }
    return rect.bottom > paneRect.top && rect.top < paneRect.bottom;
  }

  function findSemanticBlockAtRect(pane: HTMLElement, rect: DOMRect | null) {
    if (!rect || typeof document === 'undefined') {
      return null;
    }
    const paneRect = pane.getBoundingClientRect();
    const x = clamp(rect.left + rect.width / 2, paneRect.left + 1, paneRect.right - 1);
    const y = clamp(rect.top + rect.height / 2, paneRect.top + 1, paneRect.bottom - 1);
    const element = document.elementFromPoint(x, y);
    const editor = pane.querySelector<HTMLElement>('.ProseMirror');
    if (!editor || !(element instanceof HTMLElement) || !editor.contains(element)) {
      return findVisibleSemanticBlockNearY(pane, y);
    }

    let current: HTMLElement | null = element;
    while (current && current.parentElement !== editor) {
      current = current.parentElement;
    }
    return current ?? findVisibleSemanticBlockNearY(pane, y);
  }

  function findFirstVisibleSemanticBlock(pane: HTMLElement) {
    const paneRect = pane.getBoundingClientRect();
    return getSemanticBlocks(pane).find((block) => {
      const rect = block.getBoundingClientRect();
      return rect.bottom > paneRect.top && rect.top < paneRect.bottom;
    });
  }

  function findVisibleSemanticBlockNearY(pane: HTMLElement, y: number) {
    return getSemanticBlocks(pane).find((block) => {
      const rect = block.getBoundingClientRect();
      return rect.bottom >= y && rect.top <= y;
    });
  }

  function getSemanticBlocks(pane: HTMLElement) {
    return Array.from(pane.querySelectorAll<HTMLElement>('.ProseMirror > *'));
  }

  function getSourceSelectionLine(sourceTextarea: HTMLTextAreaElement | undefined) {
    if (!sourceTextarea) {
      return null;
    }
    return sourceTextarea.value.slice(0, sourceTextarea.selectionStart).split(/\r?\n/).length;
  }

  function isSourceLineVisible(sourcePane: HTMLElement, sourceLine: number, lineHeight: number) {
    const lineTop = Math.max(0, (sourceLine - 1) * lineHeight);
    const lineBottom = lineTop + lineHeight;
    return (
      lineBottom > sourcePane.scrollTop &&
      lineTop < sourcePane.scrollTop + sourcePane.clientHeight
    );
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function getAnchorDocumentProgress(scrollAnchor: OutlineScrollAnchor | null) {
    return scrollAnchor?.documentProgress ?? 0;
  }

  function getRequestAnimationFrame() {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return (callback: FrameRequestCallback) => {
        callback(Date.now());
        return 0;
      };
    }
    return window.requestAnimationFrame.bind(window);
  }

  return {
    setMode,
    updateMarkdown,
    runCommand,
    syncSourceTextareaHeight,
    refreshEditorViewportLayout,
  };
}
