import type { EditorMode } from '../../lib/editor-core';
import type { OutlineItem } from '../../lib/outline/outlineService';
import {
  getActiveOutlineIdFromSemantic,
  getActiveOutlineIdFromSource,
  getSourceHeadingSelection,
  getSourceLineHeight as getTextareaLineHeight,
  scrollSemanticToAnchor,
} from './outlineNavigation';
import {
  isOutlineItemExpandable as getOutlineItemExpandable,
  pruneCollapsedOutlineIds as getPrunedCollapsedOutlineIds,
  toggleOutlineItemExpanded as getToggledOutlineItemIds,
} from './outlineState';

interface OutlineInteractionOptions {
  getMode(): EditorMode;
  getMarkdown(): string;
  getOutline(): OutlineItem[];
  getCollapsedOutlineIds(): Set<string>;
  setCollapsedOutlineIds(value: Set<string>): void;
  getOutlineVisible(): boolean;
  setOutlineVisible(value: boolean): void;
  setActiveOutlineId(value: string): void;
  getSuppressOutlineScrollUntil(): number;
  setSuppressOutlineScrollUntil(value: number): void;
  getSemanticPane(): HTMLElement;
  getSourcePane(): HTMLElement;
  getSourceTextarea(): HTMLTextAreaElement;
}

export function createOutlineInteractionController(options: OutlineInteractionOptions) {
  function toggleOutlineVisible() {
    options.setOutlineVisible(!options.getOutlineVisible());
  }

  function isOutlineItemExpandable(index: number) {
    return getOutlineItemExpandable(options.getOutline(), index);
  }

  function toggleOutlineItemExpanded(item: OutlineItem) {
    options.setCollapsedOutlineIds(
      getToggledOutlineItemIds(options.getCollapsedOutlineIds(), item),
    );
  }

  function pruneCollapsedOutlineIds() {
    options.setCollapsedOutlineIds(
      getPrunedCollapsedOutlineIds(options.getOutline(), options.getCollapsedOutlineIds()),
    );
  }

  function jumpToOutlineItem(item: OutlineItem) {
    options.setActiveOutlineId(item.id);
    options.setSuppressOutlineScrollUntil(Date.now() + 800);

    requestAnimationFrame(() => {
      if (options.getMode() === 'semantic') {
        scrollSemanticToAnchor(options.getOutline(), options.getSemanticPane(), {
          outlineId: item.id,
          sectionProgress: 0,
        });
        return;
      }

      const sourceTextarea = options.getSourceTextarea();
      const selection = getSourceHeadingSelection(options.getMarkdown(), item);
      sourceTextarea.focus();
      sourceTextarea.setSelectionRange(selection.start, selection.end);
      const lineHeightPx = getSourceLineHeight();
      options
        .getSourcePane()
        ?.scrollTo({ top: Math.max(0, (item.line - 1) * lineHeightPx - 40), behavior: 'smooth' });
    });
  }

  function updateActiveOutlineFromSourceScroll() {
    if (Date.now() < options.getSuppressOutlineScrollUntil()) {
      return;
    }
    const sourcePane = options.getSourcePane();
    if (!sourcePane) {
      options.setActiveOutlineId('');
      return;
    }
    options.setActiveOutlineId(
      getActiveOutlineIdFromSource(
        options.getOutline(),
        sourcePane.scrollTop,
        getSourceLineHeight(),
      ),
    );
  }

  function updateActiveOutlineFromSemanticScroll() {
    if (Date.now() < options.getSuppressOutlineScrollUntil()) {
      return;
    }
    options.setActiveOutlineId(
      getActiveOutlineIdFromSemantic(options.getOutline(), options.getSemanticPane()),
    );
  }

  function getSourceLineHeight() {
    return getTextareaLineHeight(options.getSourceTextarea());
  }

  return {
    toggleOutlineVisible,
    isOutlineItemExpandable,
    toggleOutlineItemExpanded,
    pruneCollapsedOutlineIds,
    jumpToOutlineItem,
    updateActiveOutlineFromSourceScroll,
    updateActiveOutlineFromSemanticScroll,
    getSourceLineHeight,
  };
}
