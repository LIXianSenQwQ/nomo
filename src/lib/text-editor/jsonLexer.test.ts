import { describe, expect, it } from 'vitest';
import { DEFAULT_JSON_LEXICAL_STATE, lexJsonWindow } from './jsonLexer';

describe('lexJsonWindow', () => {
  it('highlights only the lightweight local JSON token classes', () => {
    const result = lexJsonWindow('{"ok":true,"n":-12.5e2,"x":null}');

    expect(result.tokens.map((token) => token.type)).toEqual([
      'punctuation',
      'string',
      'punctuation',
      'boolean',
      'punctuation',
      'string',
      'punctuation',
      'number',
      'punctuation',
      'string',
      'punctuation',
      'null',
      'punctuation',
    ]);
    expect(result.endState).toEqual(DEFAULT_JSON_LEXICAL_STATE);
  });

  it('continues a string and its trailing escape across chunk boundaries', () => {
    const first = lexJsonWindow('"abc' + '\\');
    const second = lexJsonWindow('"x",true', first.endState);

    expect(first.endState).toEqual({ mode: 'string', escaped: true });
    expect(second.tokens[0]).toEqual({ from: 0, to: 3, type: 'string' });
    expect(second.tokens.map((token) => token.type)).toEqual(['string', 'punctuation', 'boolean']);
    expect(second.endState).toEqual(DEFAULT_JSON_LEXICAL_STATE);
  });

  it('disables decorations for an overlong line while preserving the next lexical state', () => {
    const result = lexJsonWindow('"abcdef', DEFAULT_JSON_LEXICAL_STATE, { maxLineLength: 4 });

    expect(result.disabled).toBe(true);
    expect(result.tokens).toEqual([]);
    expect(result.endState).toEqual({ mode: 'string', escaped: false });
  });
});
