import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { executeEditorCommand } from './editorCommands';
import { CodeBlockNodeView } from './nodeViews/CodeBlockNodeView';
import { MathBlockNodeView } from './nodeViews/MathBlockNodeView';
import { schema } from './schema';

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
});
