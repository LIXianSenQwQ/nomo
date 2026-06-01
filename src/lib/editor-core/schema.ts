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
      }
    }),
  marks: markdownSchema.spec.marks
});
