import { textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';
import MarkdownIt from 'markdown-it';
import Token from 'markdown-it/lib/token.mjs';
import { defaultMarkdownParser, defaultMarkdownSerializer, MarkdownParser, MarkdownSerializer } from 'prosemirror-markdown';
import { Fragment, type Node as ProseMirrorNode } from 'prosemirror-model';
import { schema, type TableColumnAlignment } from './schema';
import { classifyHtmlBlock } from './html/htmlClassifier';
import { parseHtmlContent } from './html/htmlToPmLogic';
import { serializeHtmlBlock } from './html/pmToHtml';

const markdownIt = MarkdownIt('commonmark', { html: true }).enable('table');
const parseMarkdownTokens = markdownIt.parse.bind(markdownIt);
markdownIt.parse = (src, env) => {
  const normalized = [];
  for (const token of parseMarkdownTokens(src, env)) {
    if (['thead_open', 'thead_close', 'tbody_open', 'tbody_close'].includes(token.type)) {
      continue;
    }
    if (token.type === 'th_close' || token.type === 'td_close') {
      normalized.push(new Token('paragraph_close', 'p', -1));
    }
    normalized.push(token);
    if (token.type === 'th_open' || token.type === 'td_open') {
      normalized.push(new Token('paragraph_open', 'p', 1));
    }
  }
  return normalized;
};

const tableMarkdownParser = new MarkdownParser(
  schema,
  markdownIt,
  {
    ...defaultMarkdownParser.tokens,
    table: { block: 'table' },
    tr: { block: 'table_row' },
    th: { block: 'table_header', getAttrs: getTableCellAttrs },
    td: { block: 'table_cell', getAttrs: getTableCellAttrs },
    html_block: { ignore: true },
    html_inline: { ignore: true }
  }
);

type HtmlMarkdownParseState = {
  openNode(type: unknown, attrs?: unknown): void;
  closeNode(): void;
  openMark(mark: unknown): void;
  closeMark(markType: unknown): void;
  addText(text: string): void;
};

type MarkdownParserWithTokenHandlers = MarkdownParser & {
  tokenHandlers: Record<string, (state: HtmlMarkdownParseState, tok: Token) => void>;
};

const tableMarkdownParserWithHandlers = tableMarkdownParser as unknown as MarkdownParserWithTokenHandlers;

// 覆盖 html_block token handler — 分类 HTML 后决定走可编辑节点还是 fallback paragraph
tableMarkdownParserWithHandlers.tokenHandlers = {
  ...tableMarkdownParserWithHandlers.tokenHandlers,
  html_block: (state: HtmlMarkdownParseState, tok: Token) => {
    const classification = classifyHtmlBlock(tok.content);
    if (classification.editable) {
      const attrs: Record<string, unknown> = {
        tag: classification.tag!,
        class: classification.attrs?.class ?? null,
        id: classification.attrs?.id ?? null
      };
      state.openNode(schema.nodes.html_block, attrs);
      parseHtmlContent(state, classification.innerHTML!, schema);
      state.closeNode();
    } else {
      // 不可编辑 HTML：作为 paragraph 保留原始文本，供 tableHtmlPlugin 渲染 widget
      state.openNode(schema.nodes.paragraph);
      state.addText(tok.content.trimEnd());
      state.closeNode();
    }
  }
};

// 覆盖 html_inline token handler — 映射内联 HTML 到已有 mark
// html:true 后，段落内的 <strong> 等标签会产生 html_inline token，
// 不与 markdown 语法 ** 冲突（后者走 strong_open/close 通道）

/** 内联标签到 ProseMirror mark 类型的映射 */
const INLINE_MARK_MAP: Record<string, string> = {
  strong: 'strong',
  b: 'strong',
  em: 'em',
  i: 'em',
  code: 'code',
  a: 'link'
};

const htmlInlineStack: Array<{ tag: string; markName: string }> = [];

function resetHtmlInlineStack(): void {
  htmlInlineStack.length = 0;
}

tableMarkdownParserWithHandlers.tokenHandlers.html_inline = (
  state: HtmlMarkdownParseState,
  tok: Token
) => {
  const content = tok.content;
  const tagMatch = /^<\/?([a-zA-Z][a-zA-Z0-9]*)/.exec(content);
  if (!tagMatch) {
    // 注释、PI 等 — 原样输出
    state.addText(content);
    return;
  }

  const tag = tagMatch[1].toLowerCase();
  const isClosing = content.startsWith('</');
  const isSelfClosing = /\/>$/.test(content);

  if (isSelfClosing) {
    if (tag === 'br') {
      state.addText('\n');
    } else {
      state.addText(content);
    }
    return;
  }

  const markName = INLINE_MARK_MAP[tag];

  if (isClosing) {
    // 在栈中查找匹配的开标签
    const idx = findLastIndex(htmlInlineStack, e => e.tag === tag);
    if (idx >= 0) {
      // 先关闭后面开的标签
      while (htmlInlineStack.length > idx) {
        const top = htmlInlineStack.pop()!;
        state.closeMark(schema.marks[top.markName]);
      }
    } else {
      // 无匹配开标签 — 原样输出
      state.addText(content);
    }
    return;
  }

  // 开标签
  if (markName) {
    const markType = schema.marks[markName];
    let attrs: Record<string, unknown> | null = null;
    if (markName === 'link') {
      attrs = {
        href: extractAttr(content, 'href') ?? '',
        title: extractAttr(content, 'title') ?? null
      };
    }
    const mark = markType.create(attrs);
    htmlInlineStack.push({ tag, markName });
    state.openMark(mark);
  } else {
    // 不支持的内联标签（如 span）— 保留原始 HTML 文本
    state.addText(content);
  }
};

const tableMarkdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    paragraph(state, node) {
      const taskParagraph = splitTaskParagraph(node);
      if (taskParagraph) {
        state.write(taskParagraph.marker);
        state.renderInline(taskParagraph.content);
        state.closeBlock(node);
        return;
      }
      state.renderInline(node);
      state.closeBlock(node);
    },
    bullet_list(state, node) {
      state.renderList(node, '  ', () => '- ');
    },
    table(state, node) {
      state.ensureNewLine();
      state.write(serializeTable(node));
      state.closeBlock(node);
    },
    table_row() {
      return;
    },
    table_cell() {
      return;
    },
    table_header() {
      return;
    },
    html_block(state, node) {
      const html = serializeHtmlBlock(node);
      state.write(html);
      state.closeBlock(node);
    }
  },
  defaultMarkdownSerializer.marks
);

export function parseMarkdown(markdown: string): ProseMirrorNode {
  resetHtmlInlineStack();
  try {
    return tableMarkdownParser.parse(splitFrontMatter(markdown).body);
  } catch {
    resetHtmlInlineStack();
    return schema.node('doc', null, [schema.node('paragraph', null, [schema.text(splitFrontMatter(markdown).body)])]);
  }
}

export function serializeMarkdown(doc: ProseMirrorNode): string {
  return tableMarkdownSerializer.serialize(doc);
}

export function splitFrontMatter(markdown: string): { frontMatter: string; body: string } {
  if (!markdown.startsWith('---\n')) {
    return { frontMatter: '', body: markdown };
  }

  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) {
    return { frontMatter: '', body: markdown };
  }

  const frontMatter = markdown.slice(0, end + 5);
  const body = markdown.slice(frontMatter.length).replace(/^\s+/, '');
  return { frontMatter, body };
}

export function createTableMarkdown(rows: number, columns: number): string {
  const columnCount = Math.max(2, Math.min(columns, 6));
  const rowCount = Math.max(1, Math.min(rows, 8));
  const headers = Array.from({ length: columnCount }, (_, index) => `列 ${index + 1}`);
  const separator = Array.from({ length: columnCount }, () => '---');
  const body = Array.from({ length: rowCount }, (_, rowIndex) => headers.map((_, columnIndex) => `单元格 ${rowIndex + 1}-${columnIndex + 1}`));
  const lines = [headers, separator, ...body].map((cells) => `| ${cells.join(' | ')} |`);
  return `${lines.join('\n')}\n`;
}

function getTableCellAttrs(token: { attrGet(name: string): string | null }): { align: TableColumnAlignment | null } {
  const style = token.attrGet('style') ?? '';
  const match = /text-align\s*:\s*(left|center|right)/i.exec(style);
  return { align: match ? (match[1].toLowerCase() as TableColumnAlignment) : null };
}

function serializeTable(table: ProseMirrorNode): string {
  const rows: ProseMirrorNode[] = [];
  table.forEach((row) => rows.push(row));
  if (rows.length === 0) return '';

  const columnCount = Math.max(...rows.map((row) => row.childCount));
  const serializedRows = rows.map((row) => serializeTableRow(row, columnCount));
  const alignments = Array.from({ length: columnCount }, (_, index) => readColumnAlignment(rows, index));
  const separator = alignments.map((align) => {
    if (align === 'center') return ':---:';
    if (align === 'right') return '---:';
    return ':---';
  });

  return [serializedRows[0], separator, ...serializedRows.slice(1)]
    .map((cells) => `| ${cells.join(' | ')} |`)
    .join('\n');
}

function serializeTableRow(row: ProseMirrorNode, columnCount: number): string[] {
  const cells: string[] = [];
  row.forEach((cell) => cells.push(serializeTableCell(cell)));
  while (cells.length < columnCount) cells.push('');
  return cells;
}

function serializeTableCell(cell: ProseMirrorNode): string {
  const parts: string[] = [];
  cell.descendants((node) => {
    if (node.isText) {
      parts.push(serializeInlineText(node));
      return false;
    }
    if (node.type.name === 'hard_break') {
      parts.push('<br>');
      return false;
    }
    return true;
  });
  return parts.join('').replace(/\\/g, '').replace(/\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function serializeInlineText(node: ProseMirrorNode): string {
  const text = escapeTableText(node.text ?? '');
  return node.marks.reduce((value, mark) => {
    if (mark.type.name === 'strong') return `**${value}**`;
    if (mark.type.name === 'em') return `*${value}*`;
    if (mark.type.name === 'code') return `\`${value.replace(/`/g, '\\`')}\``;
    if (mark.type.name === 'link') return `[${value}](${mark.attrs.href})`;
    return value;
  }, text);
}

function splitTaskParagraph(node: ProseMirrorNode): { marker: string; content: ProseMirrorNode } | null {
  const firstChild = node.firstChild;
  if (!firstChild?.isText) return null;

  const match = /^\[[ x]\]\s?/.exec(firstChild.text ?? '');
  if (!match) return null;

  const children: ProseMirrorNode[] = [];
  const restText = (firstChild.text ?? '').slice(match[0].length);
  if (restText) children.push(node.type.schema.text(restText, firstChild.marks));
  for (let index = 1; index < node.childCount; index++) {
    children.push(node.child(index));
  }

  return {
    marker: match[0].endsWith(' ') ? match[0] : `${match[0]} `,
    content: node.type.create(node.attrs, Fragment.fromArray(children), node.marks)
  };
}

function escapeTableText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

function readColumnAlignment(rows: ProseMirrorNode[], columnIndex: number): TableColumnAlignment | null {
  for (const row of rows) {
    if (columnIndex >= row.childCount) continue;
    const cell = row.child(columnIndex);
    const align = cell?.attrs.align;
    if (align === 'left' || align === 'center' || align === 'right') return align;
  }
  return null;
}

export function createMarkdownInputRules() {
  return [
    textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({ level: match[1].length })),
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
    wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({ order: Number(match[1]) })),
    textblockTypeInputRule(/^```$/, schema.nodes.code_block)
  ];
}

function findLastIndex<T>(arr: T[], predicate: (value: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

function extractAttr(rawTag: string, name: string): string | null {
  const regex = new RegExp(`${name}="([^"]*)"`, 'i');
  const match = regex.exec(rawTag);
  return match ? match[1] : null;
}
