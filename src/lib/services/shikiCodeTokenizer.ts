import { codeToTokens, type BundledLanguage } from 'shiki';
import type { CodeTokenLine, CodeTokenizer } from './render';

export function createShikiCodeTokenizer(): CodeTokenizer {
  const cache = new Map<string, CodeTokenLine[]>();

  return {
    async tokenize(input) {
      const language = input.language?.trim() || 'text';
      const theme = input.theme || 'github-light';
      const key = `${language}:${theme}:${input.code}`;
      const cached = cache.get(key);

      if (cached) {
        return {
          language,
          tokens: cached,
        };
      }

      const result = await codeToTokens(input.code, {
        lang: language as BundledLanguage,
        theme,
      }).catch(() =>
        codeToTokens(input.code, {
          lang: 'text',
          theme,
        }),
      );

      const tokens = result.tokens.map((line) => ({
        tokens: line.map((token) => ({
          content: token.content,
          color: token.color,
          fontStyle: token.fontStyle ? String(token.fontStyle) : undefined,
        })),
      }));

      cache.set(key, tokens);

      return {
        language,
        tokens,
      };
    },
  };
}
