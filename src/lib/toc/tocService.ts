import type { OutlineItem } from '../outline/outlineService';

export const TOC_START_MARKER = '<!-- toc -->';
export const TOC_END_MARKER = '<!-- /toc -->';

export interface TocBlockRange {
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
}

const TOC_BLOCK_PATTERN = /<!--\s*toc\s*-->[\s\S]*?<!--\s*\/toc\s*-->/gi;

export function createTocBlock(markdown: string): string {
  const content = createTocList(markdown);
  return `${TOC_START_MARKER}\n${content}${content ? '\n' : ''}${TOC_END_MARKER}`;
}

export function updateTocBlocks(markdown: string): string {
  if (!hasTocBlock(markdown)) {
    return markdown;
  }

  const content = createTocList(markdown);
  return markdown.replace(TOC_BLOCK_PATTERN, () =>
    `${TOC_START_MARKER}\n${content}${content ? '\n' : ''}${TOC_END_MARKER}`,
  );
}

export function hasTocBlock(markdown: string): boolean {
  TOC_BLOCK_PATTERN.lastIndex = 0;
  return TOC_BLOCK_PATTERN.test(markdown);
}

export function removeTocBlocks(markdown: string): string {
  return markdown.replace(TOC_BLOCK_PATTERN, '');
}

export function extractTocRanges(markdown: string): TocBlockRange[] {
  const ranges: TocBlockRange[] = [];
  const markerPattern = /<!--\s*toc\s*-->|<!--\s*\/toc\s*-->/gi;
  let start: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;

  while ((match = markerPattern.exec(markdown)) !== null) {
    const marker = match[0].toLowerCase();
    if (/<!--\s*toc\s*-->/.test(marker)) {
      start = match;
      continue;
    }

    if (!start) {
      continue;
    }

    ranges.push({
      start: start.index,
      end: markerPattern.lastIndex,
      contentStart: start.index + start[0].length,
      contentEnd: match.index,
    });
    start = null;
  }

  return ranges;
}

export function createTocList(markdown: string): string {
  return extractTocItems(markdown)
    .map((item) => `${'  '.repeat(item.level - 1)}- [${escapeLinkText(item.title)}](#${item.id})`)
    .join('\n');
}

export function extractTocItems(markdown: string): OutlineItem[] {
  const body = stripFrontMatter(removeTocBlocks(markdown));
  const usedIds = new Map<string, number>();
  const items: OutlineItem[] = [];
  let inFence = false;
  let fenceMarker = '';

  body.split(/\r?\n/).forEach((line, index) => {
    const fenceMatch = /^(\s*)(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[2];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker[0];
      } else if (marker[0] === fenceMarker) {
        inFence = false;
        fenceMarker = '';
      }
      return;
    }

    if (inFence) {
      return;
    }

    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) {
      return;
    }

    const title = match[2].trim();
    const baseId = slugifyHeading(title) || `heading-${index + 1}`;
    const seen = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, seen + 1);

    items.push({
      id: seen === 0 ? baseId : `${baseId}-${seen + 1}`,
      level: match[1].length as OutlineItem['level'],
      title,
      line: index + 1,
    });
  });

  return items;
}

function stripFrontMatter(markdown: string): string {
  if (!markdown.startsWith('---\n')) {
    return markdown;
  }

  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) {
    return markdown;
  }

  return markdown.slice(end + 5).replace(/^\s+/, '');
}

export function slugifyHeading(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function escapeLinkText(text: string): string {
  return text.replace(/([\\\[\]])/g, '\\$1');
}
