import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { wrapIn } from 'prosemirror-commands';
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { schema } from '../schema';

export const blockquoteInputKey = new PluginKey('blockquoteInput');

export function blockquoteInputPlugin(): Plugin {
  let ignoreInputUntilNextTask = false;
  let armedForCompositionCleanup = false;
  let activeComposition = false;
  let latestCommittedCompositionText = '';

  return new Plugin({
    key: blockquoteInputKey,
    props: {
      handleDOMEvents: {
        keydown(view, event) {
          if (ignoreInputUntilNextTask || !isPlainSpaceKey(event)) return false;
          if (view.composing || event.isComposing) return false;

          const tr = createBlockquoteInputTransaction(view.state);
          if (!tr) return false;

          event.preventDefault();
          view.dispatch(tr.scrollIntoView());
          armedForCompositionCleanup = true;
          return true;
        },
        beforeinput(view, event) {
          rememberCommittedCompositionText(event);
          if (ignoreInputUntilNextTask || !isPlainSpaceInput(event)) return false;
          if (view.composing || event.isComposing) return false;

          const tr = createBlockquoteInputTransaction(view.state);
          if (!tr) return false;

          event.preventDefault();
          view.dispatch(tr.scrollIntoView());
          armedForCompositionCleanup = true;
          return true;
        },
        compositionstart(view) {
          activeComposition = armedForCompositionCleanup && isInEmptyBlockquoteParagraph(view.state);
          armedForCompositionCleanup = false;
          latestCommittedCompositionText = '';
          return false;
        },
        compositionupdate(_view, event) {
          rememberCommittedCompositionText(event);
          return false;
        },
        compositionend(view, event) {
          rememberCommittedCompositionText(event);
          const shouldCleanup = activeComposition;
          activeComposition = false;
          ignoreInputUntilNextTask = true;
          setTimeout(() => {
            if (shouldCleanup) {
              cleanupDuplicatedCompositionText(view, latestCommittedCompositionText);
            }
            ignoreInputUntilNextTask = false;
          }, 0);
          setTimeout(() => {
            if (shouldCleanup) {
              cleanupDuplicatedCompositionText(view, latestCommittedCompositionText);
            }
            latestCommittedCompositionText = '';
          }, 120);
          return false;
        },
      },
    },
  });

  function rememberCommittedCompositionText(event: Event): void {
    const text = readEventData(event);
    if (text && containsHan(text)) {
      latestCommittedCompositionText = text;
    }
  }
}

function isPlainSpaceInput(event: Event): event is InputEvent {
  if (typeof InputEvent === 'undefined' || !(event instanceof InputEvent)) return false;
  return event.inputType === 'insertText' && event.data === ' ';
}

function isPlainSpaceKey(event: Event): event is KeyboardEvent {
  if (typeof KeyboardEvent === 'undefined' || !(event instanceof KeyboardEvent)) return false;
  return event.key === ' ' || event.key === 'Spacebar';
}

function readEventData(event: Event): string {
  return 'data' in event && typeof event.data === 'string' ? event.data : '';
}

function containsHan(text: string): boolean {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(text);
}

function isInEmptyBlockquoteParagraph(state: EditorState): boolean {
  const { selection } = state;
  if (!selection.empty || !(selection instanceof TextSelection)) return false;

  const { $from } = selection;
  if ($from.parent.type !== schema.nodes.paragraph || $from.parent.content.size !== 0) {
    return false;
  }

  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    if ($from.node(depth).type === schema.nodes.blockquote) return true;
  }
  return false;
}

export function createBlockquoteInputTransaction(state: EditorState): Transaction | null {
  const { selection } = state;
  if (!selection.empty || !(selection instanceof TextSelection)) return null;

  const { $from } = selection;
  if ($from.parent.type !== schema.nodes.paragraph) return null;
  if ($from.parentOffset !== $from.parent.content.size) return null;
  if ($from.parent.textBetween(0, $from.parentOffset) !== '>') return null;

  const tr = state.tr.delete($from.start(), $from.pos);
  let capturedTr: Transaction | null = null;
  const handled = wrapIn(schema.nodes.blockquote)(state.apply(tr), (nextTr) => {
    capturedTr = nextTr;
  });
  const wrappedTr = capturedTr as Transaction | null;
  if (!handled || !wrappedTr) return null;

  for (const step of wrappedTr.steps) {
    tr.step(step);
  }
  tr.setSelection(
    TextSelection.near(tr.doc.resolve(clampDocPosition(tr.doc, wrappedTr.selection.anchor))),
  );
  return tr;
}

function clampDocPosition(doc: ProseMirrorNode, position: number): number {
  return Math.max(0, Math.min(position, doc.content.size));
}

function cleanupDuplicatedCompositionText(view: EditorView, finalText: string): void {
  const quote = findRelevantBlockquote(view.state, finalText);
  if (!quote) return;

  const target = findTargetParagraph(quote.node, finalText);
  if (!target) return;

  if (target.index > 0) {
    cleanupDuplicatedPreviousParagraphs(view, quote, target);
    return;
  }

  cleanupDuplicatedPrefix(view, quote, target, finalText);
}

function findRelevantBlockquote(
  state: EditorState,
  finalText: string,
): { node: ProseMirrorNode; pos: number } | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type === schema.nodes.blockquote) {
      return { node: $from.node(depth), pos: $from.before(depth) };
    }
  }

  let found: { node: ProseMirrorNode; pos: number } | null = null;
  state.doc.descendants((node, pos) => {
    const matchesTarget = finalText
      ? node.textContent.includes(finalText)
      : containsHan(node.textContent);
    if (node.type === schema.nodes.blockquote && matchesTarget) {
      found = { node, pos };
      return false;
    }
    return true;
  });
  return found;
}

function findTargetParagraph(
  blockquote: ProseMirrorNode,
  finalText: string,
): { node: ProseMirrorNode; index: number; offset: number } | null {
  let found: { node: ProseMirrorNode; index: number; offset: number } | null = null;
  blockquote.forEach((node, offset, index) => {
    const matchesTarget = finalText
      ? node.textContent.includes(finalText)
      : containsHan(node.textContent);
    if (!found && node.type === schema.nodes.paragraph && matchesTarget) {
      found = { node, index, offset };
    }
  });
  return found;
}

function cleanupDuplicatedPreviousParagraphs(
  view: EditorView,
  quote: { node: ProseMirrorNode; pos: number },
  target: { index: number; offset: number },
): void {
  let sawCompositionText = false;
  for (let index = 0; index < target.index; index += 1) {
    const text = quote.node.child(index).textContent;
    if (isAsciiCompositionText(text)) {
      sawCompositionText = true;
      continue;
    }
    if (text.length === 0) continue;
    return;
  }
  if (!sawCompositionText) return;

  const from = quote.pos + 1;
  const to = quote.pos + 1 + target.offset;
  view.dispatch(view.state.tr.delete(from, to));
}

function cleanupDuplicatedPrefix(
  view: EditorView,
  quote: { pos: number },
  target: { node: ProseMirrorNode; offset: number },
  finalText: string,
): void {
  const text = target.node.textContent;
  const finalTextStart = finalText ? text.lastIndexOf(finalText) : text.search(/[\u3400-\u9fff\uf900-\ufaff]/);
  if (finalTextStart <= 0) return;

  const prefix = text.slice(0, finalTextStart);
  if (!isAsciiCompositionText(prefix)) return;

  const from = quote.pos + 1 + target.offset + 1;
  view.dispatch(view.state.tr.delete(from, from + prefix.length));
}

function isAsciiCompositionText(text: string): boolean {
  return /^[\x20-\x7e]+$/.test(text) && /[A-Za-z]/.test(text);
}
