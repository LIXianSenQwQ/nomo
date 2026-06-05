import type { MarkType, Node as ProseMirrorNode } from 'prosemirror-model';
import { Plugin, type EditorState } from 'prosemirror-state';
import { schema } from '../schema';

interface InlineMarkMatch {
  from: number;
  to: number;
  content: string;
  markerLength: number;
  markType: MarkType;
}

/**
 * 行内 Markdown 标记输入插件。
 *
 * 用户在语义模式手动输入 `**文本**`、`*文本*`、`~~文本~~` 时，
 * 将语法字符转换为真实 mark，避免保存后才由 Markdown 解析导致视觉跳变。
 */
export function inlineMarkdownMarkInputPlugin(): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;

      const matches = findInlineMarkTextMatchesNearSelection(newState);
      if (matches.length === 0) return null;

      const tr = newState.tr;

      for (const match of matches.reverse()) {
        tr.replaceWith(match.from, match.to, schema.text(match.content));
        tr.addMark(match.from, match.from + match.content.length, match.markType.create());
      }

      return tr;
    },
  });
}

function findInlineMarkTextMatchesNearSelection(state: EditorState): InlineMarkMatch[] {
  const matches: InlineMarkMatch[] = [];
  if (!state.selection.empty) return matches;

  const $cursor = state.selection.$from;
  const parent = $cursor.parent;
  if (!parent.isTextblock || parent.type === schema.nodes.code_block) return matches;

  const blockStart = $cursor.start();
  parent.descendants((node, pos) => {
    if (!node.isText || !node.text || hasCodeMark(node)) return true;

    matches.push(...scanTextForInlineMarks(node.text, blockStart + pos));
    return true;
  });

  return matches;
}

function scanTextForInlineMarks(text: string, absoluteTextPos: number): InlineMarkMatch[] {
  const matches: InlineMarkMatch[] = [];

  const underlineMatch = findUnderlineTagMatch(text);
  if (underlineMatch) {
    matches.push({
      ...underlineMatch,
      from: absoluteTextPos + underlineMatch.from,
      to: absoluteTextPos + underlineMatch.to,
      markerLength: 0,
      markType: schema.marks.underline,
    });
    return matches;
  }

  const strongMatch = findDelimitedMatch(text, '**');
  if (strongMatch) {
    matches.push({
      ...strongMatch,
      from: absoluteTextPos + strongMatch.from,
      to: absoluteTextPos + strongMatch.to,
      markerLength: 2,
      markType: schema.marks.strong,
    });
    return matches;
  }

  const strikethroughMatch = findDelimitedMatch(text, '~~');
  if (strikethroughMatch) {
    matches.push({
      ...strikethroughMatch,
      from: absoluteTextPos + strikethroughMatch.from,
      to: absoluteTextPos + strikethroughMatch.to,
      markerLength: 2,
      markType: schema.marks.strikethrough,
    });
    return matches;
  }

  const emMatch = findDelimitedMatch(text, '*');
  if (emMatch) {
    matches.push({
      ...emMatch,
      from: absoluteTextPos + emMatch.from,
      to: absoluteTextPos + emMatch.to,
      markerLength: 1,
      markType: schema.marks.em,
    });
  }

  return matches;
}

function findUnderlineTagMatch(text: string): { from: number; to: number; content: string } | null {
  const openTag = '<u>';
  const closeTag = '</u>';
  let index = 0;

  while (index < text.length) {
    const from = text.indexOf(openTag, index);
    if (from === -1) return null;
    if (isEscaped(text, from)) {
      index = from + openTag.length;
      continue;
    }

    const contentFrom = from + openTag.length;
    const close = text.indexOf(closeTag, contentFrom);
    if (close === -1) return null;
    if (isEscaped(text, close)) {
      index = close + closeTag.length;
      continue;
    }

    const content = text.slice(contentFrom, close);
    if (isValidInlineMarkContent(content)) {
      return { from, to: close + closeTag.length, content };
    }

    index = close + closeTag.length;
  }

  return null;
}

function findDelimitedMatch(
  text: string,
  delimiter: string,
): { from: number; to: number; content: string } | null {
  let index = 0;

  while (index < text.length) {
    const from = text.indexOf(delimiter, index);
    if (from === -1) return null;
    if (isEscaped(text, from) || isSingleStarInsideStrongDelimiter(text, delimiter, from)) {
      index = from + delimiter.length;
      continue;
    }

    const contentFrom = from + delimiter.length;
    const close = findClosingDelimiter(text, delimiter, contentFrom);
    if (close === -1) return null;

    const content = text.slice(contentFrom, close);
    if (isValidInlineMarkContent(content)) {
      return { from, to: close + delimiter.length, content };
    }

    index = close + delimiter.length;
  }

  return null;
}

function findClosingDelimiter(text: string, delimiter: string, from: number): number {
  let index = from;
  while (index < text.length) {
    const close = text.indexOf(delimiter, index);
    if (close === -1) return -1;
    if (!isEscaped(text, close) && !isSingleStarInsideStrongDelimiter(text, delimiter, close)) {
      return close;
    }
    index = close + delimiter.length;
  }
  return -1;
}

function isValidInlineMarkContent(content: string): boolean {
  return Boolean(content.trim());
}

function isEscaped(text: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function isSingleStarInsideStrongDelimiter(
  text: string,
  delimiter: string,
  index: number,
): boolean {
  return delimiter === '*' && (text[index - 1] === '*' || text[index + 1] === '*');
}

function hasCodeMark(node: ProseMirrorNode): boolean {
  return node.marks.some((mark) => mark.type === schema.marks.code);
}
