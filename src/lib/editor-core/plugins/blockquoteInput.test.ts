import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { blockquoteInputPlugin, createBlockquoteInputTransaction } from './blockquoteInput';
import { trailingParagraphPlugin } from './trailingParagraph';
import { schema } from '../schema';

function topLevelNodeNames(state: EditorState): string[] {
  const names: string[] = [];
  state.doc.forEach((node) => names.push(node.type.name));
  return names;
}

function createShortcutState(text: string): EditorState {
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, schema.text(text)),
  ]);
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, text.length + 1),
    plugins: [trailingParagraphPlugin()],
  });
}

function createPluginView(text = '>'): {
  plugin: ReturnType<typeof blockquoteInputPlugin>;
  view: EditorView;
} {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const plugin = blockquoteInputPlugin();
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, schema.text(text)),
  ]);
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

function createSpaceBeforeInputEvent(isComposing = false): InputEvent {
  return new InputEvent('beforeinput', {
    inputType: 'insertText',
    data: ' ',
    isComposing,
    bubbles: true,
    cancelable: true,
  });
}

function createCompositionEvent(type: string, data: string): CompositionEvent {
  return new CompositionEvent(type, {
    data,
    bubbles: true,
    cancelable: true,
  });
}

describe('blockquoteInputPlugin', () => {
  it('converts a complete leading > shortcut into an editable blockquote', () => {
    const state = createShortcutState('>');

    const tr = createBlockquoteInputTransaction(state);
    expect(tr).not.toBeNull();

    const { state: nextState } = state.applyTransaction(tr!);
    expect(topLevelNodeNames(nextState)).toEqual(['blockquote']);
    expect(nextState.doc.child(0).child(0).type.name).toBe('paragraph');
    expect(nextState.doc.textContent).toBe('');
  });

  it('does not convert partial or non-leading > text', () => {
    expect(createBlockquoteInputTransaction(createShortcutState(' >'))).toBeNull();
    expect(createBlockquoteInputTransaction(createShortcutState('a>'))).toBeNull();
  });

  it('ignores composing space input events', () => {
    const { plugin, view } = createPluginView();
    const event = createSpaceBeforeInputEvent(true);

    const handled = plugin.props.handleDOMEvents?.beforeinput?.call(plugin, view, event) ?? false;

    expect(handled).toBe(false);
    expect(view.state.doc.textContent).toBe('>');

    destroyPluginView(view);
  });

  it('does not run a delayed conversion in the same task after compositionend', () => {
    const { plugin, view } = createPluginView();

    plugin.props.handleDOMEvents?.compositionend?.call(
      plugin,
      view,
      createCompositionEvent('compositionend', ''),
    );
    const handled =
      plugin.props.handleDOMEvents?.beforeinput?.call(
        plugin,
        view,
        createSpaceBeforeInputEvent(false),
      ) ?? false;

    expect(handled).toBe(false);
    expect(view.state.doc.textContent).toBe('>');

    destroyPluginView(view);
  });

  it('removes macOS IME preedit text duplicated into the paragraph above the committed text', async () => {
    const { plugin, view } = createPluginView();

    plugin.props.handleDOMEvents?.beforeinput?.call(
      plugin,
      view,
      createSpaceBeforeInputEvent(false),
    );
    plugin.props.handleDOMEvents?.compositionstart?.call(
      plugin,
      view,
      createCompositionEvent('compositionstart', ''),
    );
    view.dispatch(view.state.tr.insertText("ce'shi"));
    view.dispatch(view.state.tr.split(view.state.selection.from));
    view.dispatch(view.state.tr.insertText('测试'));
    plugin.props.handleDOMEvents?.compositionend?.call(
      plugin,
      view,
      createCompositionEvent('compositionend', '测试'),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(view.state.doc.child(0).textContent).toBe('测试');
    expect(view.state.doc.child(0).childCount).toBe(1);

    destroyPluginView(view);
  });

  it('can infer committed CJK text from the document when compositionend has no data', async () => {
    const { plugin, view } = createPluginView();

    plugin.props.handleDOMEvents?.keydown?.call(
      plugin,
      view,
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    );
    plugin.props.handleDOMEvents?.compositionstart?.call(
      plugin,
      view,
      createCompositionEvent('compositionstart', ''),
    );
    view.dispatch(view.state.tr.insertText("ce'shi"));
    view.dispatch(view.state.tr.split(view.state.selection.from));
    view.dispatch(view.state.tr.insertText('测试'));
    plugin.props.handleDOMEvents?.compositionend?.call(
      plugin,
      view,
      createCompositionEvent('compositionend', ''),
    );

    await new Promise((resolve) => setTimeout(resolve, 130));

    expect(view.state.doc.child(0).textContent).toBe('测试');
    expect(view.state.doc.child(0).childCount).toBe(1);

    destroyPluginView(view);
  });

  it('removes macOS IME preedit text duplicated as a prefix before committed text', async () => {
    const { plugin, view } = createPluginView();

    plugin.props.handleDOMEvents?.beforeinput?.call(
      plugin,
      view,
      createSpaceBeforeInputEvent(false),
    );
    plugin.props.handleDOMEvents?.compositionstart?.call(
      plugin,
      view,
      createCompositionEvent('compositionstart', ''),
    );
    view.dispatch(view.state.tr.insertText("ce'shi测试"));
    plugin.props.handleDOMEvents?.compositionend?.call(
      plugin,
      view,
      createCompositionEvent('compositionend', '测试'),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(view.state.doc.child(0).textContent).toBe('测试');

    destroyPluginView(view);
  });
});
