import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import { schema } from '../schema';

/**
 * trailingParagraph 插件 —— 为新增的顶层非段落块补充后续输入位置
 *
 * 当代码块、公式块、表格等顶层非段落块被插入后，
 * 如果其后方不是 paragraph，自动紧跟追加一个空段落，防止光标无法移到该块下方。
 */
export const trailingParagraphKey = new PluginKey('trailingParagraph');

const TRAILING_PARAGRAPH_NODE_TYPES = new Set([
  'code_block',
  'math_block',
  'mermaid_block',
  'table',
  'image',
  'horizontal_rule',
  'html_block',
  'comment_block',
  'footnote_def',
  'toc_block',
]);

export function trailingParagraphPlugin(): Plugin {
  return new Plugin({
    key: trailingParagraphKey,
    appendTransaction(transactions, _oldState, newState) {
      // 只在文档发生变更时处理
      const docChanged = transactions.some((tr) => tr.docChanged);
      if (!docChanged) return null;

      const insertedRanges = collectInsertedRanges(transactions);
      if (insertedRanges.length === 0) return null;

      const insertPositions: number[] = [];
      newState.doc.forEach((node, offset, index) => {
        if (node.type === schema.nodes.paragraph) return;
        if (!TRAILING_PARAGRAPH_NODE_TYPES.has(node.type.name)) return;
        if (!isFullyCoveredByInsertedRange(offset, offset + node.nodeSize, insertedRanges)) return;

        const nextNode = index + 1 < newState.doc.childCount ? newState.doc.child(index + 1) : null;
        if (nextNode?.type === schema.nodes.paragraph) return;

        insertPositions.push(offset + node.nodeSize);
      });
      if (insertPositions.length === 0) return null;

      const tr = newState.tr;
      for (const pos of insertPositions.reverse()) {
        tr.insert(pos, schema.nodes.paragraph.create());
      }
      return tr;
    },
  });
}

type InsertedRange = {
  from: number;
  to: number;
};

function collectInsertedRanges(transactions: readonly Transaction[]): InsertedRange[] {
  const ranges: InsertedRange[] = [];

  for (let transactionIndex = 0; transactionIndex < transactions.length; transactionIndex += 1) {
    const transaction = transactions[transactionIndex];

    transaction.mapping.maps.forEach((stepMap, stepIndex) => {
      stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
        if (newEnd <= newStart) return;

        let from = newStart;
        let to = newEnd;

        // 步骤1：把当前 step 产生的新文档坐标映射到本轮 appendTransaction 的最终文档。
        for (let i = stepIndex + 1; i < transaction.mapping.maps.length; i += 1) {
          from = transaction.mapping.maps[i].map(from, -1);
          to = transaction.mapping.maps[i].map(to, 1);
        }
        for (let i = transactionIndex + 1; i < transactions.length; i += 1) {
          for (const map of transactions[i].mapping.maps) {
            from = map.map(from, -1);
            to = map.map(to, 1);
          }
        }

        if (to > from) {
          ranges.push({ from, to });
        }
      });
    });
  }

  return ranges;
}

function isFullyCoveredByInsertedRange(from: number, to: number, ranges: InsertedRange[]): boolean {
  return ranges.some((range) => range.from <= from && range.to >= to);
}
