import { describe, expect, it } from 'vitest';
import { calculateDocumentStats, extractOutline } from './outlineService';

describe('outlineService', () => {
  it('extracts heading outline with stable ids and line numbers', () => {
    expect(extractOutline('# 标题\n\n## Child\n### Child')).toEqual([
      { id: '标题', level: 1, title: '标题', line: 1 },
      { id: 'child', level: 2, title: 'Child', line: 3 },
      { id: 'child-2', level: 3, title: 'Child', line: 4 },
    ]);
  });

  it('calculates basic writing stats', () => {
    const stats = calculateDocumentStats('# Title\n\nhello world\n\n```ts\nconst x = 1\n```');

    expect(stats).toMatchObject({
      chars: 43,
      words: 3,
      lines: 7,
      headings: 1,
      readingMinutes: 1,
    });
  });
});
