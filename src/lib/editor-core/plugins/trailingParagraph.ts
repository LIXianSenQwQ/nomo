import { Plugin, PluginKey } from 'prosemirror-state';
import { schema } from '../schema';

/**
 * trailingParagraph 插件 —— 保证文档末尾始终存在一个空段落
 *
 * 当文档最后一个子节点不是 paragraph 时（如代码块、公式块、表格、引用等），
 * 自动追加一个空段落，防止光标无法移到这些块的下方。
 */
export const trailingParagraphKey = new PluginKey('trailingParagraph');

export function trailingParagraphPlugin(): Plugin {
  return new Plugin({
    key: trailingParagraphKey,
    appendTransaction(transactions, _oldState, newState) {
      // 只在文档发生变更时处理
      const docChanged = transactions.some((tr) => tr.docChanged);
      if (!docChanged) return null;

      const lastChild = newState.doc.lastChild;
      if (!lastChild) return null;

      // 如果最后一个子节点不是段落，追加一个空段落
      if (lastChild.type !== schema.nodes.paragraph) {
        const tr = newState.tr.insert(newState.doc.content.size, schema.nodes.paragraph.create());
        return tr;
      }

      return null;
    },
  });
}
