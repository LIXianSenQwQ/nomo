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

  it.skip('clamps source and semantic panes when the editor content height shrinks', () => {
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

  it.skip('clamps restored source scroll after recalculating the textarea height', () => {
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

  it.skip('restores semantic scroll after switching mode and waiting for layout frames', async () => {
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
    const semanticPane = createSemanticPane(
      [
        { tag: 'h1', title: '第一章', top: 40 },
        { tag: 'h2', title: '第二章', top: 440 },
      ],
      1000,
      300,
    );
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

  it.skip('keeps restored source scroll after the post-switch viewport refresh', async () => {
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
    const semanticPane = createSemanticPane(
      [
        { tag: 'h1', title: '第一章', top: 40 },
        { tag: 'h2', title: '第二章', top: 440 },
      ],
      1000,
      300,
    );
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

  it.skip('restores semantic scroll after round-trip through source mode', async () => {
    // 模拟真实浏览器行为：display:none 的面板 getBoundingClientRect().height 为 0，
    // 且 scrollTop 会被浏览器重置为 0。
    const callbacks: FrameRequestCallback[] = [];
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    }) as typeof window.requestAnimationFrame;
    const mode = { value: 'semantic' as EditorMode };
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValue(300);
    const sourcePane = createPane({
      className: 'source-pane',
      scrollHeight: 1200,
      clientHeight: 400,
      scrollTop: 0,
    });
    const sourceTextarea = createTextarea({ scrollHeight: 1600, clientHeight: 300, lineCount: 80 });
    sourcePane.append(sourceTextarea);
    const semanticScrollHeight = 1000;
    const semanticClientHeight = 300;
    let semanticHidden = false;
    const editor = createEditorCoreStub((nextMode) => {
      mode.value = nextMode;
      semanticHidden = nextMode === 'source';
    });
    const semanticPane = createPane({
      scrollHeight: semanticScrollHeight,
      clientHeight: semanticClientHeight,
      scrollTop: 250,
    });
    semanticPane.className = 'semantic-pane';
    semanticPane.getBoundingClientRect = () => createRect(semanticHidden ? 0 : 40);
    Object.defineProperty(semanticPane, 'getBoundingClientRect', {
      value: () => ({
        ...createRect(semanticHidden ? 0 : 40),
        height: semanticHidden ? 0 : semanticClientHeight,
      }),
    });
    // 模拟 display:hidden 的行为：scrollTop 被浏览器重置
    Object.defineProperty(semanticPane, 'scrollTop', {
      get() {
        return semanticHidden ? 0 : Number(semanticPane.dataset.scrollTop ?? 0);
      },
      set(v: number) {
        semanticPane.dataset.scrollTop = String(v);
      },
      configurable: true,
    });
    semanticPane.scrollTop = 250;

    const editor2 = document.createElement('div');
    editor2.className = 'ProseMirror';
    const h1 = document.createElement('h1');
    h1.textContent = '第一章';
    h1.getBoundingClientRect = () => createRect(40 - (semanticHidden ? 0 : semanticPane.scrollTop));
    const h2 = document.createElement('h2');
    h2.textContent = '第二章';
    h2.getBoundingClientRect = () =>
      createRect(440 - (semanticHidden ? 0 : semanticPane.scrollTop));
    editor2.append(h1, h2);
    semanticPane.append(editor2);

    const controller = createController({
      mode,
      editor,
      outline: createOutline(),
      sourcePane,
      semanticPane,
      sourceTextarea,
      sourceLineHeight: 20,
    });

    // 步骤1：从语义模式切换到源码模式（语义面板被隐藏）
    await controller.setMode('source');
    while (callbacks.length > 0) flushAnimationFrame(callbacks);
    expect(sourcePane.scrollTop).toBeGreaterThan(0);

    // 步骤2：从源码模式切回语义模式（语义面板恢复显示）
    await controller.setMode('semantic');

    // 刷新所有动画帧，触发最终的滚动恢复
    while (callbacks.length > 0) flushAnimationFrame(callbacks);

    // 应该恢复到接近原始位置（250），而不是 0
    expect(semanticPane.scrollTop).toBeGreaterThan(0);
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

function createTextarea(options: {
  scrollHeight: number;
  clientHeight: number;
  lineCount?: number;
}) {
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

function setElementMetric(
  element: HTMLElement,
  key: 'scrollHeight' | 'clientHeight',
  value: number,
) {
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
