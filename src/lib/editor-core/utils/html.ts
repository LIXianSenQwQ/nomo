export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function sanitizeHtml(html: string): string {
  if (/<script\b/i.test(html) || /<iframe\b/i.test(html) || /\bon\w+\s*=/i.test(html)) {
    return escapeHtml(html);
  }
  return html;
}
