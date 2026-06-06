import { describe, expect, it, vi } from 'vitest';
import type { EditorView } from 'prosemirror-view';
import { linkInteractionPlugin } from './linkInteraction';

function createViewStub() {
  return {
    dom: document.createElement('div'),
    focus: vi.fn(),
  } as unknown as EditorView & { dom: HTMLElement; focus: ReturnType<typeof vi.fn> };
}

function createClickEvent(target: EventTarget, options: MouseEventInit = {}) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...options });
  Object.defineProperty(event, 'target', { value: target });
  Object.defineProperty(event, 'composedPath', { value: () => [target] });
  return event;
}

describe('linkInteractionPlugin', () => {
  it('opens a link when Ctrl-clicking the anchor element', () => {
    const openLink = vi.fn();
    const view = createViewStub();
    const plugin = linkInteractionPlugin({ openLink });
    const link = document.createElement('a');
    link.setAttribute('href', 'https://example.com');
    const event = createClickEvent(link, { ctrlKey: true });

    const handled = plugin.props.handleClick?.call(plugin, view, 1, event);

    expect(handled).toBe(true);
    expect(openLink).toHaveBeenCalledWith('https://example.com');
    expect(event.defaultPrevented).toBe(true);
    expect(view.focus).toHaveBeenCalledTimes(1);
  });

  it('opens a link when Ctrl-clicking the text node inside the anchor', () => {
    const openLink = vi.fn();
    const view = createViewStub();
    const plugin = linkInteractionPlugin({ openLink });
    const link = document.createElement('a');
    link.setAttribute('href', 'https://example.com/docs');
    const text = document.createTextNode('文档');
    link.appendChild(text);
    const event = createClickEvent(text, { ctrlKey: true });

    const handled = plugin.props.handleClick?.call(plugin, view, 1, event);

    expect(handled).toBe(true);
    expect(openLink).toHaveBeenCalledWith('https://example.com/docs');
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not open links on plain clicks', () => {
    const openLink = vi.fn();
    const view = createViewStub();
    const plugin = linkInteractionPlugin({ openLink });
    const link = document.createElement('a');
    link.setAttribute('href', 'https://example.com');
    const event = createClickEvent(link);

    const handled = plugin.props.handleClick?.call(plugin, view, 1, event);

    expect(handled).toBe(false);
    expect(openLink).not.toHaveBeenCalled();
  });

  it('marks a link as an open target while Ctrl-hovering it', () => {
    const view = createViewStub();
    const plugin = linkInteractionPlugin();
    const link = document.createElement('a');
    link.setAttribute('href', 'https://example.com');
    const event = createClickEvent(link, { ctrlKey: true });

    const handled = plugin.props.handleDOMEvents?.mousemove?.call(plugin, view, event);

    expect(handled).toBe(false);
    expect(link.classList.contains('is-modifier-open-target')).toBe(true);
    expect(view.dom.classList.contains('has-modifier-link-hover')).toBe(true);
  });

  it('clears the open target marker when releasing Ctrl', () => {
    const view = createViewStub();
    const plugin = linkInteractionPlugin();
    const link = document.createElement('a');
    link.setAttribute('href', 'https://example.com');
    plugin.props.handleDOMEvents?.mousemove?.call(
      plugin,
      view,
      createClickEvent(link, { ctrlKey: true }),
    );

    const handled = plugin.props.handleDOMEvents?.keyup?.call(
      plugin,
      view,
      new KeyboardEvent('keyup'),
    );

    expect(handled).toBe(false);
    expect(link.classList.contains('is-modifier-open-target')).toBe(false);
    expect(view.dom.classList.contains('has-modifier-link-hover')).toBe(false);
  });

  it('blocks dangerous link protocols', () => {
    const openLink = vi.fn();
    const view = createViewStub();
    const plugin = linkInteractionPlugin({ openLink });
    const link = document.createElement('a');
    link.setAttribute('href', 'javascript:alert(1)');
    const event = createClickEvent(link, { ctrlKey: true });

    const handled = plugin.props.handleClick?.call(plugin, view, 1, event);

    expect(handled).toBe(false);
    expect(openLink).not.toHaveBeenCalled();
  });
});
