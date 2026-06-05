import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { serializeMarkdown } from '../markdown';
import { schema } from '../schema';
import { inlineMarkdownMarkInputPlugin } from './inlineMarkdownMarkInput';

describe('inlineMarkdownMarkInputPlugin', () => {
  it('converts manually typed strong markdown into a strong mark', () => {
    const { target, view } = createEmptyView();

    view.dispatch(view.state.tr.insertText('**123**'));

    expect(view.state.doc.textBetween(0, view.state.doc.content.size)).toBe('123');
    expect(hasTextMark(view.state, 'strong')).toBe(true);
    expect(serializeMarkdown(view.state.doc).trim()).toBe('**123**');

    view.destroy();
    target.remove();
  });

  it('converts manually typed strikethrough markdown into a strikethrough mark', () => {
    const { target, view } = createEmptyView();

    view.dispatch(view.state.tr.insertText('~~123~~'));

    expect(view.state.doc.textBetween(0, view.state.doc.content.size)).toBe('123');
    expect(hasTextMark(view.state, 'strikethrough')).toBe(true);
    expect(serializeMarkdown(view.state.doc).trim()).toBe('~~123~~');

    view.destroy();
    target.remove();
  });

  it('converts manually typed emphasis markdown into an em mark', () => {
    const { target, view } = createEmptyView();

    view.dispatch(view.state.tr.insertText('*123*'));

    expect(view.state.doc.textBetween(0, view.state.doc.content.size)).toBe('123');
    expect(hasTextMark(view.state, 'em')).toBe(true);
    expect(serializeMarkdown(view.state.doc).trim()).toBe('*123*');

    view.destroy();
    target.remove();
  });

  it('converts manually typed underline tags into an underline mark', () => {
    const { target, view } = createEmptyView();

    view.dispatch(view.state.tr.insertText('<u>123</u>'));

    expect(view.state.doc.textBetween(0, view.state.doc.content.size)).toBe('123');
    expect(hasTextMark(view.state, 'underline')).toBe(true);
    expect(serializeMarkdown(view.state.doc).trim()).toBe('<u>123</u>');

    view.destroy();
    target.remove();
  });

  it('keeps escaped manual mark delimiters as plain text', () => {
    const { target, view } = createEmptyView();

    view.dispatch(view.state.tr.insertText('\\**123**'));

    expect(view.state.doc.textBetween(0, view.state.doc.content.size)).toBe('\\**123**');
    expect(hasTextMark(view.state, 'strong')).toBe(false);

    view.destroy();
    target.remove();
  });
});

function createEmptyView(): { target: HTMLElement; view: EditorView } {
  const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
  const target = document.createElement('div');
  document.body.appendChild(target);

  const view = new EditorView(target, {
    state: EditorState.create({
      doc,
      selection: TextSelection.create(doc, 1),
      plugins: [inlineMarkdownMarkInputPlugin()],
    }),
  });

  return { target, view };
}

function hasTextMark(state: EditorState, markTypeName: string): boolean {
  let found = false;
  state.doc.descendants((node) => {
    if (found) return false;
    if (!node.isText) return true;
    found = node.marks.some((mark) => mark.type.name === markTypeName);
    return !found;
  });
  return found;
}
