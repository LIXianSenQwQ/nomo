import { Schema } from 'prosemirror-model';
import { schema as markdownSchema } from 'prosemirror-markdown';
import { tableNodes } from 'prosemirror-tables';
import { calloutNodeSpec } from './callout/calloutSchema';

export type TableColumnAlignment = 'left' | 'center' | 'right';

function readCellAlignment(dom: HTMLElement): TableColumnAlignment | null {
  const value = dom.style.textAlign || dom.getAttribute('data-align');
  return value === 'left' || value === 'center' || value === 'right' ? value : null;
}

export const schema = new Schema({
  nodes: markdownSchema.spec.nodes
    .append(
      tableNodes({
        tableGroup: 'block',
        cellContent: 'paragraph+',
        cellAttributes: {
          align: {
            default: null,
            getFromDOM: readCellAlignment,
            setDOMAttr(value, attrs) {
              if (value === 'left' || value === 'center' || value === 'right') {
                attrs['data-align'] = value;
                attrs.style = `${attrs.style ? `${attrs.style}; ` : ''}text-align: ${value}`;
              }
            },
          },
        },
      }),
    )
    .append({
      math_inline: {
        inline: true,
        group: 'inline',
        atom: true,
        selectable: true,
        draggable: false,
        attrs: {
          tex: { default: '' },
        },
        toDOM(node) {
          const tex = node.attrs.tex as string;
          return ['span', { class: 'math-inline', 'data-tex': tex }, `$${tex}$`];
        },
        parseDOM: [
          {
            tag: 'span.math-inline',
            getAttrs(dom) {
              const el = dom as HTMLElement;
              const tex = el.getAttribute('data-tex') ?? el.textContent ?? '';
              return { tex: tex.startsWith('$') && tex.endsWith('$') ? tex.slice(1, -1) : tex };
            },
          },
        ],
      },
      html_block: {
        content: 'inline*',
        group: 'block',
        defining: true,
        attrs: {
          tag: { default: 'div' },
          class: { default: null },
          id: { default: null },
        },
        toDOM(node) {
          const { tag, class: cls, id } = node.attrs;
          const domAttrs: Record<string, string> = {};
          if (cls) domAttrs.class = cls;
          if (id) domAttrs.id = id;
          return [tag, domAttrs, 0];
        },
      },
      // 行内代码（inline code）：`code` 语法
      inline_code: {
        inline: true,
        group: 'inline',
        atom: true,
        selectable: true,
        draggable: false,
        attrs: {
          code: { default: '' },
        },
        toDOM(node) {
          const code = node.attrs.code as string;
          return ['span', { class: 'inline-code', 'data-code': code }, `\`${code}\``];
        },
        parseDOM: [
          {
            tag: 'span.inline-code',
            getAttrs(dom) {
              const el = dom as HTMLElement;
              const code = el.getAttribute('data-code') ?? el.textContent ?? '';
              return {
                code: code.startsWith('`') && code.endsWith('`') ? code.slice(1, -1) : code,
              };
            },
          },
        ],
      },
      footnote_ref: {
        inline: true,
        group: 'inline',
        atom: true,
        selectable: false,
        draggable: false,
        attrs: {
          id: { default: '' },
        },
        toDOM(node) {
          const id = node.attrs.id as string;
          return ['sup', { class: 'footnote-ref', 'data-footnote-id': id }, id];
        },
        parseDOM: [
          {
            tag: 'sup.footnote-ref',
            getAttrs(dom) {
              const el = dom as HTMLElement;
              return { id: el.getAttribute('data-footnote-id') ?? '' };
            },
          },
        ],
      },
      footnote_def: {
        content: 'inline*',
        group: 'block',
        defining: true,
        attrs: {
          id: { default: '' },
        },
        toDOM(node) {
          const id = node.attrs.id as string;
          return [
            'div',
            { class: 'footnote-def', 'data-footnote-id': id },
            ['span', { class: 'footnote-def-marker' }, id],
            ['span', { class: 'footnote-def-content' }, 0],
          ];
        },
        parseDOM: [
          {
            tag: 'div.footnote-def',
            getAttrs(dom) {
              const el = dom as HTMLElement;
              return { id: el.getAttribute('data-footnote-id') ?? '' };
            },
          },
        ],
      },
      // 跨行公式块（display math）：$$...$$ 语法
      callout: calloutNodeSpec,
      toc_block: {
        atom: true,
        selectable: true,
        draggable: false,
        group: 'block',
        attrs: {
          content: { default: '' },
        },
        toDOM(node) {
          return ['div', { class: 'toc-block', 'data-content': node.attrs.content }, '目录'];
        },
      },
      math_block: {
        atom: true,
        selectable: true,
        draggable: false,
        group: 'block',
        attrs: {
          tex: { default: '' },
        },
        toDOM(node) {
          const tex = node.attrs.tex as string;
          return ['div', { class: 'math-block', 'data-tex': tex }, `$$\n${tex}\n$$`];
        },
        parseDOM: [
          {
            tag: 'div.math-block',
            getAttrs(dom) {
              const el = dom as HTMLElement;
              const tex = el.getAttribute('data-tex') ?? el.textContent ?? '';
              return { tex };
            },
          },
        ],
      },
      mermaid_block: {
        atom: true,
        selectable: true,
        draggable: false,
        group: 'block',
        attrs: {
          code: { default: '' },
        },
        toDOM(node) {
          const code = node.attrs.code as string;
          return ['div', { class: 'mermaid-block', 'data-code': code }, code];
        },
        parseDOM: [
          {
            tag: 'div.mermaid-block',
            getAttrs(dom) {
              const el = dom as HTMLElement;
              return { code: el.getAttribute('data-code') ?? el.textContent ?? '' };
            },
          },
        ],
      },
    }),
  marks: markdownSchema.spec.marks.append({
    strikethrough: {
      parseDOM: [
        { tag: 's' },
        { tag: 'del' },
        { tag: 'strike' },
        { style: 'text-decoration=line-through' },
      ],
      toDOM() {
        return ['s', 0];
      },
    },
    underline: {
      parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
      toDOM() {
        return ['u', 0];
      },
    },
    highlight: {
      parseDOM: [{ tag: 'mark' }],
      toDOM() {
        return ['mark', 0];
      },
    },
  }),
});
