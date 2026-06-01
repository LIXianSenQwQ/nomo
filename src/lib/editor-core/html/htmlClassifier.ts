import { EDITABLE_BLOCK_TAGS, EDITABLE_INLINE_TAGS, DANGEROUS_TAGS } from './htmlPolicy';

export interface HtmlBlockClassification {
  editable: boolean;
  /** 块级标签名 */
  tag?: string;
  /** 开闭标签之间的 HTML 内容 */
  innerHTML?: string;
  /** 提取的属性 */
  attrs?: Record<string, string>;
}

/**
 * 判断 rawHtml 是否只包含允许标签和允许属性，返回分类结果。
 * rawHtml 是 markdown-it html_block token 的 content（含开闭标签的完整 HTML）。
 */
export function classifyHtmlBlock(rawHtml: string): HtmlBlockClassification {
  const trimmed = rawHtml.trim();
  if (!trimmed) return { editable: false };

  // 步骤1：提取根标签和属性
  const rootMatch = /^<(\w+)([^>]*)>/.exec(trimmed);
  if (!rootMatch) return { editable: false };

  const rootTag = rootMatch[1].toLowerCase();
  const rootAttrsStr = rootMatch[2];

  // 步骤2：根标签必须在允许列表中
  if (!EDITABLE_BLOCK_TAGS.has(rootTag)) return { editable: false };

  // 步骤3：检查所有标签名是否在允许集合内
  const allTags = extractTagNames(trimmed);
  for (const tag of allTags) {
    const lower = tag.toLowerCase();
    if (DANGEROUS_TAGS.has(lower)) return { editable: false };
    // 只能是根标签或允许的内联标签
    if (lower !== rootTag && !EDITABLE_INLINE_TAGS.has(lower)) return { editable: false };
  }

  // 步骤4：提取 innerHTML（开闭标签之间的内容）
  const closingTagRegex = new RegExp(`</${rootTag}\\s*>$`);
  const closingMatch = closingTagRegex.exec(trimmed);
  if (!closingMatch) {
    // 自闭合或无闭标签 — 不可编辑
    return { editable: false };
  }
  const innerStart = rootMatch[0].length;
  const innerEnd = trimmed.length - closingMatch[0].length;
  const innerHTML = trimmed.slice(innerStart, innerEnd);

  // 步骤5：检查整个 HTML 中是否有危险属性（不仅是根标签）
  if (hasDangerousAttrs(trimmed)) return { editable: false };

  // 提取允许属性
  const attrs = extractAllowedAttrs(rootAttrsStr);

  return { editable: true, tag: rootTag, innerHTML, attrs };
}

/** 从 HTML 字符串中提取所有标签名 */
function extractTagNames(html: string): string[] {
  const tags: string[] = [];
  const regex = /<\/?([a-zA-Z][a-zA-Z0-9]*)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    tags.push(match[1]);
  }
  return tags;
}

/** 检查属性中是否包含 on* 事件处理器等危险内容 */
function hasDangerousAttrs(html: string): boolean {
  return /\bon\w+\s*=/i.test(html) || /javascript\s*:/i.test(html) || /data:text\/html/i.test(html);
}

/** 从属性字符串中提取允许的属性 */
function extractAllowedAttrs(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (!attrStr.trim()) return attrs;

  const classMatch = /class="([^"]*)"/i.exec(attrStr);
  if (classMatch) attrs.class = classMatch[1];

  const idMatch = /id="([^"]*)"/i.exec(attrStr);
  if (idMatch) attrs.id = idMatch[1];

  return attrs;
}

/** 从内联 HTML 开标签中提取属性（用于 html_inline handler） */
export function extractInlineAttrs(rawTag: string, tagName: string): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};

  const classMatch = /class="([^"]*)"/i.exec(rawTag);
  if (classMatch) attrs.class = classMatch[1];

  const idMatch = /id="([^"]*)"/i.exec(rawTag);
  if (idMatch) attrs.id = idMatch[1];

  const hrefMatch = /href="([^"]*)"/i.exec(rawTag);
  if (hrefMatch) attrs.href = hrefMatch[1];

  const titleMatch = /title="([^"]*)"/i.exec(rawTag);
  if (titleMatch) attrs.title = titleMatch[1];

  return attrs;
}
