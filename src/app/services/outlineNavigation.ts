import type { OutlineItem } from '../../lib/outline/outlineService';
import { slugifyHeading } from '../../lib/toc/tocService';
import { getOutlineItemAtLine } from './outlineState';

export type OutlineScrollAnchor =
  | {
      kind: 'outline';
      outlineId: string;
      sectionProgress: number;
      documentProgress: number;
      sourceLine: number;
    }
  | {
      kind: 'document';
      sectionProgress: number;
      documentProgress: number;
      sourceLine: number;
    };

interface LegacyOutlineScrollAnchor {
  outlineId: string;
  sectionProgress: number;
}

interface SemanticHeadingAnchor {
  id: string;
  element: HTMLElement;
}

interface SemanticHeadingCache {
  editor: Element | null;
  signature: string;
  anchors: SemanticHeadingAnchor[];
}

const semanticHeadingCache = new WeakMap<HTMLElement, SemanticHeadingCache>();
const outlineScrollAnimations = new WeakMap<HTMLElement, number>();

const OUTLINE_SCROLL_DURATION_MS = 260;
const OUTLINE_SCROLL_REDUCED_DURATION_MS = 140;

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

export function getActiveOutlineIdFromSource(
  outline: OutlineItem[],
  scrollTop: number,
  lineHeight: number,
) {
  if (!outline.length) {
    return '';
  }
  const visibleLine = Math.max(1, Math.floor(scrollTop / lineHeight) + 1);
  return getOutlineItemAtLine(outline, visibleLine)?.id ?? outline[0]?.id ?? '';
}

export function getSourceScrollAnchor(
  outline: OutlineItem[],
  scrollTop: number,
  lineHeight: number,
  sourceTextarea?: HTMLTextAreaElement,
  sourcePane?: HTMLElement,
): OutlineScrollAnchor | null {
  const visibleLine = Math.max(1, Math.floor(scrollTop / lineHeight) + 1);
  const sourceScrollContainer = sourcePane ?? sourceTextarea?.closest<HTMLElement>('.source-pane');
  const documentProgress = getScrollProgress(sourceScrollContainer, scrollTop);

  if (!outline.length) {
    return {
      kind: 'document',
      sectionProgress: documentProgress,
      documentProgress,
      sourceLine: visibleLine,
    };
  }

  const activeOutlineId = getActiveOutlineIdFromSource(outline, scrollTop, lineHeight);
  const currentIndex = Math.max(
    0,
    outline.findIndex((item) => item.id === activeOutlineId),
  );
  const currentItem = outline[currentIndex] ?? outline[0];
  const nextItem = outline[currentIndex + 1];
  const totalLineCount = getSourceTotalLineCount(sourceTextarea, visibleLine);
  const sectionEndLine = nextItem?.line ?? totalLineCount + 1;
  const sectionLineCount = Math.max(1, sectionEndLine - currentItem.line);
  const sectionProgress = clamp((visibleLine - currentItem.line) / sectionLineCount, 0, 1);

  return {
    kind: 'outline',
    outlineId: currentItem.id,
    sectionProgress,
    documentProgress,
    sourceLine: visibleLine,
  };
}

export function scrollSourceToAnchor(
  outline: OutlineItem[],
  sourcePane: HTMLElement | undefined,
  sourceTextarea: HTMLTextAreaElement | undefined,
  anchor: OutlineScrollAnchor | LegacyOutlineScrollAnchor | null,
) {
  if (!sourcePane || !anchor) {
    return;
  }

  if (isDocumentAnchor(anchor)) {
    sourcePane.scrollTop = getScrollTopByProgress(sourcePane, anchor.documentProgress);
    return;
  }

  const currentIndex = outline.findIndex((item) => item.id === anchor.outlineId);
  if (currentIndex === -1) {
    sourcePane.scrollTop = getScrollTopByProgress(sourcePane, getAnchorDocumentProgress(anchor));
    return;
  }

  const currentItem = outline[currentIndex];
  const nextItem = outline[currentIndex + 1];
  const totalLineCount = getSourceTotalLineCount(sourceTextarea, currentItem.line);
  const sectionEndLine = nextItem?.line ?? totalLineCount + 1;
  const sectionLineCount = Math.max(1, sectionEndLine - currentItem.line);
  const targetLine = currentItem.line + Math.round(sectionLineCount * anchor.sectionProgress);
  sourcePane.scrollTop = clampScrollTop(
    sourcePane,
    Math.max(0, (targetLine - 1) * getSourceLineHeight(sourceTextarea)),
  );
}

export function getActiveOutlineIdFromSemantic(
  outline: OutlineItem[],
  semanticPane: HTMLElement | undefined,
) {
  if (!outline.length || !semanticPane) {
    return '';
  }

  const headingAnchors = getSemanticHeadingAnchors(semanticPane, outline);
  if (headingAnchors.length === 0) {
    return outline[0]?.id ?? '';
  }

  const viewportTop = semanticPane.getBoundingClientRect().top;
  const threshold = viewportTop + 96;
  let activeIndex = 0;
  headingAnchors.forEach(({ element }, index) => {
    if (element.getBoundingClientRect().top <= threshold) {
      activeIndex = index;
    }
  });
  return headingAnchors[Math.min(activeIndex, headingAnchors.length - 1)]?.id ?? '';
}

export function getSemanticScrollAnchor(
  outline: OutlineItem[],
  semanticPane: HTMLElement | undefined,
): OutlineScrollAnchor | null {
  const headingAnchors = getSemanticHeadingAnchors(semanticPane, outline);
  if (!outline.length || !semanticPane || headingAnchors.length === 0) {
    if (!semanticPane) {
      return null;
    }
    const documentProgress = getScrollProgress(semanticPane, semanticPane.scrollTop);
    return {
      kind: 'document',
      sectionProgress: documentProgress,
      documentProgress,
      sourceLine: 1,
    };
  }

  const visibleTop = semanticPane.scrollTop;
  let activeIndex = 0;
  headingAnchors.forEach(({ element }, index) => {
    if (getElementTopInScrollContainer(element, semanticPane) <= visibleTop + 24) {
      activeIndex = index;
    }
  });

  const currentTop = getElementTopInScrollContainer(
    headingAnchors[activeIndex].element,
    semanticPane,
  );
  const nextTop = headingAnchors[activeIndex + 1]
    ? getElementTopInScrollContainer(headingAnchors[activeIndex + 1].element, semanticPane)
    : semanticPane.scrollHeight;
  const sectionHeight = Math.max(1, nextTop - currentTop);
  const sectionProgress = clamp((visibleTop - currentTop) / sectionHeight, 0, 1);
  const outlineId =
    headingAnchors[Math.min(activeIndex, headingAnchors.length - 1)]?.id ?? outline[0].id;
  const sourceLine = outline.find((item) => item.id === outlineId)?.line ?? 1;

  return {
    kind: 'outline',
    outlineId,
    sectionProgress,
    documentProgress: getScrollProgress(semanticPane, visibleTop),
    sourceLine,
  };
}

export function scrollSemanticToAnchor(
  outline: OutlineItem[],
  semanticPane: HTMLElement | undefined,
  anchor: OutlineScrollAnchor | LegacyOutlineScrollAnchor | null,
) {
  const headingAnchors = getSemanticHeadingAnchors(semanticPane, outline);
  if (!semanticPane || !anchor) {
    return;
  }

  if (isDocumentAnchor(anchor) || headingAnchors.length === 0 || !hasAnchorOutlineId(anchor)) {
    smoothScrollElementTo(
      semanticPane,
      getScrollTopByProgress(semanticPane, getAnchorDocumentProgress(anchor)),
    );
    return;
  }

  const currentIndex = headingAnchors.findIndex((item) => item.id === anchor.outlineId);
  if (currentIndex === -1 || !headingAnchors[currentIndex]) {
    smoothScrollElementTo(
      semanticPane,
      getScrollTopByProgress(semanticPane, getAnchorDocumentProgress(anchor)),
    );
    return;
  }

  const currentTop = getElementTopInScrollContainer(
    headingAnchors[currentIndex].element,
    semanticPane,
  );
  const nextTop = headingAnchors[currentIndex + 1]
    ? getElementTopInScrollContainer(headingAnchors[currentIndex + 1].element, semanticPane)
    : semanticPane.scrollHeight;
  const sectionHeight = Math.max(1, nextTop - currentTop);
  const top = clampScrollTop(semanticPane, currentTop + sectionHeight * anchor.sectionProgress - 32);
  smoothScrollElementTo(semanticPane, top);
}

export function smoothScrollElementTo(scrollContainer: HTMLElement, top: number) {
  const targetTop = clampScrollTop(scrollContainer, top);
  const startTop = scrollContainer.scrollTop;
  const delta = targetTop - startTop;
  const duration = getOutlineScrollDuration();
  const raf = typeof window !== 'undefined' ? window.requestAnimationFrame?.bind(window) : null;
  const cancelRaf =
    typeof window !== 'undefined' ? window.cancelAnimationFrame?.bind(window) : null;

  const activeFrame = outlineScrollAnimations.get(scrollContainer);
  if (activeFrame !== undefined && cancelRaf) {
    cancelRaf(activeFrame);
  }

  if (!raf || Math.abs(delta) < 1 || duration <= 0) {
    scrollContainer.scrollTop = targetTop;
    outlineScrollAnimations.delete(scrollContainer);
    return;
  }

  const startedAt = Date.now();
  const tick = () => {
    const elapsed = Date.now() - startedAt;
    const progress = clamp(elapsed / duration, 0, 1);
    scrollContainer.scrollTop = startTop + delta * easeOutCubic(progress);

    if (progress < 1) {
      outlineScrollAnimations.set(scrollContainer, raf(tick));
    } else {
      scrollContainer.scrollTop = targetTop;
      outlineScrollAnimations.delete(scrollContainer);
    }
  };

  outlineScrollAnimations.set(scrollContainer, raf(tick));
}

function getSemanticHeadings(semanticPane: HTMLElement | undefined) {
  if (!semanticPane) {
    return [];
  }
  return Array.from(
    semanticPane.querySelectorAll<HTMLElement>(
      '.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6',
    ),
  );
}

function getSemanticHeadingAnchors(
  semanticPane: HTMLElement | undefined,
  outline: OutlineItem[],
): SemanticHeadingAnchor[] {
  if (!semanticPane) {
    return [];
  }

  const editor = semanticPane.querySelector('.ProseMirror');
  const signature = outline.map((item) => item.id).join('\u001f');
  const cached = semanticHeadingCache.get(semanticPane);
  if (cached && cached.editor === editor && cached.signature === signature) {
    return cached.anchors;
  }

  const headings = getSemanticHeadings(semanticPane);
  const usedIds = new Map<string, number>();
  const anchors = headings.map((element, index) => {
    const title = element.textContent?.trim() ?? '';
    const baseId = slugifyHeading(title) || `heading-${index + 1}`;
    const seen = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, seen + 1);
    return {
      id: seen === 0 ? baseId : `${baseId}-${seen + 1}`,
      element,
    };
  });
  semanticHeadingCache.set(semanticPane, { editor, signature, anchors });
  return anchors;
}

function getElementTopInScrollContainer(element: HTMLElement, scrollContainer: HTMLElement) {
  const elementTop = element.getBoundingClientRect().top;
  const containerTop = scrollContainer.getBoundingClientRect().top;
  return elementTop - containerTop + scrollContainer.scrollTop;
}

function isDocumentAnchor(
  anchor: OutlineScrollAnchor | LegacyOutlineScrollAnchor,
): anchor is Extract<OutlineScrollAnchor, { kind: 'document' }> {
  return 'kind' in anchor && anchor.kind === 'document';
}

function hasAnchorOutlineId(
  anchor: OutlineScrollAnchor | LegacyOutlineScrollAnchor,
): anchor is Extract<OutlineScrollAnchor, { kind: 'outline' }> | LegacyOutlineScrollAnchor {
  return (
    'outlineId' in anchor && typeof anchor.outlineId === 'string' && anchor.outlineId.length > 0
  );
}

function getAnchorDocumentProgress(anchor: OutlineScrollAnchor | LegacyOutlineScrollAnchor) {
  return 'documentProgress' in anchor ? anchor.documentProgress : anchor.sectionProgress;
}

function getScrollProgress(scrollContainer: HTMLElement | undefined | null, scrollTop: number) {
  if (!scrollContainer) {
    return 0;
  }
  const maxScrollTop = getMaxScrollTop(scrollContainer);
  return maxScrollTop > 0 ? clamp(scrollTop / maxScrollTop, 0, 1) : 0;
}

function getScrollTopByProgress(scrollContainer: HTMLElement, progress: number) {
  return clampScrollTop(scrollContainer, getMaxScrollTop(scrollContainer) * clamp(progress, 0, 1));
}

function clampScrollTop(scrollContainer: HTMLElement, scrollTop: number) {
  return clamp(scrollTop, 0, getMaxScrollTop(scrollContainer));
}

function getMaxScrollTop(scrollContainer: HTMLElement) {
  return Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
}

function getSourceTotalLineCount(
  sourceTextarea: HTMLTextAreaElement | undefined,
  fallbackLine: number,
) {
  if (!sourceTextarea) {
    return Math.max(1, fallbackLine);
  }
  return Math.max(1, sourceTextarea.value.split(/\r?\n/).length);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getOutlineScrollDuration() {
  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduceMotion ? OUTLINE_SCROLL_REDUCED_DURATION_MS : OUTLINE_SCROLL_DURATION_MS;
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}
