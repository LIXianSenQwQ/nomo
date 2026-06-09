import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OutlineItem } from '../../lib/outline/outlineService';
import { getActiveOutlineIdFromSemantic, scrollSemanticToAnchor } from './outlineNavigation';

describe('outlineNavigation', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    vi.restoreAllMocks();
  });

  it('matches semantic headings by generated id without native instant scrolling', () => {
    const semanticPane = document.createElement('section');
    semanticPane.className = 'semantic-pane';
    Object.defineProperty(semanticPane, 'scrollHeight', { value: 800, configurable: true });
    semanticPane.getBoundingClientRect = () => createRect(0);

    const editor = document.createElement('div');
    editor.className = 'ProseMirror';
    const first = document.createElement('h1');
    first.textContent = 'Same';
    const second = document.createElement('h2');
    second.textContent = 'Same';
    first.getBoundingClientRect = () => createRect(80);
    second.getBoundingClientRect = () => createRect(240);
    editor.append(first, second);
    semanticPane.append(editor);

    const scrollTo = vi.fn();
    semanticPane.scrollTo = scrollTo;
    const outline: OutlineItem[] = [
      { id: 'same', level: 1, title: 'Same', line: 1 },
      { id: 'same-2', level: 2, title: 'Same', line: 3 },
    ];
    window.requestAnimationFrame = undefined as never;
    window.cancelAnimationFrame = vi.fn();

    scrollSemanticToAnchor(outline, semanticPane, {
      outlineId: 'same-2',
      sectionProgress: 0,
    });

    expect(scrollTo).not.toHaveBeenCalled();
    expect(semanticPane.scrollTop).toBe(208);
  });

  it('reports the active semantic heading by generated id', () => {
    const semanticPane = document.createElement('section');
    semanticPane.className = 'semantic-pane';
    semanticPane.getBoundingClientRect = () => createRect(0);

    const editor = document.createElement('div');
    editor.className = 'ProseMirror';
    const first = document.createElement('h1');
    first.textContent = 'Same';
    const second = document.createElement('h2');
    second.textContent = 'Same';
    first.getBoundingClientRect = () => createRect(20);
    second.getBoundingClientRect = () => createRect(60);
    editor.append(first, second);
    semanticPane.append(editor);

    expect(
      getActiveOutlineIdFromSemantic(
        [
          { id: 'same', level: 1, title: 'Same', line: 1 },
          { id: 'same-2', level: 2, title: 'Same', line: 3 },
        ],
        semanticPane,
      ),
    ).toBe('same-2');
  });
});

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
