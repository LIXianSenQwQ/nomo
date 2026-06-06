const DISALLOWED_LINK_PROTOCOLS = /^(?:javascript|vbscript|data)\s*:/i;
const ALLOWED_ABSOLUTE_LINK_PROTOCOLS = /^(?:https?|mailto):/i;
const WINDOWS_DRIVE_PATH = /^[a-zA-Z]:[\\/]/;

export interface NormalizedLinkAttrs {
  href: string;
  title: string | null;
}

/**
 * 校验并规范化 Markdown 超链接地址。
 *
 * 超链接是 Markdown-first 的行内语义：允许 Web、邮件、锚点和相对路径，
 * 拒绝脚本协议，避免语义编辑区和 HTML 适配层出现不同的安全边界。
 */
export function normalizeLinkHref(value: unknown): string | null {
  const href = String(value ?? '').trim();
  if (!href) return null;
  if (DISALLOWED_LINK_PROTOCOLS.test(href)) return null;

  const protocolMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(href);
  if (protocolMatch) {
    if (WINDOWS_DRIVE_PATH.test(href)) return href;
    return ALLOWED_ABSOLUTE_LINK_PROTOCOLS.test(href) ? href : null;
  }

  return href;
}

export function createLinkAttrs(href: unknown, title?: unknown): NormalizedLinkAttrs | null {
  const normalizedHref = normalizeLinkHref(href);
  if (!normalizedHref) return null;

  const normalizedTitle = normalizeLinkTitle(title);
  return {
    href: normalizedHref,
    title: normalizedTitle,
  };
}

export function normalizeLinkTitle(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const title = String(value).trim();
  return title ? title : null;
}

export function canOpenLinkHref(value: unknown): boolean {
  return normalizeLinkHref(value) !== null;
}

export function serializeMarkdownLinkDestination(href: string): string {
  return href.replace(/\\/g, '\\\\').replace(/\)/g, '\\)');
}

export function serializeMarkdownLinkTitle(title: string): string {
  return title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
