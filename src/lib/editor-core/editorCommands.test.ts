import { describe, expect, it } from 'vitest';
import type { Node as PmNode } from 'prosemirror-model';
import { EditorState, NodeSelection, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { TableMap } from 'prosemirror-tables';
import { executeEditorCommand } from './editorCommands';
import { parseMarkdown, serializeMarkdown } from './markdown';
import { CodeBlockNodeView } from './nodeViews/CodeBlockNodeView';
import { FootnoteDefNodeView } from './nodeViews/FootnoteDefNodeView';
import { FootnoteRefNodeView } from './nodeViews/FootnoteRefNodeView';
import { MathBlockNodeView } from './nodeViews/MathBlockNodeView';
import { trailingParagraphPlugin } from './plugins/trailingParagraph';
import { setCodeBlockMathRenderer } from './renderers';
import { schema } from './schema';
import { createTableNode } from './tableCommands';

function createMarkdownCommandView(
  markdown: string,
  createSelection: (doc: PmNode) => TextSelection | NodeSelection,
): EditorView {
  const doc = parseMarkdown(markdown);
  const target = document.createElement('div');
  document.body.appendChild(target);

  return new EditorView(target, {
    state: EditorState.create({
      doc,
      selection: createSelection(doc),
    }),
  });
}

function paragraphContentSelection(doc: PmNode): TextSelection {
  return TextSelection.create(doc, 1, doc.child(0).nodeSize - 1);
}

function runClearInlineStyles(view: EditorView): boolean {
  return executeEditorCommand({ type: 'clearInlineStyles' }, view, '', () => undefined);
}

function currentMarkdown(view: EditorView): string {
  return serializeMarkdown(view.state.doc).trim();
}

function destroyView(view: EditorView): void {
  view.dom.parentElement?.remove();
  view.destroy();
}

describe('editorCommands', () => {
  it('清除选区内的加粗样式', () => {
    const view = createMarkdownCommandView('**文字**', paragraphContentSelection);

    expect(runClearInlineStyles(view)).toBe(true);
    expect(currentMarkdown(view)).toBe('文字');

    destroyView(view);
  });

  it('清除选区内的混合行内样式', () => {
    const view = createMarkdownCommandView(
      '**粗体** *斜体* ~~删除~~ <u>下划线</u> <mark>高亮</mark>',
      paragraphContentSelection,
    );

    expect(runClearInlineStyles(view)).toBe(true);
    expect(currentMarkdown(view)).toBe('粗体 斜体 删除 下划线 高亮');

    destroyView(view);
  });

  it('选中文本切换高亮样式', () => {
    const view = createMarkdownCommandView('重点', paragraphContentSelection);

    expect(executeEditorCommand({ type: 'toggleHighlight' }, view, '', () => undefined)).toBe(true);
    expect(currentMarkdown(view)).toBe('<mark>重点</mark>');

    destroyView(view);
  });

  it('清除链接样式并保留链接文字', () => {
    const view = createMarkdownCommandView(
      '[链接](https://example.com)',
      paragraphContentSelection,
    );

    expect(runClearInlineStyles(view)).toBe(true);
    expect(currentMarkdown(view)).toBe('链接');

    destroyView(view);
  });

  it('选中文本执行超链接命令后写入 Markdown link mark', () => {
    const view = createMarkdownCommandView('链接文字', paragraphContentSelection);

    expect(
      executeEditorCommand(
        { type: 'insertLink', href: 'https://example.com', title: '说明' },
        view,
        '',
        () => undefined,
      ),
    ).toBe(true);
    expect(currentMarkdown(view)).toBe('[链接文字](https://example.com "说明")');

    destroyView(view);
  });

  it('光标位于已有超链接内时更新整段链接属性', () => {
    const view = createMarkdownCommandView('[旧链接](https://old.example)', (doc) =>
      TextSelection.create(doc, 2),
    );

    expect(
      executeEditorCommand(
        { type: 'insertLink', href: 'https://new.example', title: '新说明' },
        view,
        '',
        () => undefined,
      ),
    ).toBe(true);
    expect(currentMarkdown(view)).toBe('[旧链接](https://new.example "新说明")');

    destroyView(view);
  });

  it('无选区执行超链接命令时插入链接文字', () => {
    const view = createMarkdownCommandView('', (doc) => TextSelection.create(doc, 1));

    expect(
      executeEditorCommand(
        { type: 'insertLink', href: 'https://example.com', text: '官网' },
        view,
        '',
        () => undefined,
      ),
    ).toBe(true);
    expect(currentMarkdown(view)).toBe('[官网](https://example.com)');

    destroyView(view);
  });

  it('移除当前超链接时只保留链接文字', () => {
    const view = createMarkdownCommandView('[链接](https://example.com)', (doc) =>
      TextSelection.create(doc, 2),
    );

    expect(executeEditorCommand({ type: 'removeLink' }, view, '', () => undefined)).toBe(true);
    expect(currentMarkdown(view)).toBe('链接');

    destroyView(view);
  });

  it('清除行内代码节点并保留代码文本', () => {
    const view = createMarkdownCommandView('`code`', (doc) => TextSelection.create(doc, 1, 2));

    expect(runClearInlineStyles(view)).toBe(true);
    expect(currentMarkdown(view)).toBe('code');

    destroyView(view);
  });

  it('清除行内公式节点并保留公式文本', () => {
    const view = createMarkdownCommandView('$x+1$', (doc) => TextSelection.create(doc, 1, 2));

    expect(runClearInlineStyles(view)).toBe(true);
    expect(currentMarkdown(view)).toBe('x+1');

    destroyView(view);
  });

  it('光标位于加粗文字内部时清除整段连续加粗样式', () => {
    const view = createMarkdownCommandView('**粗体**', (doc) => TextSelection.create(doc, 2));

    expect(runClearInlineStyles(view)).toBe(true);
    expect(currentMarkdown(view)).toBe('粗体');

    destroyView(view);
  });

  it('光标贴近行内原子节点边界时清除相邻节点', () => {
    const codeView = createMarkdownCommandView('`code`', (doc) => TextSelection.create(doc, 1));
    const mathView = createMarkdownCommandView('$x+1$', (doc) => TextSelection.create(doc, 2));

    expect(runClearInlineStyles(codeView)).toBe(true);
    expect(currentMarkdown(codeView)).toBe('code');
    expect(runClearInlineStyles(mathView)).toBe(true);
    expect(currentMarkdown(mathView)).toBe('x+1');

    destroyView(codeView);
    destroyView(mathView);
  });

  it('光标位于普通文本时不产生清除样式事务', () => {
    const view = createMarkdownCommandView('普通文本', (doc) => TextSelection.create(doc, 2));

    expect(runClearInlineStyles(view)).toBe(false);
    expect(currentMarkdown(view)).toBe('普通文本');

    destroyView(view);
  });

  it('在紧贴旧代码块上方新建代码块时，只让新代码块进入编辑态', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(),
      schema.nodes.code_block.create({ params: 'ts' }, schema.text('old')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
      }),
      nodeViews: {
        code_block: (node, view, getPos) =>
          new CodeBlockNodeView(node, view, getPos as () => number),
      },
    });

    executeEditorCommand({ type: 'insertCodeBlock', language: 'ts' }, view, '', () => undefined);

    const codeBlocks = Array.from(target.querySelectorAll<HTMLElement>('.code-card'));
    const editingBlocks = codeBlocks.filter((block) => block.classList.contains('is-editing'));

    expect(codeBlocks).toHaveLength(2);
    expect(editingBlocks).toHaveLength(1);
    expect(editingBlocks[0]).toBe(codeBlocks[0]);
    expect(codeBlocks[1].textContent).toContain('old');

    view.destroy();
    target.remove();
  });

  it('新建空公式块时立即进入编辑态', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(),
      schema.nodes.math_block.create({ tex: 'old' }),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
      }),
      nodeViews: {
        math_block: (node, view, getPos) =>
          new MathBlockNodeView(node, view, getPos as () => number),
      },
    });

    executeEditorCommand({ type: 'insertMathBlock', tex: '' }, view, '', () => undefined);

    const mathBlocks = Array.from(target.querySelectorAll<HTMLElement>('.math-block'));
    const editingBlocks = mathBlocks.filter((block) => block.classList.contains('is-editing'));

    expect(mathBlocks).toHaveLength(2);
    expect(editingBlocks).toHaveLength(1);
    expect(editingBlocks[0]).toBe(mathBlocks[0]);
    expect(editingBlocks[0].querySelector('.math-block-textarea')).not.toBeNull();

    view.destroy();
    target.remove();
  });

  it('选中文本插入公式块后立即进入公式块编辑态', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('E = mc^2')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1, 9),
      }),
      nodeViews: {
        math_block: (node, view, getPos) =>
          new MathBlockNodeView(node, view, getPos as () => number),
      },
    });

    executeEditorCommand({ type: 'insertMathBlock', tex: '' }, view, '', () => undefined);

    const textarea = target.querySelector<HTMLTextAreaElement>('.math-block-textarea');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(textarea).not.toBeNull();
    expect(textarea!.value).toBe('E = mc^2');

    view.destroy();
    target.remove();
  });

  it('公式异步渲染返回后不覆盖已进入编辑态的 textarea', async () => {
    setCodeBlockMathRenderer({
      async render(tex) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { html: `<span>${tex}</span>` };
      },
    });

    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('E = mc^2')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1, 9),
      }),
      nodeViews: {
        math_block: (node, view, getPos) =>
          new MathBlockNodeView(node, view, getPos as () => number),
      },
    });

    executeEditorCommand({ type: 'insertMathBlock', tex: '' }, view, '', () => undefined);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const mathBlock = target.querySelector<HTMLElement>('.math-block');
    const textarea = target.querySelector<HTMLTextAreaElement>('.math-block-textarea');
    expect(mathBlock?.classList.contains('is-editing')).toBe(true);
    expect(textarea).not.toBeNull();
    expect(textarea!.value).toBe('E = mc^2');

    view.destroy();
    target.remove();
  });

  it('在正文段落中插入公式块时保留正文并在下方进入编辑态', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('正文内容')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 3),
        plugins: [trailingParagraphPlugin()],
      }),
      nodeViews: {
        math_block: (node, view, getPos) =>
          new MathBlockNodeView(node, view, getPos as () => number),
      },
    });

    executeEditorCommand({ type: 'insertMathBlock', tex: '' }, view, '', () => undefined);

    expect(getTopLevelNodeNames(view.state.doc)).toEqual(['paragraph', 'math_block', 'paragraph']);
    expect(view.state.doc.child(0).textContent).toBe('正文内容');

    const mathBlock = target.querySelector<HTMLElement>('.math-block');
    const textarea = target.querySelector<HTMLTextAreaElement>('.math-block-textarea');
    expect(mathBlock?.classList.contains('is-editing')).toBe(true);
    expect(textarea).not.toBeNull();
    expect(textarea!.value).toBe('');

    view.destroy();
    target.remove();
  });

  it('键盘导航选中公式块时立即进入编辑态', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('上方')),
      schema.nodes.math_block.create({ tex: 'E = mc^2' }),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({ doc }),
      nodeViews: {
        math_block: (node, view, getPos) =>
          new MathBlockNodeView(node, view, getPos as () => number),
      },
    });
    const mathPos = doc.firstChild!.nodeSize;

    MathBlockNodeView.prepareKeyboardEntry('start');
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, mathPos)));

    expect(target.querySelector('.math-block-textarea')).not.toBeNull();

    view.destroy();
    target.remove();
  });

  it('两个空公式块之间反复选中时都立即进入编辑态', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('起点')),
      schema.nodes.math_block.create({ tex: '' }),
      schema.nodes.math_block.create({ tex: '' }),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({ doc }),
      nodeViews: {
        math_block: (node, view, getPos) =>
          new MathBlockNodeView(node, view, getPos as () => number),
      },
    });
    const firstPos = doc.firstChild!.nodeSize;
    const secondPos = firstPos + doc.child(1).nodeSize;

    for (const pos of [firstPos, secondPos, firstPos, secondPos]) {
      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
      const mathBlocks = Array.from(target.querySelectorAll<HTMLElement>('.math-block'));
      const selectedBlock = pos === firstPos ? mathBlocks[0] : mathBlocks[1];
      expect(selectedBlock.querySelector('.math-block-textarea')).not.toBeNull();
    }

    view.destroy();
    target.remove();
  });

  it('在紧贴旧表格上方新建表格时，光标进入新表格首个单元格', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(),
      createTableNode(1, 2),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
      }),
    });

    executeEditorCommand({ type: 'insertTable', rows: 1, columns: 2 }, view, '', () => undefined);

    const tablePositions: number[] = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'table') {
        tablePositions.push(pos);
      }
      return true;
    });

    const { $from } = view.state.selection;
    let selectedTablePos: number | null = null;
    let selectedCellIndex = -1;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name === 'table') {
        selectedTablePos = $from.before(depth);
      }
      if (
        $from.node(depth).type.name === 'table_cell' ||
        $from.node(depth).type.name === 'table_header'
      ) {
        selectedCellIndex = $from.index(depth - 1);
      }
    }

    expect(tablePositions).toHaveLength(2);
    expect(selectedTablePos).toBe(tablePositions[0]);
    expect(selectedCellIndex).toBe(0);
    expect($from.parent.type.name).toBe('paragraph');

    view.destroy();
    target.remove();
  });

  it('通过编辑命令调整当前表格尺寸', () => {
    const doc = schema.nodes.doc.create(null, [createTableNode(1, 2)]);
    const target = document.createElement('div');
    document.body.appendChild(target);
    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, findTableCellTextPosition(doc, 1, 0)),
      }),
    });

    executeEditorCommand({ type: 'resizeTable', rows: 3, columns: 4 }, view, '', () => undefined);

    const table = view.state.doc.child(0);
    expect(table.childCount).toBe(3);
    expect(table.child(0).childCount).toBe(4);

    view.destroy();
    target.remove();
  });

  it('在文档中间插入代码块时，在新代码块后补空段落', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('上方')),
      schema.nodes.paragraph.create(),
      schema.nodes.code_block.create({ params: 'ts' }, schema.text('old')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, doc.child(0).nodeSize + 1),
        plugins: [trailingParagraphPlugin()],
      }),
    });

    executeEditorCommand({ type: 'insertCodeBlock', language: 'ts' }, view, '', () => undefined);

    expect(getTopLevelNodeNames(view.state.doc)).toEqual([
      'paragraph',
      'code_block',
      'paragraph',
      'code_block',
    ]);
    expect(view.state.doc.child(3).textContent).toBe('old');

    view.destroy();
    target.remove();
  });

  it('在正文段落中插入代码块时保留正文并在下方进入编辑态', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('正文内容')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 3),
        plugins: [trailingParagraphPlugin()],
      }),
      nodeViews: {
        code_block: (node, view, getPos) =>
          new CodeBlockNodeView(node, view, getPos as () => number),
      },
    });

    executeEditorCommand({ type: 'insertCodeBlock', language: 'ts' }, view, '', () => undefined);

    expect(getTopLevelNodeNames(view.state.doc)).toEqual(['paragraph', 'code_block', 'paragraph']);
    expect(view.state.doc.child(0).textContent).toBe('正文内容');
    expect(view.state.doc.child(1).attrs.params).toBe('ts');
    expect(target.querySelector('.code-card.is-editing')).not.toBeNull();
    expect(target.querySelector('.code-input')).not.toBeNull();

    view.destroy();
    target.remove();
  });

  it('在文档底部插入代码块时，在代码块后补空段落', () => {
    const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
        plugins: [trailingParagraphPlugin()],
      }),
    });

    executeEditorCommand({ type: 'insertCodeBlock', language: 'ts' }, view, '', () => undefined);

    expect(getTopLevelNodeNames(view.state.doc)).toEqual(['code_block', 'paragraph']);

    view.destroy();
    target.remove();
  });

  it('代码块后方已有段落时，不重复追加空段落', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(null, schema.text('下方')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
        plugins: [trailingParagraphPlugin()],
      }),
    });

    executeEditorCommand({ type: 'insertCodeBlock', language: 'ts' }, view, '', () => undefined);

    expect(getTopLevelNodeNames(view.state.doc)).toEqual(['code_block', 'paragraph']);
    expect(view.state.doc.child(1).textContent).toBe('下方');

    view.destroy();
    target.remove();
  });

  it('段落按 + 应变为 H1', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('测试')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
      }),
    });

    const result = executeEditorCommand(
      { type: 'increaseHeadingLevel' },
      view,
      '',
      () => undefined,
    );

    expect(result).toBe(true);
    expect(view.state.doc.child(0).type.name).toBe('heading');
    expect(view.state.doc.child(0).attrs.level).toBe(1);

    view.destroy();
    target.remove();
  });

  it('H1 按 + 应保持 H1 不变', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.heading.create({ level: 1 }, schema.text('标题')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
      }),
    });

    const result = executeEditorCommand(
      { type: 'increaseHeadingLevel' },
      view,
      '',
      () => undefined,
    );

    expect(result).toBe(false);
    expect(view.state.doc.child(0).attrs.level).toBe(1);

    view.destroy();
    target.remove();
  });

  it('H3 按 + 应变为 H2', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.heading.create({ level: 3 }, schema.text('标题')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
      }),
    });

    const result = executeEditorCommand(
      { type: 'increaseHeadingLevel' },
      view,
      '',
      () => undefined,
    );

    expect(result).toBe(true);
    expect(view.state.doc.child(0).attrs.level).toBe(2);

    view.destroy();
    target.remove();
  });

  it('H1 按 - 应变为 H2', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.heading.create({ level: 1 }, schema.text('标题')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
      }),
    });

    const result = executeEditorCommand(
      { type: 'decreaseHeadingLevel' },
      view,
      '',
      () => undefined,
    );

    expect(result).toBe(true);
    expect(view.state.doc.child(0).type.name).toBe('heading');
    expect(view.state.doc.child(0).attrs.level).toBe(2);

    view.destroy();
    target.remove();
  });

  it('H6 按 - 应保持 H6 不变', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.heading.create({ level: 6 }, schema.text('标题')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
      }),
    });

    const result = executeEditorCommand(
      { type: 'decreaseHeadingLevel' },
      view,
      '',
      () => undefined,
    );

    expect(result).toBe(false);
    expect(view.state.doc.child(0).attrs.level).toBe(6);

    view.destroy();
    target.remove();
  });

  it('段落按 - 应不处理', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('测试')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
      }),
    });

    const result = executeEditorCommand(
      { type: 'decreaseHeadingLevel' },
      view,
      '',
      () => undefined,
    );

    expect(result).toBe(false);
    expect(view.state.doc.child(0).type.name).toBe('paragraph');

    view.destroy();
    target.remove();
  });

  it('插入公式块和表格时，同样在非段落块后补空段落', () => {
    const mathDoc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
    const mathTarget = document.createElement('div');
    document.body.appendChild(mathTarget);
    const mathView = new EditorView(mathTarget, {
      state: EditorState.create({
        doc: mathDoc,
        selection: TextSelection.create(mathDoc, 1),
        plugins: [trailingParagraphPlugin()],
      }),
    });

    executeEditorCommand({ type: 'insertMathBlock', tex: '' }, mathView, '', () => undefined);
    expect(getTopLevelNodeNames(mathView.state.doc)).toEqual(['math_block', 'paragraph']);
    expect(mathView.state.selection).toBeInstanceOf(NodeSelection);

    const tableDoc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);
    const tableTarget = document.createElement('div');
    document.body.appendChild(tableTarget);
    const tableView = new EditorView(tableTarget, {
      state: EditorState.create({
        doc: tableDoc,
        selection: TextSelection.create(tableDoc, 1),
        plugins: [trailingParagraphPlugin()],
      }),
    });

    executeEditorCommand(
      { type: 'insertTable', rows: 1, columns: 2 },
      tableView,
      '',
      () => undefined,
    );
    expect(getTopLevelNodeNames(tableView.state.doc)).toEqual(['table', 'paragraph']);
    expect(tableView.state.selection.$from.parent.type.name).toBe('paragraph');

    mathView.destroy();
    mathTarget.remove();
    tableView.destroy();
    tableTarget.remove();
  });

  it('插入脚注时生成正文引用和底部定义，并把光标移入定义内容', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('正文')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 3),
      }),
    });

    executeEditorCommand({ type: 'insertFootnote' }, view, '', () => undefined);

    expect(getTopLevelNodeNames(view.state.doc)).toEqual(['paragraph', 'footnote_def']);
    expect(view.state.doc.child(0).child(1).type.name).toBe('footnote_ref');
    expect(view.state.doc.child(0).child(1).attrs.id).toBe('1');
    expect(view.state.doc.child(1).attrs.id).toBe('1');
    expect(view.state.selection.$from.parent.type.name).toBe('footnote_def');

    view.destroy();
    target.remove();
  });

  it('插入脚注时按已有数字 id 递增，且忽略非数字 id', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, [
        schema.text('正文'),
        schema.nodes.footnote_ref.create({ id: 'note' }),
        schema.nodes.footnote_ref.create({ id: '2' }),
      ]),
      schema.nodes.footnote_def.create({ id: 'note' }, schema.text('非数字')),
      schema.nodes.footnote_def.create({ id: '2' }, schema.text('第二条')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, 1),
      }),
    });

    executeEditorCommand({ type: 'insertFootnote' }, view, '', () => undefined);

    const lastNode = view.state.doc.child(view.state.doc.childCount - 1);
    expect(lastNode.type.name).toBe('footnote_def');
    expect(lastNode.attrs.id).toBe('3');

    view.destroy();
    target.remove();
  });

  it('正文脚注引用点击后跳到底部定义', () => {
    const doc = createFootnoteDoc();
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({ doc }),
      nodeViews: {
        footnote_ref: (node, view) => new FootnoteRefNodeView(node, view),
        footnote_def: (node, view) => new FootnoteDefNodeView(node, view),
      },
    });

    target.querySelector<HTMLElement>('.footnote-ref')!.click();

    expect(view.state.selection.$from.parent.type.name).toBe('footnote_def');

    view.destroy();
    target.remove();
  });

  it('底部脚注定义点击标记后跳回首个正文引用', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, [
        schema.text('第一处'),
        schema.nodes.footnote_ref.create({ id: '1' }),
      ]),
      schema.nodes.paragraph.create(null, [
        schema.text('第二处'),
        schema.nodes.footnote_ref.create({ id: '1' }),
      ]),
      schema.nodes.footnote_def.create({ id: '1' }, schema.text('说明')),
    ]);
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({ doc }),
      nodeViews: {
        footnote_ref: (node, view) => new FootnoteRefNodeView(node, view),
        footnote_def: (node, view) => new FootnoteDefNodeView(node, view),
      },
    });

    target.querySelector<HTMLElement>('.footnote-def-marker')!.click();

    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe('第一处'.length + 2);

    view.destroy();
    target.remove();
  });

  it('正文脚注引用 hover 时显示脚注内容预览', async () => {
    const doc = createFootnoteDoc();
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({ doc }),
      nodeViews: {
        footnote_ref: (node, view) => new FootnoteRefNodeView(node, view),
        footnote_def: (node, view) => new FootnoteDefNodeView(node, view),
      },
    });

    target
      .querySelector<HTMLElement>('.footnote-ref')!
      .dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const preview = document.body.querySelector<HTMLElement>('.footnote-preview');
    expect(preview).not.toBeNull();
    expect(preview!.textContent).toContain('脚注说明');

    view.destroy();
    target.remove();
  });
});

function getTopLevelNodeNames(doc: PmNode): string[] {
  const names: string[] = [];
  doc.forEach((node) => names.push(node.type.name));
  return names;
}

function findTableCellTextPosition(doc: PmNode, rowIndex: number, columnIndex: number): number {
  const table = doc.child(0);
  const tableStart = 1;
  const map = TableMap.get(table);
  return tableStart + map.positionAt(rowIndex, columnIndex, table) + 2;
}

function createFootnoteDoc(): PmNode {
  return schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, [
      schema.text('正文'),
      schema.nodes.footnote_ref.create({ id: '1' }),
    ]),
    schema.nodes.footnote_def.create({ id: '1' }, schema.text('脚注说明')),
  ]);
}
