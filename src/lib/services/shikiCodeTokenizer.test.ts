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

  it('reuses cached and in-flight tokenization results by key', async () => {
    const tokenizer = createShikiCodeTokenizer({ cacheLimit: 2 });
    const input = {
      code: 'const cached = true;',
      language: 'ts',
      theme: 'github-light',
    };

    const [first, concurrent] = await Promise.all([
      tokenizer.tokenize(input),
      tokenizer.tokenize(input),
    ]);
    const cached = await tokenizer.tokenize(input);

    expect(concurrent.tokens).toBe(first.tokens);
    expect(cached.tokens).toBe(first.tokens);
  });

  it('evicts the least recently used token cache entry when the limit is exceeded', async () => {
    const tokenizer = createShikiCodeTokenizer({ cacheLimit: 1 });
    const first = await tokenizer.tokenize({
      code: 'const first = 1;',
      language: 'ts',
      theme: 'github-light',
    });

    await tokenizer.tokenize({
      code: 'const second = 2;',
      language: 'ts',
      theme: 'github-light',
    });

    const firstAfterEviction = await tokenizer.tokenize({
      code: 'const first = 1;',
      language: 'ts',
      theme: 'github-light',
    });

    expect(firstAfterEviction.tokens).not.toBe(first.tokens);
  });
});
