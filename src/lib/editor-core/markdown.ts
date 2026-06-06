import { InputRule, textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';
import MarkdownIt from 'markdown-it';
import Token from 'markdown-it/lib/token.mjs';
import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  MarkdownParser,
  MarkdownSerializer,
} from 'prosemirror-markdown';
import { Fragment, type Node as ProseMirrorNode } from 'prosemirror-model';
import { schema, type TableColumnAlignment } from './schema';
import { classifyHtmlBlock } from './html/htmlClassifier';
import { parseHtmlContent } from './html/htmlToPmLogic';
import { serializeHtmlBlock } from './html/pmToHtml';
import { transformCalloutTokens, calloutParserTokens } from './callout/calloutParser';
import { serializeCallout } from './callout/calloutSerializer';
import { TOC_END_MARKER, TOC_START_MARKER } from '../toc/tocService';
import { splitFrontMatterBlock } from '../markdown/frontMatter';

const markdownIt = MarkdownIt('commonmark', { html: true }).enable(['table', 'strikethrough']);

markdownIt.inline.ruler.before('link', 'footnote_ref', (state, silent) => {
  const src = state.src;
  const pos = state.pos;
  if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5e) return false;

  const end = src.indexOf(']', pos + 2);
  if (end === -1) return false;

  const id = src.slice(pos + 2, end).trim();
  if (!id || /\s/.test(id)) return false;

  if (!silent) {
    const token = state.push('footnote_ref', 'sup', 0);
    token.content = id;
    token.markup = '[^]';
    token.meta = { id };
  }
  state.pos = end + 1;
  return true;
});

markdownIt.inline.ruler.after('backticks', 'math_inline', (state, silent) => {
  const src = state.src;
  const pos = state.pos;
  if (src.charCodeAt(pos) !== 0x24) return false;
  if (pos + 1 < src.length && src.charCodeAt(pos + 1) === 0x24) return false; // $$ display
  // 属于 $$ 的第二个 $：仅当 pos-1 和 pos-2 都是 $ 时才跳过（即 $$$ 三连），
  // 避免误判相邻行内公式 $a$$b$ 的情况（pos-1 是前一个公式的闭合 $）
  if (pos > 0 && src.charCodeAt(pos - 1) === 0x24) {
    if (pos === 1 || src.charCodeAt(pos - 2) === 0x24) return false;
  }

  let end = pos + 1;
  while (end < src.length) {
    if (src.charCodeAt(end) === 0x24) {
      let bsCount = 0;
      let i = end - 1;
      while (i > pos && src.charCodeAt(i) === 0x5c) {
        bsCount++;
        i--;
      }
      if (bsCount % 2 === 0) break;
    }
    end++;
  }
  if (end >= src.length || end === pos + 1) return false;

  const tex = src
    .slice(pos + 1, end)
    .trim()
    .replace(/\\\$/g, '$');
  if (!tex.trim()) return false;

  if (!silent) {
    const token = state.push('math_inline', '', 0);
    token.content = tex;
    token.markup = '$';
    state.pos = end + 1;
  }
  return true;
});

markdownIt.block.ruler.before('reference', 'footnote_def', (state, startLine, _endLine, silent) => {
  const startPos = state.bMarks[startLine] + state.tShift[startLine];
  const lineText = state.src.slice(startPos, state.eMarks[startLine]);
  const match = /^\[\^([^\]\s]+)\]:[ \t]*(.*)$/.exec(lineText);
  if (!match) return false;

  if (silent) return true;

  const id = match[1];
  const content = match[2] ?? '';
  const openToken = state.push('footnote_def_open', 'div', 1);
  openToken.block = true;
  openToken.map = [startLine, startLine + 1];
  openToken.markup = '[^]:';
  openToken.meta = { id };

  const inlineToken = state.push('inline', '', 0);
  inlineToken.content = content;
  inlineToken.children = [];
  inlineToken.map = [startLine, startLine + 1];

  const closeToken = state.push('footnote_def_close', 'div', -1);
  closeToken.block = true;
  closeToken.markup = '[^]:';
  closeToken.meta = { id };

  state.line = startLine + 1;
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
  const rawTokens = collapseTocTokens(parseMarkdownTokens(src, env), src);
  const normalized = [];
  for (const token of rawTokens) {
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

  const result = restoreBlankParagraphTokens(normalized);

  // 将匹配 [!TYPE] 的 blockquote 改写为 callout
  transformCalloutTokens(result);

  return result;
};

const tableMarkdownParser = new MarkdownParser(schema, markdownIt, {
  ...defaultMarkdownParser.tokens,
  toc_block: { node: 'toc_block', getAttrs: (tok: Token) => ({ content: tok.content }) },
  table: { block: 'table' },
  tr: { block: 'table_row' },
  th: { block: 'table_header', getAttrs: getTableCellAttrs },
  td: { block: 'table_cell', getAttrs: getTableCellAttrs },
  footnote_ref: {
    node: 'footnote_ref',
    getAttrs: (tok: Token) => ({ id: tok.meta?.id ?? tok.content }),
  },
  footnote_def: { block: 'footnote_def', getAttrs: (tok: Token) => ({ id: tok.meta?.id ?? '' }) },
  math_inline: { node: 'math_inline', getAttrs: (tok: Token) => ({ tex: tok.content }) },
  math_display: { node: 'math_block', getAttrs: (tok: Token) => ({ tex: tok.content }) },
  code_inline: { node: 'inline_code', getAttrs: (tok: Token) => ({ code: tok.content }) },
  ...calloutParserTokens,
  s: { mark: 'strikethrough' },
  s_open: { mark: 'strikethrough' },
  s_close: { mark: 'strikethrough' },
  html_block: { ignore: true },
  html_inline: { ignore: true },
});

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

const tableMarkdownParserWithHandlers =
  tableMarkdownParser as unknown as MarkdownParserWithTokenHandlers;

const ADJACENT_INLINE_CODE_SENTINEL = '<!-- md-adjacent-inline-code -->';
const defaultFenceTokenHandler = tableMarkdownParserWithHandlers.tokenHandlers.fence;

// 覆盖 html_block token handler — 分类 HTML 后决定走可编辑节点还是 fallback paragraph
tableMarkdownParserWithHandlers.tokenHandlers = {
  ...tableMarkdownParserWithHandlers.tokenHandlers,
  fence: (state: HtmlMarkdownParseState, tok: Token) => {
    const language = tok.info.trim().split(/\s+/)[0]?.toLowerCase();
    if (language === 'mermaid') {
      state.openNode(schema.nodes.mermaid_block, { code: tok.content.replace(/\n$/, '') });
      state.closeNode();
      return;
    }

    defaultFenceTokenHandler(state, tok);
  },
  html_block: (state: HtmlMarkdownParseState, tok: Token) => {
    const classification = classifyHtmlBlock(tok.content);
    if (classification.editable) {
      const attrs: Record<string, unknown> = {
        tag: classification.tag!,
        class: classification.attrs?.class ?? null,
        id: classification.attrs?.id ?? null,
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
  },
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
  a: 'link',
  s: 'strikethrough',
  del: 'strikethrough',
  strike: 'strikethrough',
  u: 'underline',
};

const htmlInlineStack: Array<{ tag: string; markName: string }> = [];

function resetHtmlInlineStack(): void {
  htmlInlineStack.length = 0;
}

tableMarkdownParserWithHandlers.tokenHandlers.html_inline = (
  state: HtmlMarkdownParseState,
  tok: Token,
) => {
  const content = tok.content;
  if (content === ADJACENT_INLINE_CODE_SENTINEL) {
    return;
  }

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
    const idx = findLastIndex(htmlInlineStack, (e) => e.tag === tag);
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
        title: extractAttr(content, 'title') ?? null,
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
      if (node.content.size === 0) {
        // 空段落只需要触发前一个块落盘；不写入当前列表缩进，避免保存成带空格的“空行”。
        flushPendingClosedBlock(state);
      } else {
        state.renderInline(node);
      }
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
    toc_block(state, node) {
      state.ensureNewLine();
      const content = String(node.attrs.content ?? '').trim();
      state.write(`${TOC_START_MARKER}\n`);
      if (content) {
        state.write(`${content}\n`);
      }
      state.write(`${TOC_END_MARKER}\n`);
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
    footnote_ref(state, node) {
      state.write(`[^${node.attrs.id}]`);
    },
    footnote_def(state, node) {
      state.ensureNewLine();
      state.write(`[^${node.attrs.id}]: `);
      state.renderInline(node);
      state.closeBlock(node);
    },
    text(state, node) {
      state.text(escapeMarkdownTextWithoutManualInlineMarkers(node.text ?? ''), false);
    },
    math_block(state, node) {
      state.ensureNewLine();
      state.write('$$\n');
      state.write(node.attrs.tex as string);
      state.write('\n$$\n');
      state.closeBlock(node);
    },
    mermaid_block(state, node) {
      state.ensureNewLine();
      state.write('```mermaid\n');
      state.write(node.attrs.code as string);
      state.write('\n```\n');
      state.closeBlock(node);
    },
    callout(state, node) {
      serializeCallout(state, node);
    },
  },
  {
    ...defaultMarkdownSerializer.marks,
    strikethrough: {
      open: '~~',
      close: '~~',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    underline: {
      open: '<u>',
      close: '</u>',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
  },
);

export function parseMarkdown(markdown: string): ProseMirrorNode {
  resetHtmlInlineStack();
  const rawBody = splitFrontMatter(markdown).body;
  const body = normalizeAdjacentInlineCode(rawBody);
  try {
    return tableMarkdownParser.parse(body);
  } catch {
    resetHtmlInlineStack();
    return schema.node('doc', null, [schema.node('paragraph', null, [schema.text(rawBody)])]);
  }
}

export function serializeMarkdown(doc: ProseMirrorNode): string {
  return tableMarkdownSerializer.serialize(doc);
}

export function splitFrontMatter(markdown: string): { frontMatter: string; body: string } {
  return splitFrontMatterBlock(markdown);
}

function normalizeAdjacentInlineCode(markdown: string): string {
  let normalized = '';
  let inFence = false;

  for (const line of markdown.split(/(\r?\n)/)) {
    if (line === '\n' || line === '\r\n') {
      normalized += line;
      continue;
    }

    if (/^\s*`{3,}/.test(line)) {
      inFence = !inFence;
      normalized += line;
      continue;
    }

    normalized += inFence ? line : normalizeAdjacentInlineCodeLine(line);
  }

  return normalized;
}

function normalizeAdjacentInlineCodeLine(line: string): string {
  let result = '';
  let index = 0;

  while (index < line.length) {
    const firstStart = findUnescapedBacktick(line, index);
    if (firstStart === -1) {
      result += line.slice(index);
      break;
    }

    const firstEnd = findUnescapedBacktick(line, firstStart + 1);
    if (firstEnd === -1 || line[firstEnd + 1] !== '`') {
      result += line.slice(index, firstStart + 1);
      index = firstStart + 1;
      continue;
    }

    const secondEnd = findUnescapedBacktick(line, firstEnd + 2);
    if (secondEnd === -1) {
      result += line.slice(index, firstEnd + 1);
      index = firstEnd + 1;
      continue;
    }

    const firstCode = line.slice(firstStart + 1, firstEnd).trim();
    const secondCode = line.slice(firstEnd + 2, secondEnd).trim();
    if (!firstCode || !secondCode) {
      result += line.slice(index, firstEnd + 1);
      index = firstEnd + 1;
      continue;
    }

    result += line.slice(index, firstEnd + 1);
    result += ADJACENT_INLINE_CODE_SENTINEL;
    index = firstEnd + 1;
  }

  return result;
}

function restoreBlankParagraphTokens(tokens: Token[]): Token[] {
  // markdown-it 会把连续空行当作块分隔符丢弃；这里按顶层块的行号映射恢复空段落。
  const result: Token[] = [];
  let previousTopLevelBlockEnd = -1;
  const listItemStack: ListItemBlankParagraphContext[] = [];

  for (const token of tokens) {
    const listItemContext = getCurrentListItemContext(listItemStack);
    const listItemChildRange = listItemContext
      ? getDirectListItemChildBlockRange(token, listItemContext)
      : null;
    if (listItemContext && listItemChildRange) {
      if (listItemContext.previousChildBlockEnd >= 0) {
        appendBlankParagraphTokens(
          result,
          listItemContext.previousChildBlockEnd,
          listItemChildRange[0],
        );
      }
      listItemContext.previousChildBlockEnd = listItemChildRange[1];
    }

    if (token.type === 'list_item_close') {
      const context = listItemStack.pop();
      if (context && context.previousChildBlockEnd >= 0) {
        appendBlankParagraphTokens(result, context.previousChildBlockEnd, context.endLine);
      }
    }

    const blockRange = getTopLevelBlockRange(token);
    if (blockRange) {
      if (previousTopLevelBlockEnd >= 0) {
        appendBlankParagraphTokens(result, previousTopLevelBlockEnd, blockRange[0]);
      }
      previousTopLevelBlockEnd = blockRange[1];
    }

    result.push(token);

    const newListItemContext = createListItemBlankParagraphContext(token);
    if (newListItemContext) {
      listItemStack.push(newListItemContext);
    }
  }

  return result;
}

function flushPendingClosedBlock(state: unknown): void {
  (state as { flushClose(): void }).flushClose();
}

type ListItemBlankParagraphContext = {
  childLevel: number;
  endLine: number;
  previousChildBlockEnd: number;
};

function createListItemBlankParagraphContext(token: Token): ListItemBlankParagraphContext | null {
  if (token.type !== 'list_item_open' || !token.map) {
    return null;
  }
  return {
    childLevel: token.level + 1,
    endLine: token.map[1],
    previousChildBlockEnd: -1,
  };
}

function getCurrentListItemContext(
  stack: ListItemBlankParagraphContext[],
): ListItemBlankParagraphContext | null {
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

function getDirectListItemChildBlockRange(
  token: Token,
  context: ListItemBlankParagraphContext,
): [number, number] | null {
  if (token.level !== context.childLevel || !token.map) {
    return null;
  }
  if (token.nesting === -1 || token.type === 'inline' || token.type === 'list_item_open') {
    return null;
  }
  return [token.map[0], token.map[1]];
}

function getTopLevelBlockRange(token: Token): [number, number] | null {
  if (token.level !== 0 || !token.map) {
    return null;
  }
  if (token.nesting === -1) {
    return null;
  }
  if (token.type === 'inline') {
    return null;
  }
  return [token.map[0], token.map[1]];
}

function appendBlankParagraphTokens(
  result: Token[],
  previousEndLine: number,
  nextStartLine: number,
) {
  const gap = nextStartLine - previousEndLine - 1;
  for (let index = 0; index < gap; index++) {
    const line = previousEndLine + 1 + index;
    result.push(
      createEmptyParagraphOpen(line),
      createEmptyInlineToken(line),
      createEmptyParagraphClose(),
    );
  }
}

function createEmptyParagraphOpen(line: number): Token {
  const emptyOpen = new Token('paragraph_open', 'p', 1);
  emptyOpen.map = [line, line + 1];
  return emptyOpen;
}

function createEmptyInlineToken(line: number): Token {
  const emptyInline = new Token('inline', '', 0);
  emptyInline.content = '';
  emptyInline.children = [];
  emptyInline.map = [line, line + 1];
  return emptyInline;
}

function createEmptyParagraphClose(): Token {
  return new Token('paragraph_close', 'p', -1);
}

function findUnescapedBacktick(text: string, from: number): number {
  for (let index = from; index < text.length; index++) {
    if (text[index] === '`' && !isEscapedMarkdownChar(text, index)) {
      return index;
    }
  }
  return -1;
}

function isEscapedMarkdownChar(text: string, charIndex: number): boolean {
  let slashCount = 0;
  for (let index = charIndex - 1; index >= 0 && text[index] === '\\'; index--) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

export function createTableMarkdown(rows: number, columns: number): string {
  const columnCount = Math.max(2, Math.min(columns, 6));
  const rowCount = Math.max(1, Math.min(rows, 8));
  const headers = Array.from({ length: columnCount }, () => '');
  const separator = Array.from({ length: columnCount }, () => '---');
  const body = Array.from({ length: rowCount }, () => headers.map(() => ''));
  const lines = [headers, separator, ...body].map((cells) => `| ${cells.join(' | ')} |`);
  return `${lines.join('\n')}\n`;
}

function getTableCellAttrs(token: { attrGet(name: string): string | null }): {
  align: TableColumnAlignment | null;
} {
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
  const alignments = Array.from({ length: columnCount }, (_, index) =>
    readColumnAlignment(rows, index),
  );
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
    if (mark.type.name === 'strikethrough') return `~~${value}~~`;
    if (mark.type.name === 'underline') return `<u>${value}</u>`;
    if (mark.type.name === 'link') return `[${value}](${mark.attrs.href})`;
    return value;
  }, text);
}

function splitTaskParagraph(
  node: ProseMirrorNode,
): { marker: string; content: ProseMirrorNode } | null {
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
    content: node.type.create(node.attrs, Fragment.fromArray(children), node.marks),
  };
}

function escapeTableText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

function escapeMarkdownTextWithoutManualInlineMarkers(text: string): string {
  return text.replace(/[`\\[\]_]/g, (match, index) =>
    match === '_' &&
    index > 0 &&
    index + 1 < text.length &&
    /\w/.test(text[index - 1] ?? '') &&
    /\w/.test(text[index + 1] ?? '')
      ? match
      : `\\${match}`,
  );
}

function readColumnAlignment(
  rows: ProseMirrorNode[],
  columnIndex: number,
): TableColumnAlignment | null {
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
    textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({
      level: match[1].length,
    })),
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
    wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({
      order: Number(match[1]),
    })),
    textblockTypeInputRule(/^```$/, schema.nodes.code_block),
    createHorizontalRuleInputRule(),
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

/**
 * 输入 ---、___ 或 *** 后回车，自动转为水平分割线
 */
function createHorizontalRuleInputRule(): InputRule {
  return new InputRule(/^([-*_]{3})$/, (state, match, start, end) => {
    const hrNode = schema.nodes.horizontal_rule.create();
    const emptyParagraph = schema.nodes.paragraph.create();
    return state.tr.replaceWith(start, end, [hrNode, emptyParagraph]);
  });
}

function findLastIndex<T>(arr: T[], predicate: (value: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

function collapseTocTokens(tokens: Token[], markdown: string): Token[] {
  const result: Token[] = [];
  const lines = markdown.split(/\r?\n/);

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!isTocStartToken(token)) {
      result.push(token);
      continue;
    }

    const endIndex = findTocEndTokenIndex(tokens, index + 1);
    if (endIndex === -1) {
      result.push(token);
      continue;
    }

    const startLine = token.map?.[0] ?? 0;
    const endLine = tokens[endIndex].map?.[0] ?? startLine;
    const tocToken = new Token('toc_block', '', 0);
    tocToken.content = lines
      .slice(startLine + 1, endLine)
      .join('\n')
      .trim();
    tocToken.map = [startLine, tokens[endIndex].map?.[1] ?? endLine + 1];
    result.push(tocToken);
    index = endIndex;
  }

  return result;
}

function isTocStartToken(token: Token): boolean {
  return token.type === 'html_block' && /^<!--\s*toc\s*-->\s*$/i.test(token.content.trim());
}

function isTocEndToken(token: Token): boolean {
  return token.type === 'html_block' && /^<!--\s*\/toc\s*-->\s*$/i.test(token.content.trim());
}

function findTocEndTokenIndex(tokens: Token[], from: number): number {
  for (let index = from; index < tokens.length; index++) {
    if (isTocEndToken(tokens[index])) {
      return index;
    }
  }
  return -1;
}

function extractAttr(rawTag: string, name: string): string | null {
  const regex = new RegExp(`${name}="([^"]*)"`, 'i');
  const match = regex.exec(rawTag);
  return match ? match[1] : null;
}
