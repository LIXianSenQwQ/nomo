import { textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';
import MarkdownIt from 'markdown-it';
import Token from 'markdown-it/lib/token.mjs';
import { defaultMarkdownParser, defaultMarkdownSerializer, MarkdownParser, MarkdownSerializer } from 'prosemirror-markdown';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { schema, type TableColumnAlignment } from './schema';

const markdownIt = MarkdownIt('commonmark', { html: false }).enable('table');
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
    td: { block: 'table_cell', getAttrs: getTableCellAttrs }
  }
);

const tableMarkdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
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
    }
  },
  defaultMarkdownSerializer.marks
);

export function parseMarkdown(markdown: string): ProseMirrorNode {
  try {
    return tableMarkdownParser.parse(splitFrontMatter(markdown).body);
  } catch {
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
