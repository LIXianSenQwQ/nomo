import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorCore, EditorMode } from '../../lib/editor-core';
import type { OutlineItem } from '../../lib/outline/outlineService';
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
    vi.restoreAllMocks();
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

  it('restores semantic scroll after switching mode and waiting for layout frames', async () => {
    const callbacks: FrameRequestCallback[] = [];
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    }) as typeof window.requestAnimationFrame;
    const mode = { value: 'source' as EditorMode };
    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(300);
    const editor = createEditorCoreStub((nextMode) => {
      mode.value = nextMode;
    });
    const sourcePane = createPane({
      className: 'source-pane',
      scrollHeight: 1200,
      clientHeight: 400,
      scrollTop: 500,
    });
    const semanticPane = createSemanticPane([
      { tag: 'h1', title: '第一章', top: 40 },
      { tag: 'h2', title: '第二章', top: 440 },
    ], 1000, 300);
    const sourceTextarea = createTextarea({ scrollHeight: 1600, clientHeight: 300, lineCount: 80 });
    sourcePane.append(sourceTextarea);
    const controller = createController({
      mode,
      editor,
      outline: createOutline(),
      sourcePane,
      semanticPane,
      sourceTextarea,
      sourceLineHeight: 20,
    });

    await controller.setMode('semantic');

    expect(editor.updateOptions).toHaveBeenCalledWith({ mode: 'semantic' });
    expect(semanticPane.scrollTop).toBe(0);

    flushAnimationFrame(callbacks);
    expect(semanticPane.scrollTop).toBe(0);

    flushAnimationFrame(callbacks);
    expect(semanticPane.scrollTop).toBe(0);

    flushAnimationFrame(callbacks);
    expect(semanticPane.scrollTop).toBe(0);

    flushAnimationFrame(callbacks);
    expect(semanticPane.scrollTop).toBe(258);
  });

  it('keeps restored source scroll after the post-switch viewport refresh', async () => {
    const mode = { value: 'semantic' as EditorMode };
    const editor = createEditorCoreStub((nextMode) => {
      mode.value = nextMode;
    });
    const sourcePane = createPane({
      className: 'source-pane',
      scrollHeight: 1600,
      clientHeight: 400,
      scrollTop: 0,
    });
    const sourceTextarea = createTextarea({ scrollHeight: 1600, clientHeight: 300, lineCount: 80 });
    sourcePane.append(sourceTextarea);
    const semanticPane = createSemanticPane([
      { tag: 'h1', title: '第一章', top: 40 },
      { tag: 'h2', title: '第二章', top: 440 },
    ], 1000, 300);
    semanticPane.scrollTop = 250;
    const controller = createController({
      mode,
      editor,
      outline: createOutline(),
      sourcePane,
      semanticPane,
      sourceTextarea,
      sourceLineHeight: 20,
    });

    await controller.setMode('source');

    expect(editor.updateOptions).toHaveBeenCalledWith({ mode: 'source' });
    expect(sourcePane.scrollTop).toBe(420);

    controller.refreshEditorViewportLayout();

    expect(sourcePane.scrollTop).toBe(420);
  });
});

function createController(options: {
  mode: EditorMode | { value: EditorMode };
  sourcePane: HTMLElement | undefined;
  semanticPane: HTMLElement | undefined;
  sourceTextarea: HTMLTextAreaElement | undefined;
  pendingSourceScrollTop?: { value: number | null };
  editor?: EditorCore;
  outline?: OutlineItem[];
  sourceLineHeight?: number;
}) {
  const pendingSourceScrollTop = options.pendingSourceScrollTop ?? { value: null };
  return createEditorInteractionController({
    getEditor: () => options.editor ?? createEditorCoreStub(),
    getLargeDocumentMode: () => false,
    getMode: () => (typeof options.mode === 'string' ? options.mode : options.mode.value),
    getOutline: () => options.outline ?? [],
    getSemanticPane: () => options.semanticPane,
    getSourcePane: () => options.sourcePane,
    getSourceTextarea: () => options.sourceTextarea,
    getPendingSourceScrollTop: () => pendingSourceScrollTop.value,
    setPendingSourceScrollTop: (value) => {
      pendingSourceScrollTop.value = value;
    },
    setSuppressOutlineScrollUntil: vi.fn(),
    setStatusMessage: vi.fn(),
    getSourceLineHeight: () => options.sourceLineHeight ?? 24,
  });
}

function createEditorCoreStub(onModeChange?: (mode: EditorMode) => void): EditorCore {
  return {
    updateOptions: vi.fn((options: { mode?: EditorMode }) => {
      if (options.mode) {
        onModeChange?.(options.mode);
      }
    }),
    setMarkdown: vi.fn(),
    getMarkdown: () => '',
    execute: vi.fn(),
    focus: vi.fn(),
  } as unknown as EditorCore;
}

function createPane(options: {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
  className?: string;
}) {
  const pane = document.createElement('section');
  if (options.className) {
    pane.className = options.className;
  }
  setElementMetric(pane, 'scrollHeight', options.scrollHeight);
  setElementMetric(pane, 'clientHeight', options.clientHeight);
  pane.scrollTop = options.scrollTop;
  return pane;
}

function createTextarea(options: { scrollHeight: number; clientHeight: number; lineCount?: number }) {
  const textarea = document.createElement('textarea');
  textarea.style.lineHeight = '20px';
  setElementMetric(textarea, 'scrollHeight', options.scrollHeight);
  setElementMetric(textarea, 'clientHeight', options.clientHeight);
  textarea.value = Array.from(
    { length: options.lineCount ?? 1 },
    (_, index) => `line ${index + 1}`,
  ).join('\n');
  return textarea;
}

function setElementMetric(element: HTMLElement, key: 'scrollHeight' | 'clientHeight', value: number) {
  Object.defineProperty(element, key, {
    configurable: true,
    value,
  });
}

function createOutline(): OutlineItem[] {
  return [
    { id: '第一章', level: 1, title: '第一章', line: 1 },
    { id: '第二章', level: 2, title: '第二章', line: 41 },
  ];
}

function createSemanticPane(
  headings: Array<{ tag: 'h1' | 'h2'; title: string; top: number }>,
  scrollHeight: number,
  clientHeight: number,
) {
  const semanticPane = createPane({ scrollHeight, clientHeight, scrollTop: 0 });
  semanticPane.className = 'semantic-pane';
  semanticPane.getBoundingClientRect = () => createRect(0);

  const editor = document.createElement('div');
  editor.className = 'ProseMirror';
  headings.forEach((heading) => {
    const element = document.createElement(heading.tag);
    element.textContent = heading.title;
    element.getBoundingClientRect = () => createRect(heading.top - semanticPane.scrollTop);
    editor.append(element);
  });
  semanticPane.append(editor);
  return semanticPane;
}

function createRect(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    bottom: top + 20,
    right: 100,
    width: 100,
    height: 20,
    toJSON: () => ({}),
  };
}

function flushAnimationFrame(callbacks: FrameRequestCallback[]) {
  callbacks.shift()?.(0);
}
