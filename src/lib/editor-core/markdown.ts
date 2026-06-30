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
import {
  createLinkAttrs,
  normalizeLinkHref,
  serializeMarkdownLinkDestination,
  serializeMarkdownLinkTitle,
} from './link';
import { transformCalloutTokens, calloutParserTokens } from './callout/calloutParser';
import { serializeCallout } from './callout/calloutSerializer';
import { TOC_END_MARKER, TOC_START_MARKER } from '../toc/tocService';
import { splitFrontMatterBlock } from '../markdown/frontMatter';

const markdownIt = MarkdownIt('commonmark', { html: true }).enable(['table', 'strikethrough']);
markdownIt.validateLink = (url: string) => normalizeLinkHref(url) !== null;

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

// ——— 图片 HTML / 属性解析工具 ———

/** HTML 属性值转义：& " < > */
function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 从 <img ...> 标签内容中提取 src / alt / title / width */
function parseHtmlImgAttrs(tagContent: string): {
  src: string | null;
  alt: string | null;
  title: string | null;
  width: string | null;
} {
  const result: { src: string | null; alt: string | null; title: string | null; width: string | null } =
    { src: null, alt: null, title: null, width: null };
  // 匹配 key="value" | key='value' | key=value（value 不含空白和 >）
  const attrRegex = /([a-zA-Z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(tagContent)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    if (name === 'src') result.src = value;
    else if (name === 'alt') result.alt = value;
    else if (name === 'title') result.title = value;
    else if (name === 'width') result.width = value;
  }
  return result;
}

// ——— 图片属性解析：支持 ![alt](src){align=center width=60%} 语法 ———

// 1. 行内规则：在 image token 后方检测 {key=value ...} 属性块
markdownIt.inline.ruler.after('image', 'image_attrs', (state, silent) => {
  const pos = state.pos;
  if (state.src.charCodeAt(pos) !== 0x7b) return false; // '{'

  // 前一个 token 必须是 image
  const prevToken = state.tokens[state.tokens.length - 1];
  if (!prevToken || prevToken.type !== 'image') return false;

  const closeBrace = state.src.indexOf('}', pos + 1);
  if (closeBrace === -1) return false;

  const attrsStr = state.src.slice(pos + 1, closeBrace).trim();
  if (!attrsStr) return false;

  const attrs: Record<string, string> = {};
  for (const part of attrsStr.split(/\s+/)) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    attrs[part.slice(0, eq)] = part.slice(eq + 1);
  }

  if (silent) return true;

  // 回写到 image token 的 attrs 中（attrs 是 [name, value] 数组，需用 attrSet）
  if (attrs.align) prevToken.attrSet('align', attrs.align);
  if (attrs.width) prevToken.attrSet('width', attrs.width);

  state.pos = closeBrace + 1;
  return true;
});

// 2. 行内规则：在 html_inline 之前检测 <img src="..." ...> 内联 HTML 图片
markdownIt.inline.ruler.before('html_inline', 'image_html_inline', (state, silent) => {
  const pos = state.pos;
  if (state.src.slice(pos, pos + 4).toLowerCase() !== '<img') return false;

  // 找到结束的 >（简单匹配，不处理属性值内含 > 的极端情况）
  const end = state.src.indexOf('>', pos + 4);
  if (end === -1) return false;

  // 检查闭合前没有未转义的 <（防止误匹配 <img ...><script>）
  const tagContent = state.src.slice(pos + 4, end).replace(/\/$/, '').trim();
  if (tagContent.includes('<')) return false;

  const imgAttrs = parseHtmlImgAttrs(tagContent);
  if (!imgAttrs.src) return false;

  if (silent) return true;

  const token = state.push('image', 'img', 0);
  token.attrSet('src', imgAttrs.src);
  if (imgAttrs.alt !== null) token.attrSet('alt', imgAttrs.alt);
  if (imgAttrs.title) token.attrSet('title', imgAttrs.title);
  if (imgAttrs.width) token.attrSet('width', imgAttrs.width);

  // 删除属性块空行（如果有）
  state.pos = end + 1;
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
  link_open: {
    mark: 'link',
    getAttrs: (tok: Token) =>
      createLinkAttrs(tok.attrGet('href'), tok.attrGet('title')) ?? { href: '', title: null },
  },
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
  code_inline: { mark: 'code' },
  image: {
    node: 'image',
    getAttrs: (tok: Token) => ({
      src: tok.attrGet('src'),
      title: tok.attrGet('title') || null,
      alt: tok.children?.[0]?.content || null,
      align: tok.attrGet('align') || null,
      width: tok.attrGet('width') || null,
    }),
  },
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

const COMMENT_RE = /^<!--([\s\S]*?)-->$/;
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
    if (isMarkdownComment(tok.content) && !isReservedTocComment(tok.content)) {
      const content = readMarkdownCommentContent(tok.content);
      if (isSingleLineMarkdownComment(tok.content)) {
        state.openNode(schema.nodes.paragraph);
        state.openNode(schema.nodes.comment_inline, { content });
        state.closeNode();
        state.closeNode();
      } else {
        state.openNode(schema.nodes.comment_block, { content });
        state.closeNode();
      }
      return;
    }

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
  mark: 'highlight',
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

  if (isMarkdownComment(content) && !isReservedTocComment(content)) {
    state.openNode(schema.nodes.comment_inline, {
      content: readMarkdownCommentContent(content),
    });
    state.closeNode();
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
      const linkAttrs = createLinkAttrs(
        extractAttr(content, 'href'),
        extractAttr(content, 'title'),
      );
      attrs = linkAttrs ? { ...linkAttrs } : null;
      if (!attrs) {
        state.addText(content);
        return;
      }
    }
    const mark = markType.create(attrs);
    htmlInlineStack.push({ tag, markName });
    state.openMark(mark);
  } else {
    // 不支持的内联标签（如 span）— 保留原始 HTML 文本
    state.addText(content);
  }
};

// 覆盖 image token handler — 从 tok.attrs 读取 align/width 写入 node
// 需要在 tableMarkdownParserWithHandlers 定义之后执行
const defaultImageTokenHandler = tableMarkdownParserWithHandlers.tokenHandlers.image;
tableMarkdownParserWithHandlers.tokenHandlers.image = (state, tok) => {
  if (defaultImageTokenHandler) {
    // image_attrs 行内规则已将 align/width 写入 tok.attrs，
    // 这里确保它们作为 ProseMirror node attrs 传递
    defaultImageTokenHandler(state, tok);
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
    comment_block(state, node) {
      state.ensureNewLine();
      state.write(serializeMarkdownComment(String(node.attrs.content ?? ''), true));
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
    image(state, node) {
      const src = String(node.attrs.src ?? '');
      const alt = String(node.attrs.alt ?? '');
      const title = node.attrs.title as string | null;
      const align = node.attrs.align as string | null;
      const width = node.attrs.width as string | null;

      if (align === 'left' || align === 'center' || align === 'right') {
        // 有对齐 → 块级 HTML：<p align="...">\n  <img ...>\n</p>
        state.ensureNewLine();
        let imgTag = `<img src="${escapeHtmlAttr(src)}" alt="${escapeHtmlAttr(alt)}"`;
        if (title) imgTag += ` title="${escapeHtmlAttr(title)}"`;
        if (width) imgTag += ` width="${escapeHtmlAttr(width)}"`;
        imgTag += '>';
        state.write(`<p align="${align}">\n  ${imgTag}\n</p>`);
        state.closeBlock(node);
      } else if (width) {
        // 只有宽度 → 内联 <img ...>（不换行，保留在段落内）
        let imgTag = `<img src="${escapeHtmlAttr(src)}" alt="${escapeHtmlAttr(alt)}"`;
        if (title) imgTag += ` title="${escapeHtmlAttr(title)}"`;
        imgTag += ` width="${escapeHtmlAttr(width)}"`;
        imgTag += '>';
        state.write(imgTag);
      } else {
        // 无样式 → 标准 Markdown 图片
        const escapedAlt = state.esc(alt, false);
        const escapedSrc = state.esc(src);
        const titleStr = title ? ` "${state.esc(title, false)}"` : '';
        state.write(`![${escapedAlt}](${escapedSrc}${titleStr})`);
      }
    },
    math_inline(state, node) {
      state.write(`$${node.attrs.tex.replace(/\$/g, '\\$')}$`);
    },
    comment_inline(state, node) {
      state.write(serializeMarkdownComment(String(node.attrs.content ?? ''), false));
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
    highlight: {
      open: '<mark>',
      close: '</mark>',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    link: {
      open: '[',
      close(_state, mark) {
        const href = serializeMarkdownLinkDestination(String(mark.attrs.href ?? ''));
        const title = mark.attrs.title
          ? ` "${serializeMarkdownLinkTitle(String(mark.attrs.title))}"`
          : '';
        return `](${href}${title})`;
      },
      mixable: true,
    },
  },
);

/**
 * 预处理：将 GitHub 兼容的 HTML 图片格式转换为旧 {align=center width=128} 格式，
 * 让现有 parser 统一处理。
 *   - <p align="left|center|right"><img ...></p>  → ![alt](src){align=X width=Y}
 *   - 独立一行的 <img src="..." ...>             → ![alt](src){width=Y}
 */
function preprocessImageHtml(markdown: string): string {
  // 步骤1：<p align="..."><img ...></p>（单行或多行）
  let result = markdown.replace(
    /<p\s+align="(left|center|right)"\s*>\s*(<img\s+[^>]+(?:\/>|>))\s*<\/p>/gi,
    (_full, align: string, imgTag: string) => {
      const cleaned = imgTag.replace(/\/>$/, '').replace(/>$/, '').trim();
      const attrs = parseHtmlImgAttrs(cleaned);
      if (!attrs.src) return _full;
      const parts: string[] = [`align=${align.toLowerCase()}`];
      if (attrs.width) parts.push(`width=${attrs.width}`);
      const titleStr = attrs.title ? ` "${attrs.title}"` : '';
      return `![${attrs.alt || ''}](${attrs.src}${titleStr}){${parts.join(' ')}}`;
    },
  );

  // 步骤2：独立一行的 <img src="..." ...>（不跟在 <p> 里）
  result = result.replace(
    /^<img\s+[^>]+(?:\/>|>)\s*$/gim,
    (imgTag: string) => {
      const cleaned = imgTag.replace(/\/>$/, '').replace(/>$/, '').trim();
      if (/<[^>]+<[^>]+>/.test(cleaned)) return imgTag; // 含嵌套标签，不处理
      const attrs = parseHtmlImgAttrs(cleaned);
      if (!attrs.src) return imgTag;
      const parts: string[] = [];
      if (attrs.width) parts.push(`width=${attrs.width}`);
      const titleStr = attrs.title ? ` "${attrs.title}"` : '';
      const attrsStr = parts.length > 0 ? `{${parts.join(' ')}}` : '';
      return `![${attrs.alt || ''}](${attrs.src}${titleStr})${attrsStr}`;
    },
  );

  return result;
}

export function parseMarkdown(markdown: string): ProseMirrorNode {
  resetHtmlInlineStack();
  const rawBody = splitFrontMatter(markdown).body;
  const preprocessed = preprocessImageHtml(rawBody);
  try {
    return tableMarkdownParser.parse(preprocessed);
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
    if (mark.type.name === 'highlight') return `<mark>${value}</mark>`;
    if (mark.type.name === 'link') {
      const href = serializeMarkdownLinkDestination(String(mark.attrs.href ?? ''));
      const title = mark.attrs.title
        ? ` "${serializeMarkdownLinkTitle(String(mark.attrs.title))}"`
        : '';
      return `[${value}](${href}${title})`;
    }
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

function isMarkdownComment(content: string): boolean {
  const match = COMMENT_RE.exec(content.trim());
  if (!match) {
    return false;
  }

  const commentContent = match[1];
  return !commentContent.includes('<!--') && !commentContent.includes('-->');
}

function isReservedTocComment(content: string): boolean {
  const trimmed = content.trim();
  return /^<!--\s*toc\s*-->\s*$/i.test(trimmed) || /^<!--\s*\/toc\s*-->\s*$/i.test(trimmed);
}

function isSingleLineMarkdownComment(content: string): boolean {
  return !content.trim().includes('\n');
}

function readMarkdownCommentContent(rawComment: string): string {
  const match = COMMENT_RE.exec(rawComment.trim());
  if (!match) return rawComment;

  const content = match[1].replace(/\r\n/g, '\n');
  if (/^\n[\s\S]*\n$/.test(content)) {
    return content.slice(1, -1);
  }

  return content.replace(/^[ \t]?/, '').replace(/[ \t]?$/, '');
}

function serializeMarkdownComment(content: string, block: boolean): string {
  const safeContent = content.replace(/-->/g, '-- >').replace(/\r\n/g, '\n');
  if (block) {
    return `<!--\n${safeContent}\n-->`;
  }

  const inlineContent = safeContent.replace(/\n+/g, ' ').trim();
  return inlineContent ? `<!-- ${inlineContent} -->` : '<!---->';
}
