import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { serializeMarkdown } from '../markdown';
import { schema } from '../schema';
import { inlineMarkdownMarkInputPlugin } from './inlineMarkdownMarkInput';
import { pendingInlineMarkKey, pendingInlineMarkPlugin } from './pendingInlineMark';

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

  it('converts manually typed mark tags into a highlight mark', () => {
    const { target, view } = createEmptyView();

    view.dispatch(view.state.tr.insertText('<mark>123</mark>'));

    expect(view.state.doc.textBetween(0, view.state.doc.content.size)).toBe('123');
    expect(hasTextMark(view.state, 'highlight')).toBe(true);
    expect(serializeMarkdown(view.state.doc).trim()).toBe('<mark>123</mark>');

    view.destroy();
    target.remove();
  });

  it('turns a manually typed opening underline tag into pending underline input', () => {
    const { target, view } = createEmptyView();

    typeText(view, '<u>');

    expect(view.state.doc.textBetween(0, view.state.doc.content.size)).toBe('');
    expect(getPendingMarkNames(view.state)).toContain('underline');

    typeText(view, '123');

    expect(view.state.doc.textBetween(0, view.state.doc.content.size)).toBe('123');
    expect(hasTextMark(view.state, 'underline')).toBe(true);
    expect(serializeMarkdown(view.state.doc).trim()).toBe('<u>123</u>');

    view.destroy();
    target.remove();
  });

  it('turns a manually typed opening mark tag into pending highlight input', () => {
    const { target, view } = createEmptyView();

    typeText(view, '<mark>');

    expect(view.state.doc.textBetween(0, view.state.doc.content.size)).toBe('');
    expect(getPendingMarkNames(view.state)).toContain('highlight');

    typeText(view, '重点');

    expect(view.state.doc.textBetween(0, view.state.doc.content.size)).toBe('重点');
    expect(hasTextMark(view.state, 'highlight')).toBe(true);
    expect(serializeMarkdown(view.state.doc).trim()).toBe('<mark>重点</mark>');

    view.destroy();
    target.remove();
  });

  it('keeps escaped mark tags as plain text', () => {
    const { target, view } = createEmptyView();

    view.dispatch(view.state.tr.insertText('\\<mark>123</mark>'));

    expect(view.state.doc.textBetween(0, view.state.doc.content.size)).toBe(
      '\\<mark>123</mark>',
    );
    expect(hasTextMark(view.state, 'highlight')).toBe(false);

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
      plugins: [inlineMarkdownMarkInputPlugin(), pendingInlineMarkPlugin()],
    }),
  });

  return { target, view };
}

function typeText(view: EditorView, text: string): void {
  for (const char of text) {
    const { from, to } = view.state.selection;
    let handled = false;
    view.someProp('handleTextInput', (handler) => {
      handled = Boolean(handler(view, from, to, char, () => view.state.tr.insertText(char, from, to)));
      return handled;
    });
    if (!handled) {
      view.dispatch(view.state.tr.insertText(char, from, to));
    }
  }
}

function getPendingMarkNames(state: EditorState): string[] {
  return ((pendingInlineMarkKey.getState(state) as { markTypeNames?: string[] } | undefined)
    ?.markTypeNames ?? []) as string[];
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
