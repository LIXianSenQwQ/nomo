/** 可编辑 HTML 块的标签/属性白名单 */

/** 支持的可编辑块级标签 */
export const EDITABLE_BLOCK_TAGS: ReadonlySet<string> = new Set(['section', 'div']);

/** 支持的内联标签（将映射到 ProseMirror mark 或原样保留） */
export const EDITABLE_INLINE_TAGS: ReadonlySet<string> = new Set([
  'span',
  'strong',
  'em',
  'a',
  'code',
  's',
  'del',
  'strike',
  'u',
]);

/** 允许保留的 HTML 属性 */
export const ALLOWED_ATTRS: ReadonlySet<string> = new Set(['class', 'id', 'href', 'title']);

/** 危险标签 — 出现则强制走 fallback */
export const DANGEROUS_TAGS: ReadonlySet<string> = new Set([
  'script',
  'style',
  'iframe',
  'form',
  'input',
  'button',
  'svg',
  'object',
  'embed',
  'base',
  'link',
  'meta',
  'noscript',
  'frame',
  'frameset',
]);

/** 内联标签到 ProseMirror mark 类型的映射 */
export const INLINE_TAG_TO_MARK: Record<string, string> = {
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
