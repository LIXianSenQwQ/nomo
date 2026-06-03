import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { schema } from '../schema';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const taskListPluginKey = new PluginKey('taskList');

export function taskListPlugin(): Plugin {
  return new Plugin({
    key: taskListPluginKey,
    state: {
      init(_, state) {
        return buildTaskDecorations(state.doc);
      },
      apply(tr, oldSet, _oldState, newState) {
        if (!tr.docChanged) return oldSet;
        return buildTaskDecorations(newState.doc);
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
      handleDOMEvents: {
        mousedown(view, event) {
          const target = event.target as HTMLElement;
          const widget = target.closest('[data-task-from]') as HTMLElement | null;
          if (!widget) return false;
          event.preventDefault();
          event.stopPropagation();
          const from = Number(widget.dataset.taskFrom);
          const to = Number(widget.dataset.taskTo);
          if (Number.isNaN(from) || Number.isNaN(to)) return false;
          const oldText = view.state.doc.textBetween(from, to);
          const newText = oldText === '[x]' ? '[ ]' : '[x]';
          view.dispatch(view.state.tr.replaceWith(from, to, schema.text(newText)));
          return true;
        },
      },
    },
  });
}

function buildTaskDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const text = node.text;
    if (!text) return;
    const match = text.match(/^\[([ x])\](.*)/);
    if (!match) return;
    const $pos = doc.resolve(pos);
    let inListItem = false;
    for (let i = $pos.depth; i >= 0; i--) {
      if ($pos.node(i).type.name === 'list_item') {
        inListItem = true;
        break;
      }
    }
    if (!inListItem) return;
    const checked = match[1] === 'x';
    const bracketStart = pos;
    const bracketEnd = pos + 3;
    const widget = createTaskCheckboxWidget(checked, bracketStart, bracketEnd);
    decorations.push(Decoration.widget(bracketStart, widget));
    decorations.push(
      Decoration.inline(
        bracketStart,
        bracketEnd,
        { style: 'display: none;' },
        { inclusiveStart: false, inclusiveEnd: false },
      ),
    );
  });
  return DecorationSet.create(doc, decorations);
}

function createTaskCheckboxWidget(checked: boolean, from: number, to: number): HTMLElement {
  const span = document.createElement('span');
  span.className = 'task-checkbox-widget';
  span.setAttribute('contenteditable', 'false');
  span.dataset.taskFrom = String(from);
  span.dataset.taskTo = String(to);
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.setAttribute('tabindex', '-1');
  span.appendChild(input);
  return span;
}
