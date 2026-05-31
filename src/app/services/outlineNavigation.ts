import type { OutlineItem } from '../../lib/outline/outlineService';
import { getOutlineItemAtLine } from './outlineState';

export function getSourceLineHeight(sourceTextarea: HTMLTextAreaElement | undefined) {
  if (!sourceTextarea) {
    return 24;
  }
  const parsed = Number.parseFloat(getComputedStyle(sourceTextarea).lineHeight);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
}

export function getSourceHeadingSelection(markdown: string, item: OutlineItem) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.slice(0, item.line - 1).join('\n').length + (item.line > 1 ? 1 : 0);
  return { start, end: start + lines[item.line - 1].length };
}

export function getActiveOutlineIdFromSource(outline: OutlineItem[], scrollTop: number, lineHeight: number) {
  if (!outline.length) {
    return '';
  }
  const visibleLine = Math.max(1, Math.floor(scrollTop / lineHeight) + 1);
  return getOutlineItemAtLine(outline, visibleLine)?.id ?? outline[0]?.id ?? '';
}

export function getActiveOutlineIdFromSemantic(outline: OutlineItem[], semanticPane: HTMLElement | undefined) {
  if (!outline.length || !semanticPane) {
    return '';
  }

  const headings = Array.from(semanticPane.querySelectorAll('.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6'));
  if (headings.length === 0) {
    return outline[0]?.id ?? '';
  }

  const viewportTop = semanticPane.getBoundingClientRect().top;
  const threshold = viewportTop + 96;
  let activeIndex = 0;
  headings.forEach((heading, index) => {
    if (heading.getBoundingClientRect().top <= threshold) {
      activeIndex = index;
    }
  });
  return outline[Math.min(activeIndex, outline.length - 1)]?.id ?? '';
}
