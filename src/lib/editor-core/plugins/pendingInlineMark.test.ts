import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {
  isPendingMarkActive,
  pendingInlineMarkKey,
  pendingInlineMarkPlugin,
  toggleMarkPending,
} from './pendingInlineMark';
import { schema } from '../schema';

describe('pendingInlineMarkPlugin', () => {
  it('keeps pending delimiters anchored after the first typed character', () => {
    const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
    let state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 1),
      plugins: [pendingInlineMarkPlugin()],
    });

    toggleMarkPending(schema.marks.strong)(state, (tr) => {
      state = state.apply(tr);
    });
    state = state.apply(state.tr.insertText('A'));

    const pending = pendingInlineMarkKey.getState(state);
    const text = state.doc.firstChild?.firstChild;

    expect(isPendingMarkActive(state, schema.marks.strong)).toBe(true);
    expect(pending).toMatchObject({
      active: true,
      markTypeNames: ['strong'],
      anchorPos: 1,
      headPos: 2,
    });
    expect(text?.marks.some((mark) => mark.type === schema.marks.strong)).toBe(true);
  });

  it('keeps multiple pending inline marks active together', () => {
    const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
    let state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 1),
      plugins: [pendingInlineMarkPlugin()],
    });

    toggleMarkPending(schema.marks.strikethrough)(state, (tr) => {
      state = state.apply(tr);
    });
    toggleMarkPending(schema.marks.strong)(state, (tr) => {
      state = state.apply(tr);
    });
    state = state.apply(state.tr.insertText('A'));

    const text = state.doc.firstChild?.firstChild;
    const markNames = text?.marks.map((mark) => mark.type.name).sort();

    expect(isPendingMarkActive(state, schema.marks.strikethrough)).toBe(true);
    expect(isPendingMarkActive(state, schema.marks.strong)).toBe(true);
    expect(markNames).toEqual(['strikethrough', 'strong']);
  });

  it('adds a new pending mark without dropping the mark already being typed', () => {
    const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
    let state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 1),
      plugins: [pendingInlineMarkPlugin()],
    });

    toggleMarkPending(schema.marks.strikethrough)(state, (tr) => {
      state = state.apply(tr);
    });
    state = state.apply(state.tr.insertText('A'));
    toggleMarkPending(schema.marks.strong)(state, (tr) => {
      state = state.apply(tr);
    });
    state = state.apply(state.tr.insertText('B'));

    const first = state.doc.firstChild?.child(0);
    const second = state.doc.firstChild?.child(1);

    expect(first?.text).toBe('A');
    expect(first?.marks.map((mark) => mark.type.name)).toEqual(['strikethrough']);
    expect(second?.text).toBe('B');
    expect(second?.marks.map((mark) => mark.type.name).sort()).toEqual([
      'strikethrough',
      'strong',
    ]);
  });

  it('shows delimiters for all empty pending inline marks', () => {
    const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
        plugins: [pendingInlineMarkPlugin()],
      }),
    });

    toggleMarkPending(schema.marks.strikethrough)(view.state, view.dispatch);
    toggleMarkPending(schema.marks.strong)(view.state, view.dispatch);

    expect(getDelimiterTexts(target)).toEqual(['~~**', '**~~']);

    view.destroy();
    target.remove();
  });

  it('uses widget delimiters for empty pending edit state', () => {
    const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
        plugins: [pendingInlineMarkPlugin()],
      }),
    });

    toggleMarkPending(schema.marks.strong)(view.state, view.dispatch);

    expect(getDelimiterTexts(target)).toEqual(['**', '**']);

    view.destroy();
    target.remove();
  });

  it('uses standard mark toggling when text is selected', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('hello')),
    ]);
    let state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 1, 6),
      plugins: [pendingInlineMarkPlugin()],
    });

    toggleMarkPending(schema.marks.em)(state, (tr) => {
      state = state.apply(tr);
    });

    const text = state.doc.firstChild?.firstChild;
    expect(isPendingMarkActive(state, schema.marks.em)).toBe(false);
    expect(text?.marks.some((mark) => mark.type === schema.marks.em)).toBe(true);
  });

  it('exits pending when the cursor moves to another block', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(),
    ]);
    let state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 1),
      plugins: [pendingInlineMarkPlugin()],
    });

    toggleMarkPending(schema.marks.underline)(state, (tr) => {
      state = state.apply(tr);
    });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 3)));

    expect(isPendingMarkActive(state, schema.marks.underline)).toBe(false);
  });

  it('shows edit delimiters when the cursor enters an existing mark range', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, [
        schema.text('before '),
        schema.text('bold', [schema.marks.strong.create()]),
        schema.text(' after'),
      ]),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 9),
        plugins: [pendingInlineMarkPlugin()],
      }),
    });

    expect(getEditRangeSyntax(target)).toEqual([{ open: '**', close: '**' }]);

    view.destroy();
    target.remove();
  });

  it('shows edit delimiters for every mark on the same text range', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, [
        schema.text('both', [schema.marks.strikethrough.create(), schema.marks.strong.create()]),
      ]),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 3),
        plugins: [pendingInlineMarkPlugin()],
      }),
    });

    expect(getEditRangeSyntax(target)).toEqual([{ open: '**~~', close: '~~**' }]);

    view.destroy();
    target.remove();
  });

  it('treats both edges of an existing mark range as edit state', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, [
        schema.text('before '),
        schema.text('bold', [schema.marks.strong.create()]),
        schema.text(' after'),
      ]),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 8),
        plugins: [pendingInlineMarkPlugin()],
      }),
    });

    expect(getEditRangeSyntax(target)).toEqual([{ open: '**', close: '**' }]);

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 12)));
    expect(getEditRangeSyntax(target)).toEqual([{ open: '**', close: '**' }]);

    view.destroy();
    target.remove();
  });

  it('places the cursor inside the mark when clicking the opening edit delimiter', () => {
    const { target, view } = createMarkedTextView(9);
    const range = target.querySelector<HTMLElement>('.pm-inline-mark-edit-range')!;
    mockRangeRect(range, { left: 100, right: 180 });

    range.dispatchEvent(createMouseDown(104, 10));

    expect(view.state.selection.from).toBe(8);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).toBe(true);

    view.destroy();
    target.remove();
  });

  it('places the cursor outside the mark when clicking the closing edit delimiter', () => {
    const { target, view } = createMarkedTextView(9);
    const range = target.querySelector<HTMLElement>('.pm-inline-mark-edit-range')!;
    mockRangeRect(range, { left: 100, right: 180 });

    range.dispatchEvent(createMouseDown(176, 10));

    expect(view.state.selection.from).toBe(12);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).not.toBe(
      true,
    );

    view.destroy();
    target.remove();
  });

  it('uses coordinates when boundary clicks target the editor root', () => {
    const { target, view } = createMarkedTextView(9);
    const range = target.querySelector<HTMLElement>('.pm-inline-mark-edit-range')!;
    mockRangeRect(range, { left: 100, right: 180 });

    view.dom.dispatchEvent(createMouseDown(184, 10));

    expect(view.state.selection.from).toBe(12);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).not.toBe(
      true,
    );

    view.dom.dispatchEvent(createMouseDown(96, 10));

    expect(view.state.selection.from).toBe(8);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).toBe(true);

    view.destroy();
    target.remove();
  });

  it('does not intercept clicks in the real marked text area', () => {
    const { target, view } = createMarkedTextView(9);
    const range = target.querySelector<HTMLElement>('.pm-inline-mark-edit-range')!;
    mockRangeRect(range, { left: 100, right: 180 });
    const plugin = pendingInlineMarkPlugin();

    const handled = plugin.props.handleDOMEvents?.mousedown?.call(
      plugin,
      view,
      createMouseDown(140, 10),
    );

    expect(handled).toBe(false);
    expect(view.state.storedMarks).toBeNull();

    view.destroy();
    target.remove();
  });
});

function getDelimiterTexts(target: HTMLElement): string[] {
  return Array.from(target.querySelectorAll('.pm-inline-mark-edit-delimiter')).map(
    (el) => el.textContent ?? '',
  );
}

function getEditRangeSyntax(target: HTMLElement): Array<{ open: string | null; close: string | null }> {
  return Array.from(target.querySelectorAll<HTMLElement>('.pm-inline-mark-edit-range')).map(
    (el) => ({
      open: el.getAttribute('data-open'),
      close: el.getAttribute('data-close'),
    }),
  );
}

function createMarkedTextView(selectionPos: number): { target: HTMLElement; view: EditorView } {
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, [
      schema.text('before '),
      schema.text('bold', [schema.marks.strong.create()]),
      schema.text(' after'),
    ]),
  ]);
  const target = document.createElement('div');
  document.body.appendChild(target);

  const view = new EditorView(target, {
    state: EditorState.create({
      doc,
      selection: TextSelection.create(doc, selectionPos),
      plugins: [pendingInlineMarkPlugin()],
    }),
  });

  return { target, view };
}

function mockRangeRect(element: HTMLElement, rect: { left: number; right: number }): void {
  element.getBoundingClientRect = () =>
    ({
      left: rect.left,
      right: rect.right,
      top: 0,
      bottom: 20,
      width: rect.right - rect.left,
      height: 20,
      x: rect.left,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

function createMouseDown(clientX: number, clientY = 0): MouseEvent {
  return new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
}
