export const WINDOWS_IME_PARENTHESES_TEXT = '（）';
export const WINDOWS_IME_PARENTHESES_CARET_OFFSET = 1;

export interface WindowsImePunctuationFallbackOptions {
  enabled?: boolean | (() => boolean);
  now?: () => number;
  timeoutMs?: number;
}

export interface WindowsImePunctuationReplacement {
  text: string;
  caretOffset: number;
}

interface FallbackState {
  shiftStartedAt: number | null;
  textInputObserved: boolean;
  suppressArrowLeftUntil: number;
}

const DEFAULT_TIMEOUT_MS = 1500;

export function createWindowsImePunctuationFallback(
  options: WindowsImePunctuationFallbackOptions = {},
) {
  const state: FallbackState = {
    shiftStartedAt: null,
    textInputObserved: false,
    suppressArrowLeftUntil: 0,
  };

  const now = options.now ?? (() => Date.now());
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  function isEnabled(): boolean {
    if (typeof options.enabled === 'function') return options.enabled();
    if (typeof options.enabled === 'boolean') return options.enabled;
    return isWindowsWebViewRuntime();
  }

  function resetShiftState(): void {
    state.shiftStartedAt = null;
    state.textInputObserved = false;
  }

  function reset(): void {
    resetShiftState();
    state.suppressArrowLeftUntil = 0;
  }

  function markTextInput(): void {
    if (state.shiftStartedAt !== null) {
      state.textInputObserved = true;
    }
  }

  function handleKeydown(event: KeyboardEvent): boolean {
    if (!isEnabled()) {
      reset();
      return false;
    }
    if (shouldSuppressSyntheticArrowLeft(event)) {
      state.suppressArrowLeftUntil = 0;
      return true;
    }
    if (isPlainShiftKey(event)) {
      state.shiftStartedAt = now();
      state.textInputObserved = false;
      return false;
    }
    if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      resetShiftState();
    }
    return false;
  }

  function shouldSuppressSyntheticArrowLeft(event: KeyboardEvent): boolean {
    return (
      state.suppressArrowLeftUntil > 0 &&
      now() <= state.suppressArrowLeftUntil &&
      event.key === 'ArrowLeft' &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    );
  }

  function handleKeyup(event: KeyboardEvent): WindowsImePunctuationReplacement | null {
    if (!isEnabled()) {
      reset();
      return null;
    }

    if (event.key === 'Shift') {
      resetShiftState();
      return null;
    }

    if (!isBaiduParenthesisKeyupShape(event)) {
      return null;
    }

    const shiftStartedAt = state.shiftStartedAt;
    const stale = shiftStartedAt === null || now() - shiftStartedAt > timeoutMs;
    const shouldInsert = !stale && !state.textInputObserved;
    resetShiftState();

    if (!shouldInsert) return null;

    state.suppressArrowLeftUntil = now() + 250;
    return {
      text: WINDOWS_IME_PARENTHESES_TEXT,
      caretOffset: WINDOWS_IME_PARENTHESES_CARET_OFFSET,
    };
  }

  return {
    handleKeydown,
    handleKeyup,
    handleBeforeInput: markTextInput,
    handleInput: markTextInput,
    handleCompositionStart: markTextInput,
    handleCompositionUpdate: markTextInput,
    handleCompositionEnd: markTextInput,
    reset,
  };
}

export type WindowsImePunctuationFallback = ReturnType<typeof createWindowsImePunctuationFallback>;

export function createSourceTextareaImePunctuationFallback(
  options: WindowsImePunctuationFallbackOptions = {},
) {
  const fallback = createWindowsImePunctuationFallback(options);

  function handleKeydown(event: KeyboardEvent): boolean {
    const handled = fallback.handleKeydown(event);
    if (handled) {
      event.preventDefault();
    }
    return handled;
  }

  function handleKeyup(event: KeyboardEvent): boolean {
    const textarea = event.currentTarget;
    if (!(textarea instanceof HTMLTextAreaElement) || textarea.readOnly || textarea.disabled) {
      if (event.key === 'Shift') {
        fallback.handleKeyup(event);
      }
      return false;
    }

    const replacement = fallback.handleKeyup(event);
    if (!replacement) return false;

    insertTextAtTextareaSelection(textarea, replacement);
    event.preventDefault();
    return true;
  }

  return {
    handleKeydown,
    handleKeyup,
    handleBeforeInput: fallback.handleBeforeInput,
    handleInput: fallback.handleInput,
    handleCompositionStart: fallback.handleCompositionStart,
    handleCompositionUpdate: fallback.handleCompositionUpdate,
    handleCompositionEnd: fallback.handleCompositionEnd,
    reset: fallback.reset,
  };
}

export function insertTextAtTextareaSelection(
  textarea: HTMLTextAreaElement,
  replacement: WindowsImePunctuationReplacement,
): void {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  const nextValue = `${textarea.value.slice(0, start)}${replacement.text}${textarea.value.slice(
    end,
  )}`;
  const caret = start + replacement.caretOffset;

  textarea.value = nextValue;
  textarea.setSelectionRange(caret, caret);
  textarea.dispatchEvent(createTextareaInputEvent(replacement.text));
}

function createTextareaInputEvent(text: string): Event {
  if (typeof InputEvent !== 'undefined') {
    return new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text,
    });
  }
  return new Event('input', { bubbles: true });
}

function isPlainShiftKey(event: KeyboardEvent): boolean {
  return (
    event.key === 'Shift' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey
  );
}

function isBaiduParenthesisKeyupShape(event: KeyboardEvent): boolean {
  return (
    event.type === 'keyup' &&
    event.key === '(' &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  );
}

function isWindowsWebViewRuntime(): boolean {
  if (typeof navigator === 'undefined') return false;
  const userAgentNavigator = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform =
    userAgentNavigator.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;
  const userAgent = navigator.userAgent ?? '';
  const hasTauriInternals =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in (window as Window & object);
  return /win/i.test(platform) && (hasTauriInternals || /webview2/i.test(userAgent));
}
