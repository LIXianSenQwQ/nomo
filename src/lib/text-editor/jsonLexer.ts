import type { JsonLexicalState } from './protocol';

export type JsonTokenType = 'string' | 'number' | 'boolean' | 'null' | 'punctuation';

export interface JsonToken {
  from: number;
  to: number;
  type: JsonTokenType;
}

export interface JsonLexerOptions {
  maxLineLength?: number;
}

export interface JsonLexerResult {
  tokens: JsonToken[];
  endState: JsonLexicalState;
  disabled: boolean;
}

export const DEFAULT_JSON_LEXICAL_STATE: JsonLexicalState = {
  mode: 'default',
  escaped: false,
};

const DEFAULT_MAX_HIGHLIGHT_LINE_LENGTH = 100_000;
const NUMBER_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;

/** 轻量局部 lexer；它不构造 AST，也不承担全文 JSON 校验。 */
export function lexJsonWindow(
  text: string,
  initialState: JsonLexicalState = DEFAULT_JSON_LEXICAL_STATE,
  options: JsonLexerOptions = {},
): JsonLexerResult {
  const maxLineLength = options.maxLineLength ?? DEFAULT_MAX_HIGHLIGHT_LINE_LENGTH;
  if (!Number.isSafeInteger(maxLineLength) || maxLineLength <= 0) {
    throw new RangeError('maxLineLength 必须是正安全整数');
  }

  const disabled = hasLineLongerThan(text, maxLineLength);
  const tokens: JsonToken[] = [];
  let state: JsonLexicalState = { ...initialState };
  let offset = 0;

  while (offset < text.length) {
    if (state.mode === 'string') {
      const stringResult = scanString(text, offset, state.escaped, false);
      if (!disabled) {
        tokens.push({ from: offset, to: stringResult.end, type: 'string' });
      }
      state = stringResult.state;
      offset = stringResult.end;
      continue;
    }

    const char = text[offset];
    if (/\s/.test(char)) {
      offset += 1;
      continue;
    }
    if (char === '"') {
      const stringResult = scanString(text, offset, false, true);
      if (!disabled) {
        tokens.push({ from: offset, to: stringResult.end, type: 'string' });
      }
      state = stringResult.state;
      offset = stringResult.end;
      continue;
    }
    if ('{}[]:,'.includes(char)) {
      if (!disabled) tokens.push({ from: offset, to: offset + 1, type: 'punctuation' });
      offset += 1;
      continue;
    }

    const number = text.slice(offset).match(NUMBER_PATTERN)?.[0];
    if (number) {
      if (!disabled) tokens.push({ from: offset, to: offset + number.length, type: 'number' });
      offset += number.length;
      continue;
    }

    const literal = readLiteral(text, offset);
    if (literal) {
      if (!disabled) {
        tokens.push({ from: offset, to: offset + literal.value.length, type: literal.type });
      }
      offset += literal.value.length;
      continue;
    }

    offset += 1;
  }

  return { tokens, endState: state, disabled };
}

export function hasLineLongerThan(text: string, limit: number) {
  let currentLength = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      currentLength = 0;
      continue;
    }
    currentLength += 1;
    if (currentLength > limit) return true;
  }
  return false;
}

function scanString(text: string, start: number, escaped: boolean, includesOpeningQuote: boolean) {
  let offset = includesOpeningQuote ? start + 1 : start;
  let nextEscaped = escaped;
  while (offset < text.length) {
    const char = text[offset];
    offset += 1;
    if (nextEscaped) {
      nextEscaped = false;
      continue;
    }
    if (char === '\\') {
      nextEscaped = true;
      continue;
    }
    if (char === '"') {
      return {
        end: offset,
        state: { ...DEFAULT_JSON_LEXICAL_STATE },
      };
    }
  }
  return {
    end: offset,
    state: { mode: 'string', escaped: nextEscaped } satisfies JsonLexicalState,
  };
}

function readLiteral(text: string, offset: number) {
  if (text.startsWith('true', offset)) return { value: 'true', type: 'boolean' as const };
  if (text.startsWith('false', offset)) return { value: 'false', type: 'boolean' as const };
  if (text.startsWith('null', offset)) return { value: 'null', type: 'null' as const };
  return undefined;
}
