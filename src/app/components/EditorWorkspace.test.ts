import { cleanup, fireEvent, render } from '@testing-library/svelte/pure';
import { tick, type ComponentProps } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractOutline } from '../../lib/outline/outlineService';
import EditorWorkspace from './EditorWorkspace.svelte';

type Props = ComponentProps<typeof EditorWorkspace>;

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

describe('EditorWorkspace outline drag', () => {
  it('keeps a short press as a click and starts whole-row dragging only after 5px', async () => {
    const jumpToOutlineItem = vi.fn();
    const moveOutlineSection = vi.fn(() => true);
    const markdown = '# One\none\n# Two\ntwo\n';
    const { container } = render(EditorWorkspace, {
      props: createProps(markdown, { jumpToOutlineItem, moveOutlineSection }),
    });
    const rows = [...container.querySelectorAll<HTMLElement>('.content-outline-row')];
    const panel = container.querySelector<HTMLElement>('.content-outline')!;
    const firstLink = rows[0].querySelector<HTMLButtonElement>('.outline-link')!;
    const pointerCapture = mockPointerCapture(rows[0]);
    expect(panel.classList.contains('outline-dragging')).toBe(false);

    await dispatchPointer(firstLink, 'pointerdown', { clientX: 0, clientY: 5 });
    await dispatchPointer(window, 'pointermove', { clientX: 4, clientY: 5 });
    expect(pointerCapture.set).not.toHaveBeenCalled();
    await dispatchPointer(window, 'pointerup', { clientX: 2, clientY: 5 });
    await fireEvent.click(firstLink);
    expect(jumpToOutlineItem).toHaveBeenCalledTimes(1);
    expect(moveOutlineSection).not.toHaveBeenCalled();

    rows[1].getBoundingClientRect = () =>
      ({ top: 30, bottom: 60, left: 0, right: 200, width: 200, height: 30 } as DOMRect);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => rows[1],
    });
    await dispatchPointer(rows[0], 'pointerdown', { clientX: 0, clientY: 5 });
    await dispatchPointer(window, 'pointermove', { clientX: 4, clientY: 5 });
    expect(document.body.querySelector('.outline-drag-preview')).toBeNull();

    await dispatchPointer(window, 'pointermove', { clientX: 6, clientY: 45 });
    expect(document.body.querySelector('.outline-drag-preview')).not.toBeNull();
    expect(panel.classList.contains('outline-dragging')).toBe(true);
    expect(rows[1].classList.contains('outline-drop-inside')).toBe(true);
    expect(pointerCapture.set).toHaveBeenCalledTimes(1);
    expect(pointerCapture.set).toHaveBeenCalledWith(1);
    await dispatchPointer(window, 'pointerup', { clientX: 6, clientY: 45 });
    expect(panel.classList.contains('outline-dragging')).toBe(false);
    expect(pointerCapture.release).toHaveBeenCalledTimes(1);
    expect(pointerCapture.release).toHaveBeenCalledWith(1);

    expect(moveOutlineSection).toHaveBeenCalledWith({
      sourceIndex: 0,
      targetIndex: 1,
      placement: 'inside',
    });

    await dragTo(rows[0], rows[1], 35);
    await dragTo(rows[0], rows[1], 55);
    expect(moveOutlineSection).toHaveBeenNthCalledWith(2, {
      sourceIndex: 0,
      targetIndex: 1,
      placement: 'before',
    });
    expect(moveOutlineSection).toHaveBeenNthCalledWith(3, {
      sourceIndex: 0,
      targetIndex: 1,
      placement: 'after',
    });
    expect(pointerCapture.set).toHaveBeenCalledTimes(3);
    expect(pointerCapture.release).toHaveBeenCalledTimes(3);
    expect(jumpToOutlineItem).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-outline-drag-handle]')).toBeNull();
  });

  it('auto-expands a collapsed target after 500ms and cancels without moving on Escape', async () => {
    vi.useFakeTimers();
    const markdown = '# Source\n# Target\n## Child\n';
    const outline = extractOutline(markdown);
    const toggleOutlineItemExpanded = vi.fn();
    const moveOutlineSection = vi.fn(() => true);
    const { container } = render(EditorWorkspace, {
      props: createProps(markdown, {
        collapsedOutlineIds: new Set([outline[1].id]),
        isOutlineItemExpandable: (index) => index === 1,
        toggleOutlineItemExpanded,
        moveOutlineSection,
      }),
    });
    const panel = container.querySelector<HTMLElement>('.content-outline')!;
    panel.getBoundingClientRect = () =>
      ({ top: 0, bottom: 300, left: 0, right: 220, width: 220, height: 300 } as DOMRect);
    const rows = [...container.querySelectorAll<HTMLElement>('.content-outline-row')];
    const pointerCapture = mockPointerCapture(rows[0]);
    rows[1].getBoundingClientRect = () =>
      ({ top: 30, bottom: 60, left: 0, right: 200, width: 200, height: 30 } as DOMRect);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => rows[1],
    });

    await dispatchPointer(rows[0], 'pointerdown', { clientX: 0, clientY: 5 });
    await dispatchPointer(window, 'pointermove', { clientX: 6, clientY: 45 });
    expect(pointerCapture.set).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(toggleOutlineItemExpanded).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(toggleOutlineItemExpanded).toHaveBeenCalledWith(outline[1]);

    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.body.querySelector('.outline-drag-preview')).toBeNull();
    expect(pointerCapture.release).toHaveBeenCalledTimes(1);
    await dispatchPointer(window, 'pointerup', { clientX: 6, clientY: 45 });
    expect(moveOutlineSection).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('keeps the expand toggle outside the whole-row drag state machine', async () => {
    const markdown = '# Parent\n## Child\n';
    const outline = extractOutline(markdown);
    const toggleOutlineItemExpanded = vi.fn();
    const moveOutlineSection = vi.fn(() => true);
    const { container } = render(EditorWorkspace, {
      props: createProps(markdown, {
        isOutlineItemExpandable: (index) => index === 0,
        toggleOutlineItemExpanded,
        moveOutlineSection,
      }),
    });
    const firstRow = container.querySelector<HTMLElement>('.content-outline-row')!;
    const toggle = firstRow.querySelector<HTMLButtonElement>('.outline-toggle')!;
    const pointerCapture = mockPointerCapture(firstRow);

    await dispatchPointer(toggle, 'pointerdown', { clientX: 0, clientY: 5 });
    await dispatchPointer(window, 'pointermove', { clientX: 8, clientY: 5 });
    await dispatchPointer(window, 'pointerup', { clientX: 8, clientY: 5 });
    await fireEvent.click(toggle);

    expect(toggleOutlineItemExpanded).toHaveBeenCalledWith(outline[0]);
    expect(pointerCapture.set).not.toHaveBeenCalled();
    expect(moveOutlineSection).not.toHaveBeenCalled();
    expect(document.body.querySelector('.outline-drag-preview')).toBeNull();
  });
});

function createProps(markdown: string, overrides: Partial<Props> = {}): Props {
  const outline = extractOutline(markdown);
  const noop = () => undefined;
  return {
    interfaceLocale: 'en-US',
    mode: 'source',
    markdown,
    largeDocumentMode: false,
    frontMatter: null,
    frontMatterEditing: false,
    frontMatterFocusRequest: 0,
    frontMatterFocusTarget: 'default',
    readonlyDocumentMode: false,
    outlineVisible: true,
    outline,
    activeOutlineId: '',
    collapsedOutlineIds: new Set(),
    visibleOutlineIds: new Set(outline.map((item) => item.id)),
    sourceTextarea: undefined as unknown as HTMLTextAreaElement,
    sourcePane: undefined as unknown as HTMLElement,
    semanticPane: undefined as unknown as HTMLElement,
    editorHost: undefined as unknown as HTMLDivElement,
    updateMarkdown: noop,
    enterFrontMatterEdit: noop,
    leaveFrontMatterEdit: noop,
    updateFrontMatterContent: noop,
    deleteFrontMatter: noop,
    updateActiveOutlineFromSourceScroll: noop,
    updateActiveOutlineFromSemanticScroll: noop,
    handleEditorPaste: noop,
    handleEditorDrop: noop,
    handleWorkspaceContextMenu: noop,
    openContextMenu: noop,
    copyContextText: noop,
    isOutlineItemExpandable: () => false,
    toggleOutlineItemExpanded: noop,
    jumpToOutlineItem: noop,
    moveOutlineSection: () => false,
    ...overrides,
  };
}

async function dispatchPointer(
  target: EventTarget,
  type: string,
  init: { clientX: number; clientY: number },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: init.clientX,
    clientY: init.clientY,
  });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'mouse' },
    isPrimary: { value: true },
  });
  target.dispatchEvent(event);
  await tick();
}

async function dragTo(source: HTMLElement, target: HTMLElement, clientY: number) {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => target,
  });
  await dispatchPointer(source, 'pointerdown', { clientX: 0, clientY: 5 });
  await dispatchPointer(window, 'pointermove', { clientX: 6, clientY });
  await dispatchPointer(window, 'pointerup', { clientX: 6, clientY });
}

function mockPointerCapture(row: HTMLElement) {
  let captured = false;
  const set = vi.fn(() => {
    captured = true;
  });
  const release = vi.fn(() => {
    captured = false;
  });
  const has = vi.fn(() => captured);
  Object.defineProperties(row, {
    setPointerCapture: { configurable: true, value: set },
    releasePointerCapture: { configurable: true, value: release },
    hasPointerCapture: { configurable: true, value: has },
  });
  return { set, release, has };
}
