import { Plugin, PluginKey } from 'prosemirror-state';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { schema } from '../schema';

/**
 * displayMathInput 插件 —— 语义模式下直接输入 $$...$$ 转换为 math_block 节点
 *
 * 监听 appendTransaction，扫描顶层 paragraph 节点中的 $$ 开头和闭合 $$，
 * 完整闭合后将段落组替换为 math_block 节点。
 * 未闭合不转换。
 */
export const displayMathInputKey = new PluginKey('displayMathInput');

export function displayMathInputPlugin(): Plugin {
  return new Plugin({
    key: displayMathInputKey,
    appendTransaction(transactions, _oldState, newState) {
      // 只在文档变更时处理
      const docChanged = transactions.some((tr) => tr.docChanged);
      if (!docChanged) return null;

      // 扫描顶层节点，收集需要替换的 $$...$$ 区间
      const replacements: Array<{ from: number; to: number; tex: string }> = [];
      const topBlocks: Array<{ node: ProseMirrorNode; pos: number }> = [];
      newState.doc.forEach((node, offset) => {
        topBlocks.push({ node, pos: offset });
      });

      let i = 0;
      while (i < topBlocks.length) {
        const result = tryMatchDisplayMath(topBlocks, i);
        if (result) {
          replacements.push(result.replacement);
          i = result.nextIndex;
        } else {
          i++;
        }
      }

      if (replacements.length === 0) return null;

      // 从后往前替换，避免位置偏移
      let tr = newState.tr;
      for (let r = replacements.length - 1; r >= 0; r--) {
        const { from, to, tex } = replacements[r];
        const mathNode = schema.nodes.math_block.create({ tex });
        tr = tr.replaceWith(from, to, mathNode);
      }
      return tr;
    },
  });
}

/**
 * 尝试从 startIndex 开始匹配 $$...$$ 模式
 * 返回替换区间和下一个待检查的索引
 */
function tryMatchDisplayMath(
  blocks: Array<{ node: ProseMirrorNode; pos: number }>,
  startIndex: number,
): { replacement: { from: number; to: number; tex: string }; nextIndex: number } | null {
  const first = blocks[startIndex];

  // 必须是 paragraph 节点
  if (first.node.type.name !== 'paragraph') return null;

  // 检查是否在代码块、表格等内部（通过父节点判断）
  // 顶层节点不会有这个问题，但以防万一

  const firstText = first.node.textContent.trim();

  // 单段文本 $$...$$ 形式。粘贴多行空公式块时，换行可能仍保留在同一段文本中。
  if (firstText.startsWith('$$') && firstText.endsWith('$$') && firstText.length >= 4) {
    const tex = firstText.slice(2, -2).trim();
    if (tex || firstText.includes('\n')) {
      return {
        replacement: {
          from: first.pos,
          to: first.pos + first.node.nodeSize,
          tex,
        },
        nextIndex: startIndex + 1,
      };
    }
  }

  // 多行 $$ 形式：第一行是 $$，往下找闭合 $$
  if (firstText !== '$$') return null;

  const texLines: string[] = [];
  let foundClose = false;
  let closeIndex = startIndex + 1;

  for (let index = startIndex + 1; index < blocks.length; index++) {
    const block = blocks[index];
    if (block.node.type.name !== 'paragraph') break;
    const text = block.node.textContent.trim();
    if (text === '$$') {
      foundClose = true;
      closeIndex = index;
      break;
    }
    texLines.push(block.node.textContent);
  }

  if (!foundClose) return null;

  const tex = texLines.join('\n').trim();

  const from = blocks[startIndex].pos;
  const to = blocks[closeIndex].pos + blocks[closeIndex].node.nodeSize;

  return {
    replacement: { from, to, tex },
    nextIndex: closeIndex + 1,
  };
}
