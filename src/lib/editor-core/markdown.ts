import { InputRule, textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';
import MarkdownIt from 'markdown-it';
import Token from 'markdown-it/lib/token.mjs';
import { defaultMarkdownParser, defaultMarkdownSerializer, MarkdownParser, MarkdownSerializer } from 'prosemirror-markdown';
import { Fragment, type Node as ProseMirrorNode } from 'prosemirror-model';
import { schema, type TableColumnAlignment } from './schema';
import { classifyHtmlBlock } from './html/htmlClassifier';
import { parseHtmlContent } from './html/htmlToPmLogic';
import { serializeHtmlBlock } from './html/pmToHtml';

const markdownIt = MarkdownIt('commonmark', { html: true }).enable('table');

markdownIt.inline.ruler.after('backticks', 'math_inline', (state, silent) => {
  const src = state.src;
  const pos = state.pos;
  if (src.charCodeAt(pos) !== 0x24) return false;
  if (pos + 1 < src.length && src.charCodeAt(pos + 1) === 0x24) return false; // $$ display
  if (pos > 0 && src.charCodeAt(pos - 1) === 0x24) return false; // 属于 $$ 的第二个 $

  let end = pos + 1;
  while (end < src.length) {
    if (src.charCodeAt(end) === 0x24) {
      let bsCount = 0;
      let i = end - 1;
      while (i > pos && src.charCodeAt(i) === 0x5c) { bsCount++; i--; }
      if (bsCount % 2 === 0) break;
    }
    end++;
  }
  if (end >= src.length || end === pos + 1) return false;

  const tex = src.slice(pos + 1, end).trim().replace(/\\\$/g, '$');
  if (!tex.trim()) return false;

  if (!silent) {
    const token = state.push('math_inline', '', 0);
    token.content = tex;
    token.markup = '$';
    state.pos = end + 1;
  }
  return true;
});

// 注册 markdown-it block rule 识别 $$...$$ 跨行公式
markdownIt.block.ruler.after('fence', 'math_display', (state, startLine, endLine, silent) => {
  const startPos = state.bMarks[startLine] + state.tShift[startLine];
  const lineText = state.src.slice(startPos, state.eMarks[startLine]).trim();

  // 当前行必须以 $$ 开头（允许前导空格，trim 后判断）
  if (!lineText.startsWith('$$')) return false;

  // 单行 $$...$$ 形式（同行闭合）：如 $$ E=mc^2 $$
  const singleLineContent = lineText.slice(2);
  if (singleLineContent.endsWith('$$') && singleLineContent.length > 2) {
    const tex = singleLineContent.slice(0, -2).trim();
    if (tex) {
      if (silent) return true;
      const token = state.push('math_display', 'math', 0);
      token.content = tex;
      token.markup = '$$';
      token.map = [startLine, startLine + 1];
      state.line = startLine + 1;
      return true;
    }
  }

  // 多行 $$ 形式：从 startLine+1 向下扫描闭合 $$ 行
  const texLines: string[] = [];
  let foundClose = false;
  let nextLine = startLine + 1;

  for (let i = startLine + 1; i < endLine; i++) {
    const lineStart = state.bMarks[i] + state.tShift[i];
    const line = state.src.slice(lineStart, state.eMarks[i]).trim();
    if (line === '$$') {
      foundClose = true;
      nextLine = i + 1;
      break;
    }
    texLines.push(state.src.slice(state.bMarks[i], state.eMarks[i]));
  }

  if (!foundClose) return false;

  const content = texLines.join('\n').trim();
  if (!content) return false; // 公式内容不能为空
  if (silent) return true;

  const token = state.push('math_display', 'math', 0);
  token.content = content;
  token.markup = '$$';
  token.map = [startLine, nextLine];
  state.line = nextLine;
  return true;
});

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
    math_inline: { node: 'math_inline', getAttrs: (tok: Token) => ({ tex: tok.content }) },
    math_display: { node: 'math_block', getAttrs: (tok: Token) => ({ tex: tok.content }) },
    code_inline: { node: 'inline_code', getAttrs: (tok: Token) => ({ code: tok.content }) },
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
    },
    math_inline(state, node) {
      state.write(`$${node.attrs.tex.replace(/\$/g, '\\$')}$`);
    },
    inline_code(state, node) {
      const code = node.attrs.code as string;
      // 如果代码内容包含反引号，使用双反引号包裹
      if (code.includes('`')) {
        state.write(`\`\` ${code} \`\``);
      } else {
        state.write(`\`${code}\``);
      }
    },
    math_block(state, node) {
      state.ensureNewLine();
      state.write('$$\n');
      state.write(node.attrs.tex as string);
      state.write('\n$$\n');
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
    createMathInlineInputRule(),
    textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({ level: match[1].length })),
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
    wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({ order: Number(match[1]) })),
    textblockTypeInputRule(/^```$/, schema.nodes.code_block)
  ];
}

function createMathInlineInputRule(): InputRule {
  return new InputRule(/(?:^|[^\\$])\$\s*([^$]*?\S[^$]*?)\s*\$$/, (state, match, start, end) => {
    const fullMatch = match[0];
    const tex = match[1]?.trim().replace(/\\\$/g, '$') ?? '';
    if (!tex.trim()) {
      return null;
    }

    // 步骤1：保留正则前导字符（如果有），只替换用户刚闭合的 $tex$ 片段。
    const hasLeadingChar = !fullMatch.startsWith('$');
    const mathStart = hasLeadingChar ? start + 1 : start;
    const node = schema.nodes.math_inline.create({ tex });

    // 步骤2：用语义公式节点替换源码标记，并把光标放到公式后面继续写正文。
    return state.tr.replaceWith(mathStart, end, node);
  });
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
