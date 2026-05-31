import type { OutlineItem } from '../../lib/outline/outlineService';
import { getOutlineItemAtLine } from './outlineState';

export interface OutlineScrollAnchor {
  outlineId: string;
  sectionProgress: number;
}

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

export function getSourceScrollAnchor(outline: OutlineItem[], scrollTop: number, lineHeight: number, sourceTextarea?: HTMLTextAreaElement): OutlineScrollAnchor | null {
  if (!outline.length) {
    return null;
  }

  const visibleLine = Math.max(1, Math.floor(scrollTop / lineHeight) + 1);
  const activeOutlineId = getActiveOutlineIdFromSource(outline, scrollTop, lineHeight);
  const currentIndex = Math.max(0, outline.findIndex((item) => item.id === activeOutlineId));
  const currentItem = outline[currentIndex] ?? outline[0];
  const nextItem = outline[currentIndex + 1];
  const totalLineCount = getSourceTotalLineCount(sourceTextarea, visibleLine);
  const sectionEndLine = nextItem?.line ?? totalLineCount + 1;
  const sectionLineCount = Math.max(1, sectionEndLine - currentItem.line);
  const sectionProgress = clamp((visibleLine - currentItem.line) / sectionLineCount, 0, 1);

  return { outlineId: currentItem.id, sectionProgress };
}

export function scrollSourceToAnchor(outline: OutlineItem[], sourcePane: HTMLElement | undefined, sourceTextarea: HTMLTextAreaElement | undefined, anchor: OutlineScrollAnchor | null) {
  if (!sourcePane || !anchor) {
    return;
  }

  const currentIndex = outline.findIndex((item) => item.id === anchor.outlineId);
  if (currentIndex === -1) {
    return;
  }

  const currentItem = outline[currentIndex];
  const nextItem = outline[currentIndex + 1];
  const totalLineCount = getSourceTotalLineCount(sourceTextarea, currentItem.line);
  const sectionEndLine = nextItem?.line ?? totalLineCount + 1;
  const sectionLineCount = Math.max(1, sectionEndLine - currentItem.line);
  const targetLine = currentItem.line + Math.round(sectionLineCount * anchor.sectionProgress);
  sourcePane.scrollTop = Math.max(0, (targetLine - 1) * getSourceLineHeight(sourceTextarea));
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

export function getSemanticScrollAnchor(outline: OutlineItem[], semanticPane: HTMLElement | undefined): OutlineScrollAnchor | null {
  const headings = getSemanticHeadings(semanticPane);
  if (!outline.length || !semanticPane || headings.length === 0) {
    return null;
  }

  const visibleTop = semanticPane.scrollTop;
  let activeIndex = 0;
  headings.forEach((heading, index) => {
    if (getElementTopInScrollContainer(heading, semanticPane) <= visibleTop + 24) {
      activeIndex = index;
    }
  });

  const currentTop = getElementTopInScrollContainer(headings[activeIndex], semanticPane);
  const nextTop = headings[activeIndex + 1]
    ? getElementTopInScrollContainer(headings[activeIndex + 1], semanticPane)
    : semanticPane.scrollHeight;
  const sectionHeight = Math.max(1, nextTop - currentTop);
  const sectionProgress = clamp((visibleTop - currentTop) / sectionHeight, 0, 1);

  return {
    outlineId: outline[Math.min(activeIndex, outline.length - 1)]?.id ?? outline[0].id,
    sectionProgress
  };
}

export function scrollSemanticToAnchor(outline: OutlineItem[], semanticPane: HTMLElement | undefined, anchor: OutlineScrollAnchor | null) {
  const headings = getSemanticHeadings(semanticPane);
  if (!semanticPane || !anchor || headings.length === 0) {
    return;
  }

  const currentIndex = outline.findIndex((item) => item.id === anchor.outlineId);
  if (currentIndex === -1 || !headings[currentIndex]) {
    return;
  }

  const currentTop = getElementTopInScrollContainer(headings[currentIndex], semanticPane);
  const nextTop = headings[currentIndex + 1]
    ? getElementTopInScrollContainer(headings[currentIndex + 1], semanticPane)
    : semanticPane.scrollHeight;
  const sectionHeight = Math.max(1, nextTop - currentTop);
  semanticPane.scrollTop = Math.max(0, currentTop + sectionHeight * anchor.sectionProgress);
}

function getSemanticHeadings(semanticPane: HTMLElement | undefined) {
  if (!semanticPane) {
    return [];
  }
  return Array.from(semanticPane.querySelectorAll<HTMLElement>('.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6'));
}

function getElementTopInScrollContainer(element: HTMLElement, scrollContainer: HTMLElement) {
  const elementTop = element.getBoundingClientRect().top;
  const containerTop = scrollContainer.getBoundingClientRect().top;
  return elementTop - containerTop + scrollContainer.scrollTop;
}

function getSourceTotalLineCount(sourceTextarea: HTMLTextAreaElement | undefined, fallbackLine: number) {
  if (!sourceTextarea) {
    return Math.max(1, fallbackLine);
  }
  return Math.max(1, sourceTextarea.value.split(/\r?\n/).length);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
