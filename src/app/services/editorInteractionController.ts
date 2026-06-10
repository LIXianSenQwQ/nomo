import { tick } from 'svelte';
import type { EditorCommand, EditorCore, EditorMode } from '../../lib/editor-core';
import type { OutlineItem } from '../../lib/outline/outlineService';
import { createTocBlock } from '../../lib/toc/tocService';
import { t } from '../i18n';
import {
  type OutlineScrollAnchor,
  getSourceScrollAnchor,
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
        ? getDocumentScrollAnchor(semanticPane, savedSemanticScrollTop)
        : getSourceScrollAnchor(
            outline,
            savedSourceScrollTop,
            options.getSourceLineHeight(),
            options.getSourceTextarea(),
            options.getSourcePane(),
          );
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
    options.setPendingSourceScrollTop(options.getSourcePane()?.scrollTop ?? null);
    options
      .getEditor()
      .setMarkdown((event.currentTarget as HTMLTextAreaElement).value, { sourceInput: true });
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
      clampPaneScrollTop(sourcePane, restoreScrollTop);
      options.setPendingSourceScrollTop(null);
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

  function isPaneLayoutVisible(pane: HTMLElement | undefined) {
    return Boolean(pane && pane.getClientRects().length > 0);
  }

  function estimateSourceTextareaContentHeight(sourceTextarea: HTMLTextAreaElement) {
    const lineCount = Math.max(1, sourceTextarea.value.split(/\r?\n/).length);
    return Math.ceil(lineCount * options.getSourceLineHeight());
  }

  function getDocumentScrollAnchor(
    pane: HTMLElement | undefined,
    scrollTop: number,
  ): OutlineScrollAnchor | null {
    if (!pane) {
      return null;
    }
    const maxScrollTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
    const documentProgress =
      maxScrollTop > 0 ? Math.min(1, Math.max(0, scrollTop / maxScrollTop)) : 0;
    return {
      kind: 'document',
      sectionProgress: documentProgress,
      documentProgress,
      sourceLine: 1,
    };
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
