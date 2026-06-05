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
    expect(second?.marks.map((mark) => mark.type.name).sort()).toEqual(['strikethrough', 'strong']);
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

    // 验证两种 mark 类型的语法提示都存在
    expect(hasMarkDelimiter(target, 'strikethrough')).toBe(true);
    expect(hasMarkDelimiter(target, 'strong')).toBe(true);

    view.destroy();
    target.remove();
  });

  it('uses inline delimiters for empty pending edit state', () => {
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

    // 验证加粗 mark 的语法提示存在
    expect(hasMarkDelimiter(target, 'strong')).toBe(true);

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

  it('turns off an existing mark at its opening boundary instead of creating nested pending marks', () => {
    const { target, view } = createMarkedTextView(8);
    view.dispatch(view.state.tr.setStoredMarks([schema.marks.strong.create()]));

    toggleMarkPending(schema.marks.strong)(view.state, view.dispatch);

    expect(isPendingMarkActive(view.state, schema.marks.strong)).toBe(false);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).not.toBe(
      true,
    );
    expect(hasTextMark(view.state, 'strong')).toBe(false);
    expect(target.querySelectorAll('.pm-mark-delimiter-widget')).toHaveLength(0);

    view.destroy();
    target.remove();
  });

  it('turns off an existing mark in marked text instead of creating nested pending marks', () => {
    const { target, view } = createMarkedTextView(9);

    toggleMarkPending(schema.marks.strong)(view.state, view.dispatch);

    expect(isPendingMarkActive(view.state, schema.marks.strong)).toBe(false);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).not.toBe(
      true,
    );
    expect(hasTextMark(view.state, 'strong')).toBe(false);
    expect(target.querySelectorAll('.pm-mark-delimiter-widget')).toHaveLength(0);

    view.destroy();
    target.remove();
  });

  it('turns off an existing mark at its closing boundary instead of creating nested pending marks', () => {
    const { target, view } = createMarkedTextView(12);
    view.dispatch(view.state.tr.setStoredMarks([schema.marks.strong.create()]));

    toggleMarkPending(schema.marks.strong)(view.state, view.dispatch);

    expect(isPendingMarkActive(view.state, schema.marks.strong)).toBe(false);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).not.toBe(
      true,
    );
    expect(hasTextMark(view.state, 'strong')).toBe(false);
    expect(target.querySelectorAll('.pm-mark-delimiter-widget')).toHaveLength(0);

    view.destroy();
    target.remove();
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

    // 验证加粗 mark 的语法提示存在
    expect(hasMarkDelimiter(target, 'strong')).toBe(true);

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

    // 验证两种 mark 类型的语法提示都存在
    expect(hasMarkDelimiter(target, 'strong')).toBe(true);
    expect(hasMarkDelimiter(target, 'strikethrough')).toBe(true);

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

    // 验证在 mark 范围开头时语法提示存在
    expect(hasMarkDelimiter(target, 'strong')).toBe(true);

    // 移动光标到 mark 范围结尾
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 12)));
    // 验证在 mark 范围结尾时语法提示仍然存在
    expect(hasMarkDelimiter(target, 'strong')).toBe(true);

    view.destroy();
    target.remove();
  });

  it('places the cursor outside the mark when clicking before the opening edit delimiter midpoint', () => {
    const { target, view } = createMarkedTextView(9);
    const openWidget = getDelimiterWidget(target, 'open');
    mockRangeRect(openWidget, { left: 100, right: 116 });

    openWidget.dispatchEvent(createMouseDown(104, 10));

    expect(view.state.selection.from).toBe(8);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).not.toBe(
      true,
    );

    view.destroy();
    target.remove();
  });

  it('places the cursor inside the mark when clicking after the opening edit delimiter midpoint', () => {
    const { target, view } = createMarkedTextView(9);
    const openWidget = getDelimiterWidget(target, 'open');
    mockRangeRect(openWidget, { left: 100, right: 116 });

    openWidget.dispatchEvent(createMouseDown(112, 10));

    expect(view.state.selection.from).toBe(8);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).toBe(true);

    view.destroy();
    target.remove();
  });

  it('keeps the cursor inside the mark when clicking just after the opening edit delimiter', () => {
    const { target, view } = createMarkedTextView(9);
    const openWidget = getDelimiterWidget(target, 'open');
    mockRangeRect(openWidget, { left: 100, right: 116 });

    openWidget.dispatchEvent(createMouseDown(116, 10));

    expect(view.state.selection.from).toBe(8);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).toBe(true);

    view.destroy();
    target.remove();
  });

  it('places the cursor inside the mark when clicking before the closing edit delimiter midpoint', () => {
    const { target, view } = createMarkedTextView(9);
    const closeWidget = getDelimiterWidget(target, 'close');
    mockRangeRect(closeWidget, { left: 164, right: 180 });

    closeWidget.dispatchEvent(createMouseDown(168, 10));

    expect(view.state.selection.from).toBe(12);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).toBe(true);

    view.destroy();
    target.remove();
  });

  it('keeps the cursor inside the mark when clicking just before the closing edit delimiter', () => {
    const { target, view } = createMarkedTextView(9);
    const closeWidget = getDelimiterWidget(target, 'close');
    mockRangeRect(closeWidget, { left: 164, right: 180 });

    closeWidget.dispatchEvent(createMouseDown(164, 10));

    expect(view.state.selection.from).toBe(12);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).toBe(true);

    view.destroy();
    target.remove();
  });

  it('places the cursor outside the mark when clicking after the closing edit delimiter midpoint', () => {
    const { target, view } = createMarkedTextView(9);
    const closeWidget = getDelimiterWidget(target, 'close');
    mockRangeRect(closeWidget, { left: 164, right: 180 });

    closeWidget.dispatchEvent(createMouseDown(176, 10));

    expect(view.state.selection.from).toBe(12);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).not.toBe(
      true,
    );

    view.destroy();
    target.remove();
  });

  it('does not use editor root coordinates as a fallback for delimiter clicks', () => {
    const { target, view } = createMarkedTextView(9);
    const plugin = pendingInlineMarkPlugin();

    const handled = plugin.props.handleDOMEvents?.mousedown?.call(
      plugin,
      view,
      createMouseDown(184, 10),
    );

    expect(handled).toBe(false);
    expect(view.state.selection.from).toBe(9);

    view.destroy();
    target.remove();
  });

  it('does not intercept clicks in the real marked text area', () => {
    const { target, view } = createMarkedTextView(9);
    const plugin = pendingInlineMarkPlugin();

    const handled = plugin.props.handleDOMEvents?.mousedown?.call(
      plugin,
      view,
      createMouseDown(140, 10),
    );

    expect(handled).toBe(false);
    expect(view.state.selection.from).toBe(9);

    view.destroy();
    target.remove();
  });

  it('keeps right-arrow navigation at the opening delimiter before entering the mark', () => {
    const { target, view } = createMarkedTextView(8);
    const plugin = pendingInlineMarkPlugin();

    const handled = plugin.props.handleKeyDown?.call(plugin, view, createKeyDown('ArrowRight'));

    expect(handled).toBe(true);
    expect(view.state.selection.from).toBe(8);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).toBe(true);

    view.destroy();
    target.remove();
  });

  it('keeps left-arrow navigation at the opening delimiter before leaving the mark', () => {
    const { target, view } = createMarkedTextView(8);
    const plugin = pendingInlineMarkPlugin();
    view.dispatch(view.state.tr.setStoredMarks([schema.marks.strong.create()]));

    const handled = plugin.props.handleKeyDown?.call(plugin, view, createKeyDown('ArrowLeft'));

    expect(handled).toBe(true);
    expect(view.state.selection.from).toBe(8);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).not.toBe(
      true,
    );

    view.destroy();
    target.remove();
  });

  it('keeps right-arrow navigation at the closing delimiter before leaving the mark', () => {
    const { target, view } = createMarkedTextView(12);
    const plugin = pendingInlineMarkPlugin();
    view.dispatch(view.state.tr.setStoredMarks([schema.marks.strong.create()]));

    const handled = plugin.props.handleKeyDown?.call(plugin, view, createKeyDown('ArrowRight'));

    expect(handled).toBe(true);
    expect(view.state.selection.from).toBe(12);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).not.toBe(
      true,
    );

    view.destroy();
    target.remove();
  });

  it('keeps left-arrow navigation at the closing delimiter before entering the mark', () => {
    const { target, view } = createMarkedTextView(12);
    const plugin = pendingInlineMarkPlugin();

    const handled = plugin.props.handleKeyDown?.call(plugin, view, createKeyDown('ArrowLeft'));

    expect(handled).toBe(true);
    expect(view.state.selection.from).toBe(12);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).toBe(true);

    view.destroy();
    target.remove();
  });

  it('keeps typed text inside the mark at the closing delimiter', () => {
    const { target, view } = createMarkedTextView(12);
    view.dispatch(view.state.tr.setStoredMarks([schema.marks.strong.create()]));

    view.dispatch(view.state.tr.insertText('X'));

    expect(view.state.doc.textBetween(0, view.state.doc.content.size)).toBe('before boldX after');
    expect(hasTextMarkForText(view.state, 'X', 'strong')).toBe(true);
    expect(view.state.selection.from).toBe(13);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).toBe(true);

    view.destroy();
    target.remove();
  });

  it('keeps typed text outside the mark after the closing delimiter', () => {
    const { target, view } = createMarkedTextView(12);
    const plugin = pendingInlineMarkPlugin();

    const handled = plugin.props.handleTextInput?.call(
      plugin,
      view,
      12,
      12,
      'X',
      () => view.state.tr,
    );

    expect(handled).toBe(true);
    expect(view.state.doc.textBetween(0, view.state.doc.content.size)).toBe('before boldX after');
    expect(hasTextMarkForText(view.state, 'X', 'strong')).toBe(false);
    expect(view.state.selection.from).toBe(13);
    expect(view.state.storedMarks?.some((mark) => mark.type === schema.marks.strong)).not.toBe(
      true,
    );

    view.destroy();
    target.remove();
  });
});

/**
 * 检查是否存在指定 mark 类型的语法提示装饰。
 * 支持两种装饰模式：
 * - Decoration.inline：检查 .pm-mark-delimiter-range 标记正文范围
 * - Decoration.widget：检查 .pm-mark-delimiter-widget 显示真实占位标签
 *
 * 使用 *= (contains) 选择器，因为多 mark 叠加时 data-open 会拼接（如 "**~~"）。
 */
function hasMarkDelimiter(target: HTMLElement, markTypeName: string): boolean {
  const syntax = MARK_SYNTAX_MAP[markTypeName];
  if (!syntax) return false;

  const widgets = Array.from(target.querySelectorAll<HTMLElement>('.pm-mark-delimiter-widget'));
  return (
    widgets.some(
      (widget) =>
        (widget.textContent ?? '').includes(syntax.open) &&
        widget.dataset.edge === 'open' &&
        widget.contentEditable === 'false',
    ) &&
    widgets.some(
      (widget) =>
        (widget.textContent ?? '').includes(syntax.close) &&
        widget.dataset.edge === 'close' &&
        widget.contentEditable === 'false',
    )
  );
}

// 测试用的 mark 语法映射
const MARK_SYNTAX_MAP: Record<string, { open: string; close: string }> = {
  strong: { open: '**', close: '**' },
  em: { open: '*', close: '*' },
  strikethrough: { open: '~~', close: '~~' },
  underline: { open: '<u>', close: '</u>' },
};

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

function getDelimiterWidget(target: HTMLElement, edge: 'open' | 'close'): HTMLElement {
  const widget = target.querySelector<HTMLElement>(
    `.pm-mark-delimiter-widget[data-edge="${edge}"]`,
  );
  expect(widget).not.toBeNull();
  return widget!;
}

function hasTextMark(state: EditorState, markTypeName: string): boolean {
  let found = false;
  state.doc.descendants((node) => {
    if (found || !node.isText) return false;
    found = node.marks.some((mark) => mark.type.name === markTypeName);
    return !found;
  });
  return found;
}

function hasTextMarkForText(state: EditorState, text: string, markTypeName: string): boolean {
  let found = false;
  state.doc.descendants((node) => {
    if (found || !node.isText || !node.text?.includes(text)) return !found;
    found = node.marks.some((mark) => mark.type.name === markTypeName);
    return !found;
  });
  return found;
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

function createKeyDown(key: 'ArrowLeft' | 'ArrowRight'): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key,
  });
}
