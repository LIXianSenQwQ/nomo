import { describe, expect, it, vi } from 'vitest';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { parseMarkdown } from './markdown';
import { codeBlockNavigationPlugin } from './plugins/codeBlockNavigation';

type FoundNode = {
  node: ProseMirrorNode;
  pos: number;
};

function findNodes(doc: ProseMirrorNode, typeName: string): FoundNode[] {
  const nodes: FoundNode[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === typeName) {
      nodes.push({ node, pos });
    }
    return true;
  });
  return nodes;
}

function createKeyboardEvent(key: 'ArrowDown' | 'ArrowUp'): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
}

describe('codeBlockNavigationPlugin', () => {
  it('从代码块上方按下方向键会直接进入首行编辑', () => {
    const doc = parseMarkdown('上方段落\n\n```ts\nconst a = 1;\nconst b = 2;\n```\n\n下方段落');
    const paragraphs = findNodes(doc, 'paragraph');
    const codeBlock = findNodes(doc, 'code_block')[0];
    const enterEditAt = vi.fn();
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, paragraphs[0].pos + 1 + paragraphs[0].node.content.size),
        plugins: [codeBlockNavigationPlugin({ enterEditAt })]
      })
    });

    view.dom.dispatchEvent(createKeyboardEvent('ArrowDown'));

    expect(enterEditAt).toHaveBeenCalledWith(view, codeBlock.pos, 0, 'start');
    view.destroy();
    target.remove();
  });

  it('从代码块下方按上方向键会直接进入末行编辑', () => {
    const doc = parseMarkdown('上方段落\n\n```ts\nconst a = 1;\nconst b = 2;\n```\n\n下方段落');
    const paragraphs = findNodes(doc, 'paragraph');
    const codeBlock = findNodes(doc, 'code_block')[0];
    const enterEditAt = vi.fn();
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, paragraphs[1].pos + 1),
        plugins: [codeBlockNavigationPlugin({ enterEditAt })]
      })
    });

    view.dom.dispatchEvent(createKeyboardEvent('ArrowUp'));

    expect(enterEditAt).toHaveBeenCalledWith(view, codeBlock.pos, 1, 'end');
    view.destroy();
    target.remove();
  });

  it('从列表项末尾按下方向键会直接进入后面的代码块首行', () => {
    const doc = parseMarkdown('- 继续输入时文档结尾必须保留空行\n\n```ts\nconst done = true;\n```');
    const paragraph = findNodes(doc, 'paragraph')[0];
    const codeBlock = findNodes(doc, 'code_block')[0];
    const enterEditAt = vi.fn();
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, paragraph.pos + 1 + paragraph.node.content.size),
        plugins: [codeBlockNavigationPlugin({ enterEditAt })]
      })
    });

    view.dom.dispatchEvent(createKeyboardEvent('ArrowDown'));

    expect(enterEditAt).toHaveBeenCalledWith(view, codeBlock.pos, 0, 'start');
    view.destroy();
    target.remove();
  });

  it('从列表项开头按上方向键会直接进入前面的代码块末行', () => {
    const doc = parseMarkdown('```ts\nconst done = true;\n```\n\n- 继续输入时文档结尾必须保留空行');
    const paragraph = findNodes(doc, 'paragraph')[0];
    const codeBlock = findNodes(doc, 'code_block')[0];
    const enterEditAt = vi.fn();
    const target = document.createElement('div');
    document.body.appendChild(target);

    const view = new EditorView(target, {
      state: EditorState.create({
        doc,
        selection: TextSelection.create(doc, paragraph.pos + 1),
        plugins: [codeBlockNavigationPlugin({ enterEditAt })]
      })
    });

    view.dom.dispatchEvent(createKeyboardEvent('ArrowUp'));

    expect(enterEditAt).toHaveBeenCalledWith(view, codeBlock.pos, 0, 'end');
    view.destroy();
    target.remove();
  });
});
