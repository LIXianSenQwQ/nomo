import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { CodeTokenLine } from '../../services/render';

export const codeHighlightKey = new PluginKey('codeHighlight');

export function codeHighlightPlugin(): Plugin {
  return new Plugin({
    key: codeHighlightKey,
    state: {
      init() { return DecorationSet.empty; },
      apply(tr, set) {
        const meta = tr.getMeta(codeHighlightKey);
        if (meta instanceof DecorationSet) return meta;
        return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
      }
    },
    props: {
      decorations(state) { return this.getState(state); }
    }
  });
}

export function buildCodeDecorations(tokenLines: CodeTokenLine[], contentStart: number): Decoration[] {
  const decorations: Decoration[] = [];
  let pos = contentStart;
  for (const line of tokenLines) {
    for (const token of line.tokens) {
      const len = token.content.length;
      if (token.color && len > 0) {
        decorations.push(Decoration.inline(pos, pos + len, { style: `color: ${token.color}` }));
      }
      pos += len;
    }
    pos += 1;
  }
  return decorations;
}
