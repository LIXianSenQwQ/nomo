import { Schema } from 'prosemirror-model';
import { schema as markdownSchema } from 'prosemirror-markdown';
import { tableNodes } from 'prosemirror-tables';

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
            }
          }
        }
      })
    )
    .append({
      math_inline: {
        inline: true,
        group: 'inline',
        atom: true,
        selectable: true,
        draggable: false,
        attrs: {
          tex: { default: '' }
        },
        toDOM(node) {
          const tex = node.attrs.tex as string;
          return ['span', { class: 'math-inline', 'data-tex': tex }, `$${tex}$`];
        },
        parseDOM: [{
          tag: 'span.math-inline',
          getAttrs(dom) {
            const el = dom as HTMLElement;
            const tex = el.getAttribute('data-tex') ?? el.textContent ?? '';
            return { tex: tex.startsWith('$') && tex.endsWith('$') ? tex.slice(1, -1) : tex };
          }
        }]
      },
      html_block: {
        content: 'inline*',
        group: 'block',
        defining: true,
        attrs: {
          tag: { default: 'div' },
          class: { default: null },
          id: { default: null }
        },
        toDOM(node) {
          const { tag, class: cls, id } = node.attrs;
          const domAttrs: Record<string, string> = {};
          if (cls) domAttrs.class = cls;
          if (id) domAttrs.id = id;
          return [tag, domAttrs, 0];
        }
      },
      // 跨行公式块（display math）：$$...$$ 语法
      math_block: {
        atom: true,
        selectable: true,
        draggable: false,
        group: 'block',
        attrs: {
          tex: { default: '' }
        },
        toDOM(node) {
          const tex = node.attrs.tex as string;
          return ['div', { class: 'math-block', 'data-tex': tex }, `$$\n${tex}\n$$`];
        },
        parseDOM: [{
          tag: 'div.math-block',
          getAttrs(dom) {
            const el = dom as HTMLElement;
            const tex = el.getAttribute('data-tex') ?? el.textContent ?? '';
            return { tex };
          }
        }]
      }
    }),
  marks: markdownSchema.spec.marks
});
