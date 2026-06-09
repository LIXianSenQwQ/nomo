import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorCore, EditorMode } from '../../lib/editor-core';
import { createEditorInteractionController } from './editorInteractionController';

describe('editorInteractionController viewport layout', () => {
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame;

  beforeEach(() => {
    originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    }) as typeof window.requestAnimationFrame;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
  });

  it('clamps source and semantic panes when the editor content height shrinks', () => {
    const sourcePane = createPane({ scrollHeight: 620, clientHeight: 420, scrollTop: 360 });
    const semanticPane = createPane({ scrollHeight: 540, clientHeight: 400, scrollTop: 260 });
    const sourceTextarea = createTextarea({ scrollHeight: 380, clientHeight: 240 });
    const controller = createController({
      mode: 'semantic',
      sourcePane,
      semanticPane,
      sourceTextarea,
    });

    controller.refreshEditorViewportLayout();

    expect(sourceTextarea.style.height).toBe('380px');
    expect(sourcePane.scrollTop).toBe(200);
    expect(semanticPane.scrollTop).toBe(140);
  });

  it('clamps restored source scroll after recalculating the textarea height', () => {
    const sourcePane = createPane({ scrollHeight: 480, clientHeight: 300, scrollTop: 20 });
    const semanticPane = createPane({ scrollHeight: 900, clientHeight: 300, scrollTop: 120 });
    const sourceTextarea = createTextarea({ scrollHeight: 520, clientHeight: 260 });
    const pendingSourceScrollTop = { value: 900 };
    const controller = createController({
      mode: 'source',
      sourcePane,
      semanticPane,
      sourceTextarea,
      pendingSourceScrollTop,
    });

    controller.syncSourceTextareaHeight(pendingSourceScrollTop.value);

    expect(sourceTextarea.style.height).toBe('520px');
    expect(sourcePane.scrollTop).toBe(180);
    expect(pendingSourceScrollTop.value).toBeNull();
  });

  it('safely refreshes when editor panes are not bound yet', () => {
    const controller = createController({
      mode: 'semantic',
      sourcePane: undefined,
      semanticPane: undefined,
      sourceTextarea: undefined,
    });

    expect(() => controller.refreshEditorViewportLayout()).not.toThrow();
  });
});

function createController(options: {
  mode: EditorMode;
  sourcePane: HTMLElement | undefined;
  semanticPane: HTMLElement | undefined;
  sourceTextarea: HTMLTextAreaElement | undefined;
  pendingSourceScrollTop?: { value: number | null };
}) {
  const pendingSourceScrollTop = options.pendingSourceScrollTop ?? { value: null };
  return createEditorInteractionController({
    getEditor: () => createEditorCoreStub(),
    getLargeDocumentMode: () => false,
    getMode: () => options.mode,
    getOutline: () => [],
    getSemanticPane: () => options.semanticPane,
    getSourcePane: () => options.sourcePane,
    getSourceTextarea: () => options.sourceTextarea,
    getPendingSourceScrollTop: () => pendingSourceScrollTop.value,
    setPendingSourceScrollTop: (value) => {
      pendingSourceScrollTop.value = value;
    },
    setSuppressOutlineScrollUntil: vi.fn(),
    setStatusMessage: vi.fn(),
    getSourceLineHeight: () => 24,
  });
}

function createEditorCoreStub(): EditorCore {
  return {
    updateOptions: vi.fn(),
    setMarkdown: vi.fn(),
    getMarkdown: () => '',
    execute: vi.fn(),
    focus: vi.fn(),
  } as unknown as EditorCore;
}

function createPane(options: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  const pane = document.createElement('section');
  setElementMetric(pane, 'scrollHeight', options.scrollHeight);
  setElementMetric(pane, 'clientHeight', options.clientHeight);
  pane.scrollTop = options.scrollTop;
  return pane;
}

function createTextarea(options: { scrollHeight: number; clientHeight: number }) {
  const textarea = document.createElement('textarea');
  setElementMetric(textarea, 'scrollHeight', options.scrollHeight);
  setElementMetric(textarea, 'clientHeight', options.clientHeight);
  return textarea;
}

function setElementMetric(element: HTMLElement, key: 'scrollHeight' | 'clientHeight', value: number) {
  Object.defineProperty(element, key, {
    configurable: true,
    value,
  });
}
