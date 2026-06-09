import katex from 'katex';
import MarkdownIt from 'markdown-it';
import Token from 'markdown-it/lib/token.mjs';
import { transformCalloutTokens } from '../lib/editor-core/callout/calloutParser';
import { normalizeLinkHref } from '../lib/editor-core/link';

export interface QuickLookPreviewOptions {
  fileName?: string;
  documentDirectory?: string;
}

export interface QuickLookPreviewPayload extends QuickLookPreviewOptions {
  markdown: string;
}

const CALLOUT_LABELS: Record<string, string> = {
  note: '提醒',
  tip: '建议',
  important: '重要',
  warning: '警告',
  caution: '风险',
};

const ALLOWED_TAGS = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'div',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'input',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

const DISCARD_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed']);
const GLOBAL_ATTRS = new Set(['class', 'title']);
const ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  div: new Set(['class', 'data-callout-type']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  input: new Set(['class', 'type', 'checked', 'disabled', 'aria-label']),
  span: new Set(['class', 'aria-hidden']),
  td: new Set(['style']),
  th: new Set(['style']),
};

const markdownIt = createQuickLookMarkdownIt();

type QuickLookInlineState = {
  src: string;
  pos: number;
  tokens: Token[];
  push(type: string, tag: string, nesting: number): Token;
};

type QuickLookBlockState = {
  src: string;
  bMarks: number[];
  tShift: number[];
  eMarks: number[];
  line: number;
  push(type: string, tag: string, nesting: number): Token;
};

export function renderMarkdownPreview(markdown: string, options: QuickLookPreviewOptions = {}) {
  const body = markdownIt.render(markdown, {
    documentDirectory: options.documentDirectory,
  });

  const title = escapeHtml(options.fileName?.trim() || 'Markdown Preview');
  const sanitizedBody = sanitizePreviewHtml(renderTaskListItems(body));

  return `
    <article class="quicklook-document">
      <header class="quicklook-header">
        <div class="quicklook-kicker">Nomo Quick Look</div>
        <h1>${title}</h1>
      </header>
      <div class="quicklook-markdown rich-markdown">
        ${sanitizedBody}
      </div>
    </article>
  `;
}

export function resolvePreviewAssetSrc(src: string, documentDirectory?: string): string | null {
  const value = src.trim();
  if (!value || /^(?:javascript|vbscript|data)\s*:/i.test(value)) {
    return null;
  }

  if (/^(?:https?|file):/i.test(value)) {
    return value;
  }

  if (value.startsWith('#') || value.startsWith('mailto:')) {
    return null;
  }

  if (isAbsoluteFilePath(value)) {
    return pathToFileUrl(value);
  }

  if (!documentDirectory?.trim()) {
    return value;
  }

  const baseUrl = pathToDirectoryFileUrl(documentDirectory);
  try {
    return new URL(value.replace(/\\/g, '/'), baseUrl).href;
  } catch {
    return null;
  }
}

function createQuickLookMarkdownIt() {
  const md = MarkdownIt('commonmark', {
    html: true,
    linkify: false,
    typographer: true,
  }).enable(['table', 'strikethrough']);

  // 先让 markdown-it 识别链接/图片语法，再在 renderer 和 sanitizer 中按 Nomo 的安全边界过滤。
  md.validateLink = (url: string) => Boolean(url.trim());

  md.core.ruler.after('block', 'nomo_callout', (state) => {
    transformCalloutTokens(state.tokens);
  });

  md.inline.ruler.after('image', 'nomo_image_attrs', parseImageAttrs);
  md.inline.ruler.after('backticks', 'nomo_math_inline', parseMathInline);
  md.block.ruler.after('fence', 'nomo_math_display', parseMathDisplay, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });

  md.renderer.rules.callout_open = (tokens, index) => {
    const token = tokens[index];
    const type = String(token.meta?.calloutType ?? 'note');
    const label = CALLOUT_LABELS[type] ?? CALLOUT_LABELS.note;
    return `<div class="callout-card" data-callout-type="${escapeHtml(type)}"><div class="callout-header"><span class="callout-icon" aria-hidden="true"></span><span class="callout-title">${label}</span></div><div class="callout-body">`;
  };
  md.renderer.rules.callout_close = () => '</div></div>';

  md.renderer.rules.math_inline = (tokens, index) => {
    return `<span class="math-inline">${renderKatex(tokens[index].content, false)}</span>`;
  };
  md.renderer.rules.math_display = (tokens, index) => {
    return `<div class="math-block">${renderKatex(tokens[index].content, true)}</div>`;
  };

  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const rawSrc = token.attrGet('src') ?? '';
    const src = resolvePreviewAssetSrc(rawSrc, env.documentDirectory);
    const alt = escapeHtml(token.content ?? token.attrGet('alt') ?? '');
    if (!src) {
      return `<span class="image-node-placeholder"><strong>${alt || '图片不可预览'}</strong><span>图片路径不可用</span></span>`;
    }

    token.attrSet('src', src);
    token.attrSet('alt', alt);
    token.attrSet('loading', 'lazy');
    return self.renderToken(tokens, index, options);
  };

  md.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index];
    const info = token.info.trim();
    const language = info.split(/\s+/)[0]?.toLowerCase() || 'text';
    const code = escapeHtml(token.content.replace(/\n$/, ''));

    if (language === 'mermaid') {
      return `<figure class="mermaid-block"><figcaption>Mermaid</figcaption><pre><code>${code}</code></pre></figure>`;
    }

    return `<figure class="code-card"><figcaption>${escapeHtml(language)}</figcaption><pre><code class="language-${escapeHtml(language)}">${code}</code></pre></figure>`;
  };

  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const href = normalizeLinkHref(token.attrGet('href'));
    if (!href) {
      token.attrs = [];
      return '<span class="unsafe-link">';
    }
    token.attrSet('href', href);
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noreferrer noopener');
    return self.renderToken(tokens, index, options);
  };
  md.renderer.rules.link_close = (tokens, index, options, env, self) => {
    const previousOpen = findPreviousOpenToken(tokens, index, 'link_open');
    if (previousOpen && (previousOpen.attrs?.length ?? 0) === 0) {
      return '</span>';
    }
    return self.renderToken(tokens, index, options);
  };

  return md;
}

function parseImageAttrs(state: QuickLookInlineState, silent: boolean) {
  const pos = state.pos;
  if (state.src.charCodeAt(pos) !== 0x7b) return false;

  const prevToken = state.tokens[state.tokens.length - 1];
  if (!prevToken || prevToken.type !== 'image') return false;

  const closeBrace = state.src.indexOf('}', pos + 1);
  if (closeBrace === -1) return false;

  const attrsStr = state.src.slice(pos + 1, closeBrace).trim();
  if (!attrsStr) return false;

  if (!silent) {
    for (const part of attrsStr.split(/\s+/)) {
      const eq = part.indexOf('=');
      if (eq <= 0) continue;
      const key = part.slice(0, eq);
      const value = part.slice(eq + 1);
      if (key === 'width') prevToken.attrSet('width', value);
      if (key === 'height') prevToken.attrSet('height', value);
      if (key === 'align') prevToken.attrJoin('class', `image-align-${value}`);
    }
  }

  state.pos = closeBrace + 1;
  return true;
}

function parseMathInline(state: QuickLookInlineState, silent: boolean) {
  const src = state.src;
  const pos = state.pos;
  if (src.charCodeAt(pos) !== 0x24) return false;
  if (src.charCodeAt(pos + 1) === 0x24) return false;
  if (pos > 0 && src.charCodeAt(pos - 1) === 0x5c) return false;

  let end = pos + 1;
  while (end < src.length) {
    if (src.charCodeAt(end) === 0x24 && src.charCodeAt(end - 1) !== 0x5c) break;
    end++;
  }
  if (end >= src.length || end === pos + 1) return false;

  const tex = src.slice(pos + 1, end).trim().replace(/\\\$/g, '$');
  if (!tex) return false;

  if (!silent) {
    const token = state.push('math_inline', '', 0);
    token.content = tex;
    token.markup = '$';
  }
  state.pos = end + 1;
  return true;
}

function parseMathDisplay(
  state: QuickLookBlockState,
  startLine: number,
  endLine: number,
  silent: boolean,
) {
  const startPos = state.bMarks[startLine] + state.tShift[startLine];
  const lineText = state.src.slice(startPos, state.eMarks[startLine]).trim();
  if (!lineText.startsWith('$$')) return false;

  const singleLineContent = lineText.slice(2);
  if (singleLineContent.endsWith('$$') && singleLineContent.length > 2) {
    const tex = singleLineContent.slice(0, -2).trim();
    if (!tex) return false;
    if (!silent) {
      const token = state.push('math_display', 'math', 0);
      token.content = tex;
      token.markup = '$$';
      token.map = [startLine, startLine + 1];
    }
    state.line = startLine + 1;
    return true;
  }

  const texLines: string[] = [];
  let closeLine = -1;
  for (let line = startLine + 1; line < endLine; line++) {
    const lineStart = state.bMarks[line] + state.tShift[line];
    const text = state.src.slice(lineStart, state.eMarks[line]).trim();
    if (text === '$$') {
      closeLine = line;
      break;
    }
    texLines.push(state.src.slice(state.bMarks[line], state.eMarks[line]));
  }

  if (closeLine === -1) return false;
  if (!silent) {
    const token = state.push('math_display', 'math', 0);
    token.content = texLines.join('\n').trim();
    token.markup = '$$';
    token.map = [startLine, closeLine + 1];
  }
  state.line = closeLine + 1;
  return true;
}

function renderKatex(tex: string, displayMode: boolean) {
  try {
    return katex.renderToString(tex, {
      displayMode,
      output: 'html',
      throwOnError: false,
      trust: false,
    });
  } catch {
    return `<code>${escapeHtml(tex)}</code>`;
  }
}

function renderTaskListItems(html: string) {
  return html.replace(
    /<li>\s*\[([ xX])\]\s*/g,
    (_match, checked: string) =>
      `<li class="task-list-item"><input class="task-checkbox" type="checkbox" disabled${checked.toLowerCase() === 'x' ? ' checked' : ''} aria-label="任务状态"> `,
  );
}

function sanitizePreviewHtml(html: string) {
  if (typeof document === 'undefined') {
    return html;
  }

  const template = document.createElement('template');
  template.innerHTML = html;
  sanitizeNode(template.content);
  return template.innerHTML;
}

function sanitizeNode(node: Node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const element = child as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    if (DISCARD_TAGS.has(tagName)) {
      element.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      element.replaceWith(document.createTextNode(element.textContent ?? ''));
      continue;
    }

    sanitizeElementAttributes(element, tagName);
    sanitizeNode(element);
  }
}

function sanitizeElementAttributes(element: HTMLElement, tagName: string) {
  const allowed = ATTRS_BY_TAG[tagName] ?? new Set<string>();
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name.toLowerCase();
    if (!GLOBAL_ATTRS.has(name) && !allowed.has(name)) {
      element.removeAttribute(attr.name);
      continue;
    }

    if (name.startsWith('on')) {
      element.removeAttribute(attr.name);
      continue;
    }

    if (tagName === 'a' && name === 'href') {
      const href = normalizeLinkHref(attr.value);
      if (!href) {
        element.removeAttribute('href');
      } else {
        element.setAttribute('href', href);
      }
    }

    if (tagName === 'img' && name === 'src' && !resolvePreviewAssetSrc(attr.value)) {
      element.removeAttribute('src');
    }

    if ((tagName === 'td' || tagName === 'th') && name === 'style') {
      const align = /text-align\s*:\s*(left|center|right)/i.exec(attr.value)?.[1];
      if (align) {
        element.setAttribute('style', `text-align: ${align.toLowerCase()}`);
      } else {
        element.removeAttribute('style');
      }
    }
  }
}

function findPreviousOpenToken(tokens: Token[], closeIndex: number, type: string) {
  for (let index = closeIndex - 1; index >= 0; index--) {
    if (tokens[index].type === type) return tokens[index];
  }
  return null;
}

function isAbsoluteFilePath(value: string) {
  return value.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(value);
}

function pathToDirectoryFileUrl(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  return `${pathToFileUrl(normalized)}/`;
}

function pathToFileUrl(path: string) {
  const normalized = path.replace(/\\/g, '/');
  const withLeadingSlash = /^[a-zA-Z]:\//.test(normalized) ? `/${normalized}` : normalized;
  return encodeURI(`file://${withLeadingSlash.startsWith('/') ? '' : '/'}${withLeadingSlash}`);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
