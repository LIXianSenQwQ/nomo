import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from '../schema';
import { windowsImePunctuationFallbackPlugin } from './windowsImePunctuationFallback';

describe('windowsImePunctuationFallbackPlugin', () => {
  it('inserts paired full-width parentheses and places the caret between them', () => {
    const { plugin, view } = createPluginView('');

    dispatchPluginKeydown(
      plugin,
      view,
      createKeyboardEvent('keydown', 'Shift', { shiftKey: true }),
    );
    const handled = dispatchPluginKeyup(
      plugin,
      view,
      createKeyboardEvent('keyup', '(', { shiftKey: true }, view.dom),
    );

    expect(handled).toBe(true);
    expect(view.state.doc.textContent).toBe('（）');
    expect(view.state.selection.from).toBe(2);

    const arrowLeft = createKeyboardEvent('keydown', 'ArrowLeft', {}, view.dom);
    expect(dispatchPluginKeydown(plugin, view, arrowLeft)).toBe(true);
    expect(arrowLeft.defaultPrevented).toBe(true);
    expect(view.state.selection.from).toBe(2);

    destroyPluginView(view);
  });

  it('replaces selected text with paired full-width parentheses', () => {
    const { plugin, view } = createPluginView('abc');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2, 3)));

    dispatchPluginKeydown(
      plugin,
      view,
      createKeyboardEvent('keydown', 'Shift', { shiftKey: true }),
    );
    const handled = dispatchPluginKeyup(
      plugin,
      view,
      createKeyboardEvent('keyup', '(', { shiftKey: true }, view.dom),
    );

    expect(handled).toBe(true);
    expect(view.state.doc.textContent).toBe('a（）c');
    expect(view.state.selection.from).toBe(3);

    destroyPluginView(view);
  });

  it('does not duplicate normal beforeinput paths', () => {
    const { plugin, view } = createPluginView('');

    dispatchPluginKeydown(
      plugin,
      view,
      createKeyboardEvent('keydown', 'Shift', { shiftKey: true }),
    );
    plugin.props.handleDOMEvents?.beforeinput?.call(
      plugin,
      view,
      new InputEvent('beforeinput', {
        bubbles: true,
        inputType: 'insertText',
        data: '（）',
      }),
    );
    const handled = dispatchPluginKeyup(
      plugin,
      view,
      createKeyboardEvent('keyup', '(', { shiftKey: true }, view.dom),
    );

    expect(handled).toBe(false);
    expect(view.state.doc.textContent).toBe('');

    destroyPluginView(view);
  });

  it('does not steal events from nested native textareas', () => {
    const { plugin, view } = createPluginView('');
    const textarea = document.createElement('textarea');
    view.dom.appendChild(textarea);

    dispatchPluginKeydown(
      plugin,
      view,
      createKeyboardEvent('keydown', 'Shift', { shiftKey: true }),
    );
    const handled = dispatchPluginKeyup(
      plugin,
      view,
      createKeyboardEvent('keyup', '(', { shiftKey: true }, textarea),
    );

    expect(handled).toBe(false);
    expect(view.state.doc.textContent).toBe('');

    destroyPluginView(view);
  });
});

function createPluginView(text: string): {
  plugin: ReturnType<typeof windowsImePunctuationFallbackPlugin>;
  view: EditorView;
} {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const plugin = windowsImePunctuationFallbackPlugin({ enabled: true });
  const paragraph = text
    ? schema.nodes.paragraph.create(null, schema.text(text))
    : schema.nodes.paragraph.create();
  const doc = schema.nodes.doc.create(null, [paragraph]);
  const view = new EditorView(target, {
    state: EditorState.create({
      doc,
      selection: TextSelection.create(doc, text.length + 1),
      plugins: [plugin],
    }),
  });
  return { plugin, view };
}

function destroyPluginView(view: EditorView): void {
  view.destroy();
  view.dom.parentElement?.remove();
}

function dispatchPluginKeydown(
  plugin: ReturnType<typeof windowsImePunctuationFallbackPlugin>,
  view: EditorView,
  event: KeyboardEvent,
): boolean {
  return plugin.props.handleDOMEvents?.keydown?.call(plugin, view, event) ?? false;
}

function dispatchPluginKeyup(
  plugin: ReturnType<typeof windowsImePunctuationFallbackPlugin>,
  view: EditorView,
  event: KeyboardEvent,
): boolean {
  return plugin.props.handleDOMEvents?.keyup?.call(plugin, view, event) ?? false;
}

function createKeyboardEvent(
  type: 'keydown' | 'keyup',
  key: string,
  init: KeyboardEventInit = {},
  target?: EventTarget,
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  if (target) {
    Object.defineProperty(event, 'target', {
      configurable: true,
      value: target,
    });
  }
  return event;
}
