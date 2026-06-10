import { describe, expect, it } from 'vitest';
import { findTextMatches, replaceAllTextMatches, replaceTextRange } from './searchReplace';

describe('searchReplace', () => {
  it('finds literal matches without case sensitivity by default', () => {
    const matches = findTextMatches('Nomo nomo NOMO', 'nomo', { caseSensitive: false });

    expect(matches.map((match) => [match.from, match.to, match.text])).toEqual([
      [0, 4, 'Nomo'],
      [5, 9, 'nomo'],
      [10, 14, 'NOMO'],
    ]);
  });

  it('respects case sensitive matching', () => {
    const matches = findTextMatches('Nomo nomo NOMO', 'nomo', { caseSensitive: true });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.from).toBe(5);
  });

  it('replaces one selected match', () => {
    const [match] = findTextMatches('one two one', 'two', { caseSensitive: false });

    expect(replaceTextRange('one two one', match!, 'three')).toBe('one three one');
  });

  it('replaces all matches from the end to preserve offsets', () => {
    const result = replaceAllTextMatches('alpha alpha', 'alpha', 'a', { caseSensitive: false });

    expect(result).toEqual({ text: 'a a', count: 2 });
  });
});
