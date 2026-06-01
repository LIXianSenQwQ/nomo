import { Schema } from 'prosemirror-model';
import { schema as markdownSchema } from 'prosemirror-markdown';
import { tableNodes } from 'prosemirror-tables';

export type TableColumnAlignment = 'left' | 'center' | 'right';

function readCellAlignment(dom: HTMLElement): TableColumnAlignment | null {
  const value = dom.style.textAlign || dom.getAttribute('data-align');
  return value === 'left' || value === 'center' || value === 'right' ? value : null;
}

export const schema = new Schema({
  nodes: markdownSchema.spec.nodes.append(
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
  ),
  marks: markdownSchema.spec.marks
});
