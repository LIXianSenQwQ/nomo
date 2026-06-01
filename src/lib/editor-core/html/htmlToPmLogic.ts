import type { Schema } from 'prosemirror-model';
import { INLINE_TAG_TO_MARK } from './htmlPolicy';

/**
 * 在 MarkdownParseState 上下文中遍历 DOM 片段，调用 openMark/addText/closeMark。
 * 此函数在 parser handler 内部使用，不直接创建 ProseMirror Node。
 */
export function parseHtmlContent(
  state: { openMark(mark: unknown): void; closeMark(markType: unknown): void; addText(text: string): void },
  innerHTML: string,
  schema: Schema
): void {
  const template = document.createElement('template');
  template.innerHTML = innerHTML;
  walkDOMFragment(state, template.content, schema);
}

function walkDOMFragment(
  state: { openMark(mark: unknown): void; closeMark(markType: unknown): void; addText(text: string): void },
  parent: Node,
  schema: Schema
): void {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      state.addText(child.textContent ?? '');
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const markName = INLINE_TAG_TO_MARK[tag];

      if (markName) {
        const markType = (schema.marks as Record<string, { create(attrs?: Record<string, unknown> | null): unknown }>)[markName];
        if (markType) {
          let attrs: Record<string, unknown> | null = null;
          if (markName === 'link') {
            attrs = {
              href: el.getAttribute('href') ?? '',
              title: el.getAttribute('title') ?? null
            };
          }
          const mark = markType.create(attrs);
          state.openMark(mark);
          // 直接遍历子节点，text 节点 addText，元素节点递归
          for (const grandchild of Array.from(el.childNodes)) {
            if (grandchild.nodeType === Node.TEXT_NODE) {
              state.addText(grandchild.textContent ?? '');
            } else if (grandchild.nodeType === Node.ELEMENT_NODE) {
              walkDOMFragment(state, grandchild, schema);
            }
          }
          state.closeMark(markType);
          continue;
        }
      }

      if (tag === 'br') {
        state.addText('\n');
      } else {
        // 未知内联元素（如 span）— 递归处理子节点
        for (const grandchild of Array.from(el.childNodes)) {
          if (grandchild.nodeType === Node.TEXT_NODE) {
            state.addText(grandchild.textContent ?? '');
          } else if (grandchild.nodeType === Node.ELEMENT_NODE) {
            walkDOMFragment(state, grandchild, schema);
          }
        }
      }
    }
  }
}
