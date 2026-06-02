// [LEGACY] 本文件已被 math_block 语义节点 + MathBlockNodeView + displayMathInputPlugin 取代。
// 保留作为参考，不再被 ProseMirrorEditorCore 导入。
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { getMathRenderer } from '../renderers';

export const mathBlockKey = new PluginKey('mathBlock');

interface MathMatch {
  from: number;
  to: number;
  tex: string;
  displayMode: boolean;
}

export function mathBlockPlugin(): Plugin {
  return new Plugin({
    key: mathBlockKey,
    state: {
      init() { return DecorationSet.empty; },
      apply(tr, set) {
        const meta = tr.getMeta(mathBlockKey);
        if (meta instanceof DecorationSet) return meta;
        return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
      }
    },
    view(editorView) {
      scheduleMathRender(editorView);
      return { update() {}, destroy() {} };
    },
    props: {
      decorations(state) { return this.getState(state); }
    }
  });
}

function scheduleMathRender(view: EditorView): void {
  requestAnimationFrame(() => renderMathBlocks(view));
}

async function renderMathBlocks(view: EditorView): Promise<void> {
  const mathRenderer = getMathRenderer();
  if (!mathRenderer) return;
  const matches = findAllMathMatches(view.state.doc);
  if (matches.length === 0) {
    view.dispatch(view.state.tr.setMeta(mathBlockKey, DecorationSet.empty));
    return;
  }
  const decorations: Decoration[] = [];
  for (const match of matches) {
    decorations.push(Decoration.inline(match.from, match.to, { style: 'display: none' }, { inclusiveStart: false, inclusiveEnd: false }));
    try {
      const result = await mathRenderer.render(match.tex, { displayMode: match.displayMode });
      const widget = createMathWidget(result.html, result.error, match.displayMode);
      decorations.push(Decoration.widget(match.from, widget, { side: 0 }));
    } catch {
      const widget = createMathWidget('', 'KaTeX error', match.displayMode);
      decorations.push(Decoration.widget(match.from, widget, { side: 0 }));
    }
  }
  const decoSet = DecorationSet.create(view.state.doc, decorations);
  view.dispatch(view.state.tr.setMeta(mathBlockKey, decoSet));
}

function findAllMathMatches(doc: ProseMirrorNode): MathMatch[] {
  const matches: MathMatch[] = [];
  const topBlocks: Array<{ node: ProseMirrorNode; pos: number }> = [];
  doc.forEach((node, offset) => { topBlocks.push({ node, pos: offset }); });
  let i = 0;
  while (i < topBlocks.length) {
    const displayResult = tryMatchDisplayMath(topBlocks, i);
    if (displayResult) {
      matches.push(displayResult.match);
      i = displayResult.nextIndex;
      continue;
    }
    i += 1;
  }
  return matches;
}

function tryMatchDisplayMath(blocks: Array<{ node: ProseMirrorNode; pos: number }>, startIndex: number): { match: MathMatch; nextIndex: number } | null {
  const first = blocks[startIndex];
  if (first.node.type.name !== 'paragraph') return null;
  const firstText = first.node.textContent.trim();
  if (firstText !== '$$') return null;
  const texLines: string[] = [];
  let foundClose = false;
  let closeIndex = startIndex + 1;
  for (let index = startIndex + 1; index < blocks.length; index++) {
    const block = blocks[index];
    if (block.node.type.name !== 'paragraph') break;
    const text = block.node.textContent.trim();
    if (text === '$$') {
      foundClose = true;
      closeIndex = index;
      break;
    }
    texLines.push(block.node.textContent);
  }
  if (!foundClose) return null;
  const from = blocks[startIndex].pos;
  const to = blocks[closeIndex].pos + blocks[closeIndex].node.nodeSize;
  return { match: { from, to, tex: texLines.join('\n'), displayMode: true }, nextIndex: closeIndex + 1 };
}

function createMathWidget(html: string, error: string | undefined, displayMode: boolean): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = displayMode ? 'math-widget math-display' : 'math-widget math-inline';
  wrapper.setAttribute('contenteditable', 'false');
  if (error) {
    wrapper.style.color = 'var(--md-editor-warning, #9a6700)';
    wrapper.style.fontSize = '13px';
    wrapper.textContent = error;
  } else {
    wrapper.innerHTML = html;
  }
  return wrapper;
}
