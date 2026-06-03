import { tick } from 'svelte';
import type { EditorCommand, EditorCore, EditorMode } from '../../lib/editor-core';
import type { OutlineItem } from '../../lib/outline/outlineService';
import {
  getSemanticScrollAnchor,
  getSourceScrollAnchor,
  scrollSemanticToAnchor,
  scrollSourceToAnchor,
} from './outlineNavigation';

interface EditorInteractionOptions {
  getEditor(): EditorCore;
  getLargeDocumentMode(): boolean;
  getMode(): EditorMode;
  getOutline(): OutlineItem[];
  getSemanticPane(): HTMLElement;
  getSourcePane(): HTMLElement;
  getSourceTextarea(): HTMLTextAreaElement;
  getPendingSourceScrollTop(): number | null;
  setPendingSourceScrollTop(value: number | null): void;
  setSuppressOutlineScrollUntil(value: number): void;
  setStatusMessage(value: string): void;
  getSourceLineHeight(): number;
}

export function createEditorInteractionController(options: EditorInteractionOptions) {
  async function setMode(nextMode: EditorMode) {
    if (options.getLargeDocumentMode() && nextMode === 'semantic') {
      options.setStatusMessage('大文件已进入只读源码模式，暂不切回语义编辑以避免卡顿');
      return;
    }
    if (nextMode === options.getMode()) {
      return;
    }

    const outline = options.getOutline();
    const scrollAnchor =
      options.getMode() === 'semantic'
        ? getSemanticScrollAnchor(outline, options.getSemanticPane())
        : getSourceScrollAnchor(
            outline,
            options.getSourcePane()?.scrollTop ?? 0,
            options.getSourceLineHeight(),
            options.getSourceTextarea(),
          );

    options.getEditor().updateOptions({ mode: nextMode });
    syncSourceTextareaHeight();
    await tick();
    options.setSuppressOutlineScrollUntil(Date.now() + 300);
    requestAnimationFrame(() => {
      if (nextMode === 'semantic') {
        scrollSemanticToAnchor(options.getOutline(), options.getSemanticPane(), scrollAnchor);
        return;
      }

      scrollSourceToAnchor(
        options.getOutline(),
        options.getSourcePane(),
        options.getSourceTextarea(),
        scrollAnchor,
      );
    });
  }

  function updateMarkdown(event: Event) {
    options.setPendingSourceScrollTop(options.getSourcePane()?.scrollTop ?? null);
    options.getEditor().setMarkdown((event.currentTarget as HTMLTextAreaElement).value);
    syncSourceTextareaHeight(options.getPendingSourceScrollTop());
  }

  function runCommand(command: EditorCommand) {
    options.getEditor().execute(command);
    options.getEditor().focus();
  }

  function syncSourceTextareaHeight(
    restoreScrollTop: number | null = options.getPendingSourceScrollTop(),
  ) {
    requestAnimationFrame(() => {
      const sourceTextarea = options.getSourceTextarea();
      if (!sourceTextarea) {
        return;
      }
      sourceTextarea.style.height = 'auto';
      sourceTextarea.style.height = `${Math.max(sourceTextarea.scrollHeight, sourceTextarea.clientHeight)}px`;
      if (restoreScrollTop !== null && options.getSourcePane() && options.getMode() === 'source') {
        options.getSourcePane().scrollTop = restoreScrollTop;
        options.setPendingSourceScrollTop(null);
      }
    });
  }

  return {
    setMode,
    updateMarkdown,
    runCommand,
    syncSourceTextareaHeight,
  };
}
