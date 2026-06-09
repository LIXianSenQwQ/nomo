export interface OutlineItem {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  line: number;
}

export interface DocumentStats {
  chars: number;
  words: number;
  lines: number;
  headings: number;
  readingMinutes: number;
}

export function extractOutline(markdown: string): OutlineItem[] {
  return analyzeMarkdown(markdown).outline;
}

export function calculateDocumentStats(markdown: string): DocumentStats {
  return analyzeMarkdown(markdown).stats;
}

export function analyzeMarkdown(markdown: string): {
  outline: OutlineItem[];
  stats: DocumentStats;
} {
  if (markdown.length === 0) {
    return {
      outline: [],
      stats: {
        chars: 0,
        words: 0,
        lines: 1,
        headings: 0,
        readingMinutes: 1,
      },
    };
  }

  const outline: OutlineItem[] = [];
  const usedIds = new Map<string, number>();
  const lines = markdown.split(/\r\n|\r|\n/);

  lines.forEach((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) {
      const rawTitle = match[2].trim();
      const title = normalizeHeadingTitle(rawTitle) || rawTitle;
      const baseId = slugifyHeading(title) || `heading-${index + 1}`;
      const seen = usedIds.get(baseId) ?? 0;
      usedIds.set(baseId, seen + 1);

      outline.push({
        id: seen === 0 ? baseId : `${baseId}-${seen + 1}`,
        level: match[1].length as OutlineItem['level'],
        title,
        line: index + 1,
      });
    }
  });

  const withoutCode = markdown.replace(/```[\s\S]*?```/g, ' ');
  const words = withoutCode
    .replace(/[#>*_`[\]()!-]/g, ' ')
    .split(/[\s,.;:!?，。；：！？、]+/)
    .filter(Boolean).length;

  return {
    outline,
    stats: {
      chars: markdown.length,
      words,
      lines: lines.length,
      headings: outline.length,
      readingMinutes: Math.max(1, Math.ceil(words / 280)),
    },
  };
}

function slugifyHeading(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function normalizeHeadingTitle(title: string): string {
  let plain = title
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1');

  let previous = '';
  while (plain !== previous) {
    previous = plain;
    plain = plain
      .replace(
        /(^|[^\p{Letter}\p{Number}])(\*\*|__)(\S(?:[\s\S]*?\S)?)\2(?=$|[^\p{Letter}\p{Number}])/gu,
        '$1$3',
      )
      .replace(
        /(^|[^\p{Letter}\p{Number}])(\*|_)(\S(?:[\s\S]*?\S)?)\2(?=$|[^\p{Letter}\p{Number}])/gu,
        '$1$3',
      )
      .replace(
        /(^|[^\p{Letter}\p{Number}])~~(\S(?:[\s\S]*?\S)?)~~(?=$|[^\p{Letter}\p{Number}])/gu,
        '$1$2',
      );
  }

  return plain.replace(/\\([\\`*_[\]{}()#+\-.!>])/g, '$1').trim();
}
