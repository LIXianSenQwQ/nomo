import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import {
  createWindowsImePunctuationFallback,
  type WindowsImePunctuationFallbackOptions,
} from '../../input/windowsImePunctuationFallback';

export const windowsImePunctuationFallbackKey = new PluginKey('windowsImePunctuationFallback');

export function windowsImePunctuationFallbackPlugin(
  options: WindowsImePunctuationFallbackOptions = {},
): Plugin {
  const fallback = createWindowsImePunctuationFallback(options);

  return new Plugin({
    key: windowsImePunctuationFallbackKey,
    props: {
      handleDOMEvents: {
        keydown(_view, event) {
          const handled = fallback.handleKeydown(event);
          if (handled) {
            event.preventDefault();
          }
          return handled;
        },
        beforeinput(_view) {
          fallback.handleBeforeInput();
          return false;
        },
        input(_view) {
          fallback.handleInput();
          return false;
        },
        compositionstart(_view) {
          fallback.handleCompositionStart();
          return false;
        },
        compositionupdate(_view) {
          fallback.handleCompositionUpdate();
          return false;
        },
        compositionend(_view) {
          fallback.handleCompositionEnd();
          return false;
        },
        keyup(view, event) {
          if (!view.editable || !isProseMirrorTextTarget(view, event.target)) {
            if (event.key === 'Shift') {
              fallback.handleKeyup(event);
            }
            return false;
          }

          const replacement = fallback.handleKeyup(event);
          if (!replacement) {
            return false;
          }

          event.preventDefault();
          const { from, to } = view.state.selection;
          const tr = view.state.tr.insertText(replacement.text, from, to);
          const caret = from + replacement.caretOffset;
          view.dispatch(tr.setSelection(TextSelection.create(tr.doc, caret)).scrollIntoView());
          return true;
        },
      },
    },
  });
}

function isProseMirrorTextTarget(view: EditorView, target: EventTarget | null): boolean {
  if (!(target instanceof Node) || !view.dom.contains(target)) {
    return false;
  }
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    return false;
  }
  const element = target instanceof Element ? target : target.parentElement;
  const nestedNativeInput = element?.closest('textarea,input,select');
  return !nestedNativeInput || nestedNativeInput === view.dom;
}
