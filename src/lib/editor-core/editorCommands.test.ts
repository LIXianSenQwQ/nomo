import { describe, expect, it } from 'vitest';
import { EditorState, NodeSelection, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { executeEditorCommand } from './editorCommands';
import { CodeBlockNodeView } from './nodeViews/CodeBlockNodeView';
import { MathBlockNodeView } from './nodeViews/MathBlockNodeView';
import { schema } from './schema';
import { createTableNode } from './tableCommands';

describe('editorCommands', () => {
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
});
