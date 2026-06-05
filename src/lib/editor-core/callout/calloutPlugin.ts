/** Callout 插件：监听事务，自动消除空 callout */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

export const calloutPluginKey = new PluginKey('callout');

/**
 * 创建 callout 插件。
 * 当 callout 内容被清空（只剩一个空段落）时，自动将 callout 替换为空段落。
 */
export function createCalloutPlugin(): Plugin {
  return new Plugin({
    key: calloutPluginKey,
    appendTransaction(transactions, oldState, newState) {
      // 只在文档发生变化时检查
      const docChanged = transactions.some((tr) => tr.docChanged);
      if (!docChanged) return null;

      const calloutType = newState.schema.nodes.callout;
      if (!calloutType) return null;

      const tr = newState.tr;
      let modified = false;

      // 遍历文档查找空 callout
      newState.doc.descendants((node: ProseMirrorNode, pos: number) => {
        if (node.type !== calloutType) return;

        const oldNode = oldState.doc.nodeAt(pos);
        // 步骤1：工具栏新建的 callout 本身就是空段落，不能在同一事务里立刻清掉。
        if (
          isEmptyCallout(node) &&
          oldNode?.type === calloutType &&
          !isEmptyCallout(oldNode)
        ) {
          // 步骤2：只有“原本有内容，后来被清空”的 callout 才自动还原成普通段落。
          const emptyPara = newState.schema.nodes.paragraph.create();
          tr.replaceWith(pos, pos + node.nodeSize, emptyPara);
          modified = true;
          return false; // 停止遍历
        }

        return true; // 继续遍历子节点
      });

      return modified ? tr : null;
    },
  });
}

function isEmptyCallout(node: ProseMirrorNode): boolean {
  if (node.childCount !== 1) return false;
  const firstChild = node.firstChild;
  return firstChild?.type.name === 'paragraph' && firstChild.content.size === 0;
}
