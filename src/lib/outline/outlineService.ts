export interface OutlineItem {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  line: number;
}

export interface DocumentStats {
  chars: number;
  words: number;
  headings: number;
  readingMinutes: number;
}

export function extractOutline(markdown: string): OutlineItem[] {
  const usedIds = new Map<string, number>();

  return markdown
    .split(/\r?\n/)
    .map((line, index) => {
      const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (!match) {
        return null;
      }

      const title = match[2].trim();
      const baseId = slugifyHeading(title) || `heading-${index + 1}`;
      const seen = usedIds.get(baseId) ?? 0;
      usedIds.set(baseId, seen + 1);

      return {
        id: seen === 0 ? baseId : `${baseId}-${seen + 1}`,
        level: match[1].length as OutlineItem['level'],
        title,
        line: index + 1
      };
    })
    .filter((item): item is OutlineItem => item !== null);
}

export function calculateDocumentStats(markdown: string): DocumentStats {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, ' ');
  const words = withoutCode
    .replace(/[#>*_`[\]()!-]/g, ' ')
    .split(/[\s,.;:!?，。；：！？、]+/)
    .filter(Boolean).length;

  return {
    chars: markdown.length,
    words,
    headings: extractOutline(markdown).length,
    readingMinutes: Math.max(1, Math.ceil(words / 280))
  };
}

function slugifyHeading(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}
