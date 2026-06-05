/** Callout 序列化：ProseMirror 节点 → GitHub Alert Markdown */

import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { MarkdownSerializerState } from 'prosemirror-markdown';

/**
 * callout 节点序列化器。
 * 输出格式：
 *   > [!TYPE]
 *   > 第一段内容
 *   >
 *   > 第二段内容
 *
 * 复用 blockquote 的 wrapBlock 逻辑（自动加 `> ` 前缀）。
 */
export function serializeCallout(state: MarkdownSerializerState, node: ProseMirrorNode): void {
  const calloutType = (node.attrs.type as string).toUpperCase();

  // 使用 wrapBlock 为每行添加 `> ` 前缀（和 blockquote 一致）
  state.wrapBlock('> ', null, node, () => {
    // 第一行输出 [!TYPE] 标记
    state.write(`[!${calloutType}]\n`);
    // 渲染子内容（会被 wrapBlock 自动加 `> ` 前缀）
    state.renderContent(node);
  });
}
