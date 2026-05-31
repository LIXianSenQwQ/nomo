/**
 * Markdown 文本规范化函数。
 * 提供文件保存前的尾空行补全等规范化处理。
 */

/**
 * 确保 Markdown 文本以两个换行结尾，保证编辑器光标有可编辑的最后一行。
 */
export function normalizeMarkdownForSave(markdown: string): string {
  return markdown.endsWith('\n\n') ? markdown : `${markdown.replace(/\s*$/, '')}\n\n`;
}
