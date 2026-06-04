import type { Node as ProseMirrorNode } from 'prosemirror-model';

/**
 * 将 html_block ProseMirror 节点序列化为 HTML 字符串。
 */
export function serializeHtmlBlock(node: ProseMirrorNode): string {
  const { tag, class: cls, id } = node.attrs;
  const attrStr = buildAttrString(cls as string | null, id as string | null);
  const inner = serializeInlineContent(node);
  return `<${tag}${attrStr}>${inner}</${tag}>`;
}

function buildAttrString(cls?: string | null, id?: string | null): string {
  const parts: string[] = [];
  if (cls) parts.push(`class="${cls}"`);
  if (id) parts.push(`id="${id}"`);
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function serializeInlineContent(node: ProseMirrorNode): string {
  const parts: string[] = [];
  node.forEach((child) => {
    if (child.isText) {
      parts.push(wrapTextWithMarks(child));
    }
  });
  return parts.join('');
}

function wrapTextWithMarks(textNode: ProseMirrorNode): string {
  let text = escapeHtml(textNode.text ?? '');
  for (const mark of textNode.marks) {
    switch (mark.type.name) {
      case 'strong':
        text = `<strong>${text}</strong>`;
        break;
      case 'em':
        text = `<em>${text}</em>`;
        break;
      case 'code':
        text = `<code>${text}</code>`;
        break;
      case 'strikethrough':
        text = `<s>${text}</s>`;
        break;
      case 'underline':
        text = `<u>${text}</u>`;
        break;
      case 'link': {
        const href = mark.attrs.href ?? '';
        const title = mark.attrs.title ? ` title="${mark.attrs.title}"` : '';
        text = `<a href="${href}"${title}>${text}</a>`;
        break;
      }
    }
  }
  return text;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
