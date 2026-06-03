import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { schema } from '../schema';
import { InlineCodeNodeView } from '../nodeViews/InlineCodeNodeView';

interface InlineCodeMatch {
  from: number;
  to: number;
  code: string;
  isNew?: boolean; // 标记是否是新创建的行内代码
}

/**
 * 行内代码输入插件：
 * 监听文档变化，将用户输入的 `code` 文本转换为 inline_code 节点
 * 参考 mathInlineInputPlugin 的实现模式
 */
export function inlineCodeInputPlugin(): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) {
        return null;
      }

      const matches = findInlineCodeTextMatches(newState.doc);
      if (matches.length === 0) {
        return null;
      }

      const tr = newState.tr;
      let newMatchPos: number | null = null;

      for (const match of matches.reverse()) {
        tr.replaceWith(match.from, match.to, schema.nodes.inline_code.create({ code: match.code }));
        if (match.isNew) {
          newMatchPos = match.from;
        }
      }

      // 如果有新创建的行内代码，触发立即编辑
      if (newMatchPos !== null) {
        InlineCodeNodeView.requestInstantEdit();
      }

      return tr;
    },
  });
}

/**
 * 扫描文档中的文本节点，查找 `code` 模式
 * 跳过 code_block 和已有的 inline_code 节点
 */
function findInlineCodeTextMatches(doc: ProseMirrorNode): InlineCodeMatch[] {
  const matches: InlineCodeMatch[] = [];

  doc.descendants((node, pos, parent) => {
    // 跳过代码块
    if (node.type === schema.nodes.code_block) {
      return false;
    }

    // 跳过非文本节点和已有 code mark 的文本
    if (!node.isText || !node.text || hasCodeMark(node)) {
      return true;
    }

    // 跳过代码块内的文本
    if (parent?.type === schema.nodes.code_block) {
      return false;
    }

    for (const match of scanTextForInlineCode(node.text, pos)) {
      matches.push(match);
    }
    return true;
  });

  return matches;
}

/**
 * 在文本中扫描 `code` 模式
 * 支持单反引号 `code` 和双反引号 `` code ``
 */
function scanTextForInlineCode(text: string, absoluteTextPos: number): InlineCodeMatch[] {
  const matches: InlineCodeMatch[] = [];
  let index = 0;

  while (index < text.length) {
    const start = text.indexOf('`', index);
    if (start === -1) break;

    // 跳过转义的反引号
    if (isEscapedBacktick(text, start)) {
      index = start + 1;
      continue;
    }

    // 检查是否是双反引号
    const isDoubleBacktick = start + 1 < text.length && text[start + 1] === '`';

    if (isDoubleBacktick) {
      // 双反引号模式：`` code ``
      const end = findClosingDoubleBacktick(text, start + 2);
      if (end === -1) {
        index = start + 1;
        continue;
      }

      const code = text.slice(start + 2, end);
      if (isValidInlineCode(code)) {
        matches.push({
          from: absoluteTextPos + start,
          to: absoluteTextPos + end + 2,
          code: code.trim(),
          isNew: true,
        });
      }
      index = end + 2;
    } else {
      // 单反引号模式：`code`
      const end = findClosingBacktick(text, start + 1);
      if (end === -1) {
        index = start + 1;
        continue;
      }

      const code = text.slice(start + 1, end);
      if (isValidInlineCode(code)) {
        matches.push({
          from: absoluteTextPos + start,
          to: absoluteTextPos + end + 1,
          code: code.trim(),
          isNew: true,
        });
      }
      index = end + 1;
    }
  }

  return matches;
}

/** 查找闭合的单反引号 */
function findClosingBacktick(text: string, from: number): number {
  for (let index = from; index < text.length; index++) {
    if (text[index] !== '`') continue;
    if (!isEscapedBacktick(text, index)) {
      return index;
    }
  }
  return -1;
}

/** 查找闭合的双反引号 */
function findClosingDoubleBacktick(text: string, from: number): number {
  for (let index = from; index < text.length - 1; index++) {
    if (text[index] === '`' && text[index + 1] === '`') {
      return index;
    }
  }
  return -1;
}

/** 检查反引号是否被转义 */
function isEscapedBacktick(text: string, backtickIndex: number): boolean {
  let slashCount = 0;
  for (let index = backtickIndex - 1; index >= 0 && text[index] === '\\'; index--) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

/** 验证行内代码内容是否有效 */
function isValidInlineCode(code: string): boolean {
  return Boolean(code.trim());
}

/** 检查文本节点是否有 code mark */
function hasCodeMark(node: ProseMirrorNode): boolean {
  return node.marks.some((mark) => mark.type === schema.marks.code);
}
