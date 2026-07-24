import { isWholeWordRange } from '../../lib/search/textSearch';

export interface TextSearchOptions {
  caseSensitive: boolean;
  wholeWord?: boolean;
}

export interface TextSearchMatch {
  id: string;
  index: number;
  from: number;
  to: number;
  text: string;
}

export function findTextMatches(
  text: string,
  query: string,
  options: TextSearchOptions,
): TextSearchMatch[] {
  if (!query) {
    return [];
  }

  const source = options.caseSensitive ? text : text.toLocaleLowerCase();
  const needle = options.caseSensitive ? query : query.toLocaleLowerCase();
  const matches: TextSearchMatch[] = [];
  let offset = 0;

  while (offset <= source.length) {
    const found = source.indexOf(needle, offset);
    if (found < 0) {
      break;
    }

    const to = found + query.length;
    if (!options.wholeWord || isWholeWordRange(text, found, to)) {
      matches.push({
        id: `${found}:${to}:${matches.length}`,
        index: matches.length,
        from: found,
        to,
        text: text.slice(found, to),
      });
    }
    offset = found + Math.max(needle.length, 1);
  }

  return matches;
}

export function replaceTextRange(
  text: string,
  match: Pick<TextSearchMatch, 'from' | 'to'>,
  replacement: string,
): string {
  return `${text.slice(0, match.from)}${replacement}${text.slice(match.to)}`;
}

export function replaceAllTextMatches(
  text: string,
  query: string,
  replacement: string,
  options: TextSearchOptions,
): { text: string; count: number } {
  const matches = findTextMatches(text, query, options);
  if (matches.length === 0) {
    return { text, count: 0 };
  }

  let nextText = text;
  for (const match of [...matches].reverse()) {
    nextText = replaceTextRange(nextText, match, replacement);
  }

  return { text: nextText, count: matches.length };
}
