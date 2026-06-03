import { describe, expect, it } from 'vitest';
import { createShikiCodeTokenizer } from './shikiCodeTokenizer';

describe('createShikiCodeTokenizer', () => {
  it('tokenizes known languages and falls back for unknown languages', async () => {
    const tokenizer = createShikiCodeTokenizer();

    const known = await tokenizer.tokenize({
      code: 'const value = 1;',
      language: 'ts',
      theme: 'github-light',
    });
    const unknown = await tokenizer.tokenize({
      code: 'plain text',
      language: 'unknown-language',
      theme: 'github-light',
    });

    expect(known.tokens.length).toBeGreaterThan(0);
    expect(known.tokens[0].tokens.map((token) => token.content).join('')).toContain('const');
    expect(unknown.tokens[0].tokens.map((token) => token.content).join('')).toBe('plain text');
  });
});
