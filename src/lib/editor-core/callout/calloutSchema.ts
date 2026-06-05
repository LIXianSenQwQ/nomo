/** Callout ProseMirror 节点定义 */

import type { NodeSpec } from 'prosemirror-model';

/**
 * callout 节点 spec
 * - group: block，可出现在任何 block 节点出现的位置
 * - content: block+，内部支持段落、列表、代码块、图片、表格等
 * - defining: true，保证 lift/unwrap 时保留内部结构
 * - attrs.type: callout 类型字符串
 */
export const calloutNodeSpec: NodeSpec = {
  group: 'block',
  content: 'block+',
  defining: true,
  attrs: {
    type: { default: 'note' },
  },
  parseDOM: [
    {
      tag: 'div.callout-card',
      getAttrs(dom: string | Node) {
        if (typeof dom === 'string') return false;
        const el = dom as HTMLElement;
        return { type: el.dataset.calloutType ?? 'note' };
      },
    },
  ],
  toDOM(node) {
    return [
      'div',
      {
        class: 'callout-card',
        'data-callout-type': node.attrs.type,
      },
      0, // contentDOM 插槽
    ];
  },
};
