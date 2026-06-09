import { codeToTokens, type BundledLanguage } from 'shiki';
import type { CodeTokenLine, CodeTokenizer } from './render';

const DEFAULT_TOKEN_CACHE_LIMIT = 120;

interface ShikiCodeTokenizerOptions {
  cacheLimit?: number;
}

export function createShikiCodeTokenizer(options: ShikiCodeTokenizerOptions = {}): CodeTokenizer {
  const cache = new Map<string, CodeTokenLine[]>();
  const pending = new Map<string, Promise<CodeTokenLine[]>>();
  const cacheLimit = Math.max(1, options.cacheLimit ?? DEFAULT_TOKEN_CACHE_LIMIT);

  function remember(key: string, tokens: CodeTokenLine[]) {
    cache.delete(key);
    cache.set(key, tokens);
    while (cache.size > cacheLimit) {
      const oldest = cache.keys().next().value as string | undefined;
      if (!oldest) break;
      cache.delete(oldest);
    }
  }

  return {
    async tokenize(input) {
      const language = input.language?.trim() || 'text';
      const theme = input.theme || 'github-light';
      const key = `${language}:${theme}:${input.code}`;
      const cached = cache.get(key);

      if (cached) {
        cache.delete(key);
        cache.set(key, cached);
        return {
          language,
          tokens: cached,
        };
      }

      const existing = pending.get(key);
      if (existing) {
        return {
          language,
          tokens: await existing,
        };
      }

      const request = codeToTokens(input.code, {
        lang: language as BundledLanguage,
        theme,
      })
        .catch(() =>
          codeToTokens(input.code, {
            lang: 'text',
            theme,
          }),
        )
        .then((result) =>
          result.tokens.map((line) => ({
            tokens: line.map((token) => ({
              content: token.content,
              color: token.color,
              fontStyle: token.fontStyle ? String(token.fontStyle) : undefined,
            })),
          })),
        )
        .then((tokens) => {
          remember(key, tokens);
          return tokens;
        })
        .finally(() => {
          pending.delete(key);
        });

      pending.set(key, request);

      return {
        language,
        tokens: await request,
      };
    },
  };
}
