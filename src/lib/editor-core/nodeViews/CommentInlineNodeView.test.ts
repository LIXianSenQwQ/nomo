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

    expect(nodeView.dom.textContent).toBe('空注释');
    expect(nodeView.dom.title).toBe('空注释');
    expect(nodeView.dom.getAttribute('aria-label')).toBe('行内注释');
    expect(nodeView.dom.classList.contains('is-empty')).toBe(true);
  });

  it('renders short inline comments with the full preview text', () => {
    const nodeView = createNodeView('短内容');

    expect(nodeView.dom.textContent).toBe('注释：短内容');
    expect(nodeView.dom.title).toBe('短内容');
    expect(nodeView.dom.getAttribute('aria-label')).toBe('行内注释：短内容');
  });

  it('truncates long inline comments to twelve Unicode characters', () => {
    const content = '这里解释为什么这样写以及后续原因';
    const nodeView = createNodeView(content);

    expect(nodeView.dom.textContent).toBe('注释：这里解释为什么这样写以及…');
    expect(nodeView.dom.title).toBe(content);
    expect(nodeView.dom.getAttribute('aria-label')).toBe(`行内注释：${content}`);
  });

  it('uses a comfortable minimum width while editing', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    const nodeView = createNodeView('');
    (nodeView as unknown as { enterEdit(): void }).enterEdit();

    const input = nodeView.dom.querySelector<HTMLInputElement>('.comment-inline-input');

    expect(input?.style.width).toBe('24ch');
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
