import { describe, expect, it, vi } from 'vitest';
import {
  WINDOWS_IME_PARENTHESES_TEXT,
  createSourceTextareaImePunctuationFallback,
  createWindowsImePunctuationFallback,
} from './windowsImePunctuationFallback';

describe('windows IME punctuation fallback', () => {
  it('returns full-width paired parentheses when Shift+9 has no text input event', () => {
    let time = 100;
    const fallback = createWindowsImePunctuationFallback({
      enabled: true,
      now: () => time,
    });

    fallback.handleKeydown(createKeyboardEvent('keydown', 'Shift', { shiftKey: true }));
    time += 80;
    const replacement = fallback.handleKeyup(createKeyboardEvent('keyup', '(', { shiftKey: true }));

    expect(replacement).toEqual({
      text: WINDOWS_IME_PARENTHESES_TEXT,
      caretOffset: 1,
    });
  });

  it('does not compensate when normal text input was observed', () => {
    const fallback = createWindowsImePunctuationFallback({ enabled: true });

    fallback.handleKeydown(createKeyboardEvent('keydown', 'Shift', { shiftKey: true }));
    fallback.handleBeforeInput();

    expect(fallback.handleKeyup(createKeyboardEvent('keyup', '(', { shiftKey: true }))).toBeNull();
  });

  it('does not compensate non-Windows/runtime-disabled or modified shortcuts', () => {
    const disabled = createWindowsImePunctuationFallback({ enabled: false });
    disabled.handleKeydown(createKeyboardEvent('keydown', 'Shift', { shiftKey: true }));
    expect(disabled.handleKeyup(createKeyboardEvent('keyup', '(', { shiftKey: true }))).toBeNull();

    const withCtrl = createWindowsImePunctuationFallback({ enabled: true });
    withCtrl.handleKeydown(createKeyboardEvent('keydown', 'Shift', { shiftKey: true }));
    expect(
      withCtrl.handleKeyup(createKeyboardEvent('keyup', '(', { shiftKey: true, ctrlKey: true })),
    ).toBeNull();
  });
});

describe('source textarea IME punctuation fallback', () => {
  it('inserts paired full-width parentheses and dispatches input', () => {
    const textarea = createTextarea('');
    const fallback = createSourceTextareaImePunctuationFallback({ enabled: true });
    const inputHandler = vi.fn();
    bindSourceFallback(textarea, fallback);
    textarea.addEventListener('input', inputHandler);

    textarea.dispatchEvent(createKeyboardEvent('keydown', 'Shift', { shiftKey: true }));
    textarea.dispatchEvent(createKeyboardEvent('keyup', '(', { shiftKey: true }));
    const arrowLeft = createKeyboardEvent('keydown', 'ArrowLeft');
    textarea.dispatchEvent(arrowLeft);

    expect(textarea.value).toBe('（）');
    expect(textarea.selectionStart).toBe(1);
    expect(textarea.selectionEnd).toBe(1);
    expect(arrowLeft.defaultPrevented).toBe(true);
    expect(inputHandler).toHaveBeenCalledTimes(1);
  });

  it('replaces selected text with paired full-width parentheses', () => {
    const textarea = createTextarea('a selected z');
    textarea.setSelectionRange(2, 10);
    const fallback = createSourceTextareaImePunctuationFallback({ enabled: true });
    bindSourceFallback(textarea, fallback);

    textarea.dispatchEvent(createKeyboardEvent('keydown', 'Shift', { shiftKey: true }));
    textarea.dispatchEvent(createKeyboardEvent('keyup', '(', { shiftKey: true }));

    expect(textarea.value).toBe('a （） z');
    expect(textarea.selectionStart).toBe(3);
  });

  it('does not insert into readonly textareas', () => {
    const textarea = createTextarea('');
    textarea.readOnly = true;
    const fallback = createSourceTextareaImePunctuationFallback({ enabled: true });
    bindSourceFallback(textarea, fallback);

    textarea.dispatchEvent(createKeyboardEvent('keydown', 'Shift', { shiftKey: true }));
    textarea.dispatchEvent(createKeyboardEvent('keyup', '(', { shiftKey: true }));

    expect(textarea.value).toBe('');
  });

  it('does not duplicate normal beforeinput/input paths', () => {
    const textarea = createTextarea('');
    const fallback = createSourceTextareaImePunctuationFallback({ enabled: true });
    bindSourceFallback(textarea, fallback);

    textarea.dispatchEvent(createKeyboardEvent('keydown', 'Shift', { shiftKey: true }));
    textarea.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        inputType: 'insertText',
        data: '（）',
      }),
    );
    textarea.dispatchEvent(createKeyboardEvent('keyup', '(', { shiftKey: true }));

    expect(textarea.value).toBe('');
  });
});

function createTextarea(value: string): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  document.body.appendChild(textarea);
  textarea.setSelectionRange(value.length, value.length);
  return textarea;
}

function bindSourceFallback(
  textarea: HTMLTextAreaElement,
  fallback: ReturnType<typeof createSourceTextareaImePunctuationFallback>,
): void {
  textarea.addEventListener('keydown', fallback.handleKeydown);
  textarea.addEventListener('keyup', fallback.handleKeyup);
  textarea.addEventListener('beforeinput', fallback.handleBeforeInput);
  textarea.addEventListener('input', fallback.handleInput);
  textarea.addEventListener('compositionstart', fallback.handleCompositionStart);
  textarea.addEventListener('compositionupdate', fallback.handleCompositionUpdate);
  textarea.addEventListener('compositionend', fallback.handleCompositionEnd);
}

function createKeyboardEvent(
  type: 'keydown' | 'keyup',
  key: string,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  return new KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
}
