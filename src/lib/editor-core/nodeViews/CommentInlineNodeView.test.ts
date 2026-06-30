import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from 'prosemirror-view';
import { schema } from '../schema';
import { CommentInlineNodeView } from './CommentInlineNodeView';

describe('CommentInlineNodeView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders empty inline comments as an empty comment label', () => {
    const nodeView = createNodeView('');

    expect(nodeView.dom.textContent).toBe('Empty comment');
    expect(nodeView.dom.title).toBe('Empty comment');
    expect(nodeView.dom.getAttribute('aria-label')).toBe('Inline comment');
    expect(nodeView.dom.classList.contains('is-empty')).toBe(true);
  });

  it('renders short inline comments with the full preview text', () => {
    const nodeView = createNodeView('短内容');

    expect(nodeView.dom.textContent).toBe('短内容');
    expect(nodeView.dom.title).toBe('短内容');
    expect(nodeView.dom.getAttribute('aria-label')).toBe('Inline comment: 短内容');
  });

  it('truncates long inline comments to twelve Unicode characters', () => {
    const content = '这里解释为什么这样写以及后续原因';
    const nodeView = createNodeView(content);

    expect(nodeView.dom.textContent).toBe('这里解释为什么这样写以及…');
    expect(nodeView.dom.title).toBe(content);
    expect(nodeView.dom.getAttribute('aria-label')).toBe(`Inline comment: ${content}`);
  });

  it('sizes the editing input from measured content width without forcing a long field', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function getBoundingClientRectMock(this: HTMLElement) {
        const width = this.classList.contains('comment-inline-measure') ? 58 : 0;
        return {
          x: 0,
          y: 0,
          width,
          height: 0,
          top: 0,
          right: width,
          bottom: 0,
          left: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });

    const nodeView = createNodeView('短内容');
    (nodeView as unknown as { enterEdit(): void }).enterEdit();

    const input = nodeView.dom.querySelector<HTMLInputElement>('.comment-inline-input');
    if (!input) throw new Error('Expected inline comment input to exist');
    (nodeView as unknown as { updateInputWidth(): void }).updateInputWidth();

    expect(input.style.width).toBe('64px');
    rectSpy.mockRestore();
  });
});

function createNodeView(content: string): CommentInlineNodeView {
  const node = schema.nodes.comment_inline.create({ content });
  const view = {
    state: { tr: null },
    dispatch: vi.fn(),
    focus: vi.fn(),
  } as unknown as EditorView;

  return new CommentInlineNodeView(node, view, () => 0);
}
