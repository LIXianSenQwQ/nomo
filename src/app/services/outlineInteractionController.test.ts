import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditorCore } from '../../lib/editor-core';
import { extractOutline } from '../../lib/outline/outlineService';
import {
  createOutlineInteractionController,
  replaceTextareaWithNativeUndo,
} from './outlineInteractionController';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('replaceTextareaWithNativeUndo', () => {
  it('uses one native insertText replacement instead of a programmatic fallback', () => {
    const textarea = document.createElement('textarea');
    textarea.value = '# One\n# Two\n';
    textarea.setSelectionRange(2, 2);
    const execCommand = vi.fn((command: string, _showUi?: boolean, value?: string) => {
      if (command !== 'insertText') return false;
      const from = textarea.selectionStart;
      const to = textarea.selectionEnd;
      textarea.value = `${textarea.value.slice(0, from)}${value ?? ''}${textarea.value.slice(to)}`;
      return true;
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

    expect(replaceTextareaWithNativeUndo(textarea, '# Two\n# One\n')).toBe(true);
    expect(textarea.value).toBe('# Two\n# One\n');
    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith('insertText', false, 'Two\n# One');
  });

  it('fails closed and restores the visible value when native replacement is unsupported', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'before';
    textarea.setSelectionRange(2, 4);
    const execCommand = vi.fn((command: string) => {
      if (command === 'insertText') textarea.value = 'partial mutation';
      if (command === 'undo') textarea.value = 'before';
      return false;
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

    expect(replaceTextareaWithNativeUndo(textarea, 'after')).toBe(false);
    expect(textarea.value).toBe('before');
    expect(textarea.selectionStart).toBe(2);
    expect(textarea.selectionEnd).toBe(4);
    expect(execCommand).toHaveBeenNthCalledWith(2, 'undo');
  });

  it('restores collapsed and active identity after the deferred source analysis', async () => {
    vi.useFakeTimers();
    const markdown = '# Same\n## Child\n# Same\n';
    let outline = extractOutline(markdown);
    const textarea = document.createElement('textarea');
    textarea.value = markdown;
    const editor = createEditorCore({ markdown });
    const setMarkdown = vi.spyOn(editor, 'setMarkdown');
    let collapsed = new Set([outline[0].id]);
    let activeId = '';
    const setStatusMessage = vi.fn();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn((command: string, _showUi?: boolean, value?: string) => {
        if (command !== 'insertText') return false;
        const from = textarea.selectionStart;
        const to = textarea.selectionEnd;
        textarea.value = `${textarea.value.slice(0, from)}${value ?? ''}${textarea.value.slice(to)}`;
        textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
        return true;
      }),
    });
    textarea.addEventListener('input', () => {
      editor.setMarkdown(textarea.value, { reason: 'source-input', sourceInput: true });
      outline = extractOutline(textarea.value);
    });
    const controller = createOutlineInteractionController({
      getMode: () => 'source',
      getMarkdown: () => markdown,
      getOutline: () => outline,
      getCollapsedOutlineIds: () => collapsed,
      setCollapsedOutlineIds: (value) => {
        collapsed = value;
      },
      getOutlineVisible: () => true,
      setOutlineVisible: vi.fn(),
      setActiveOutlineId: (value) => {
        activeId = value;
      },
      getSuppressOutlineScrollUntil: () => 0,
      setSuppressOutlineScrollUntil: vi.fn(),
      getSemanticPane: () => document.createElement('section'),
      getSourcePane: () => document.createElement('section'),
      getSourceTextarea: () => textarea,
      getEditor: () => editor,
      getReadonly: () => false,
      setStatusMessage,
    });

    expect(
      controller.moveOutlineSection({ sourceIndex: 0, targetIndex: 2, placement: 'after' }),
    ).toBe(true);
    expect(extractOutline(textarea.value).map((item) => item.title)).toEqual([
      'Same',
      'Same',
      'Child',
    ]);
    expect(activeId).toBe('');
    await vi.advanceTimersByTimeAsync(150);
    expect(activeId).toBe('same-2');
    expect(collapsed).toEqual(new Set(['same-2']));
    expect(setStatusMessage).toHaveBeenCalled();
    expect(setMarkdown).toHaveBeenCalledTimes(1);

    editor.destroy();
  });

  it('flushes a semantic move immediately so document and outline update together', () => {
    let markdown = '# One\n\none\n\n# Two\n\ntwo';
    let outline = extractOutline(markdown);
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown, mode: 'semantic', target });
    editor.subscribe((event) => {
      if (event.reason !== 'content-sync') return;
      markdown = event.markdown;
      outline = extractOutline(markdown);
    });
    let activeId = '';
    const controller = createOutlineInteractionController({
      getMode: () => 'semantic',
      getMarkdown: () => markdown,
      getOutline: () => outline,
      getCollapsedOutlineIds: () => new Set(),
      setCollapsedOutlineIds: vi.fn(),
      getOutlineVisible: () => true,
      setOutlineVisible: vi.fn(),
      setActiveOutlineId: (value) => {
        activeId = value;
      },
      getSuppressOutlineScrollUntil: () => 0,
      setSuppressOutlineScrollUntil: vi.fn(),
      getSemanticPane: () => document.createElement('section'),
      getSourcePane: () => document.createElement('section'),
      getSourceTextarea: () => document.createElement('textarea'),
      getEditor: () => editor,
      getReadonly: () => false,
      setStatusMessage: vi.fn(),
    });

    expect(
      controller.moveOutlineSection({ sourceIndex: 0, targetIndex: 1, placement: 'after' }),
    ).toBe(true);
    expect(outline.map((item) => item.title)).toEqual(['Two', 'One']);
    expect(activeId).toBe('one');
    expect([...target.querySelectorAll('h1')].map((heading) => heading.textContent)).toEqual([
      'Two',
      'One',
    ]);

    editor.destroy();
  });
});
