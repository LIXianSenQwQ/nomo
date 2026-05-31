import { textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';
import { defaultMarkdownParser, defaultMarkdownSerializer, schema } from 'prosemirror-markdown';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

export function parseMarkdown(markdown: string): ProseMirrorNode {
  try {
    return defaultMarkdownParser.parse(splitFrontMatter(markdown).body);
  } catch {
    return schema.node('doc', null, [schema.node('paragraph', null, [schema.text(splitFrontMatter(markdown).body)])]);
  }
}

export function serializeMarkdown(doc: ProseMirrorNode): string {
  return defaultMarkdownSerializer.serialize(doc);
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

export function createMarkdownInputRules() {
  return [
    textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({ level: match[1].length })),
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
    wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({ order: Number(match[1]) })),
    textblockTypeInputRule(/^```$/, schema.nodes.code_block)
  ];
}
