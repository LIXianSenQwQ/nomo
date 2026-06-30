import { Plugin, PluginKey } from 'prosemirror-state';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { EditorSearchMatch } from '../types';

/**
 * 搜索高亮 Decoration Plugin
 *
 * 通过 inline decoration 给所有搜索匹配文本添加背景色高亮，
 * 当前激活的匹配项使用不同样式。
 * 不依赖编辑器 focus 即可显示高亮。
 */

const SEARCH_HIGHLIGHT_KEY = 'searchHighlight';
const SEARCH_HIGHLIGHT_DECORATION_LIMIT = 1000;

export interface SearchHighlightMeta {
  matches: EditorSearchMatch[];
  activeIndex: number;
}

export function searchHighlightPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey(SEARCH_HIGHLIGHT_KEY),
    state: {
      init() {
        return { decorations: DecorationSet.empty };
      },
      apply(tr, value) {
        let { decorations } = value;
        decorations = decorations.map(tr.mapping, tr.doc);

        const meta: SearchHighlightMeta | undefined = tr.getMeta(SEARCH_HIGHLIGHT_KEY);
        if (meta !== undefined) {
          decorations = buildSearchDecorations(tr.doc, meta.matches, meta.activeIndex);
        }

        return { decorations };
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)?.decorations;
      },
    },
  });
}

function buildSearchDecorations(
  doc: ProseMirrorNode,
  matches: EditorSearchMatch[],
  activeIndex: number,
): DecorationSet {
  const decorations: Decoration[] = [];

  for (const match of getVisibleSearchMatches(matches, activeIndex)) {
    const isActive = match.index === activeIndex;
    const className = isActive ? 'search-match-active' : 'search-match';
    decorations.push(
      Decoration.inline(match.from, match.to, {
        class: className,
      }),
    );
  }

  return DecorationSet.create(doc, decorations);
}

function getVisibleSearchMatches(
  matches: EditorSearchMatch[],
  activeIndex: number,
): EditorSearchMatch[] {
  if (matches.length <= SEARCH_HIGHLIGHT_DECORATION_LIMIT) {
    return matches;
  }

  if (activeIndex < 0 || activeIndex >= matches.length) {
    return matches.slice(0, SEARCH_HIGHLIGHT_DECORATION_LIMIT);
  }

  const halfWindow = Math.floor(SEARCH_HIGHLIGHT_DECORATION_LIMIT / 2);
  const start = Math.min(
    Math.max(0, activeIndex - halfWindow),
    matches.length - SEARCH_HIGHLIGHT_DECORATION_LIMIT,
  );
  return matches.slice(start, start + SEARCH_HIGHLIGHT_DECORATION_LIMIT);
}
