import type { OutlineItem } from './outlineService';

export type OutlineDropPlacement = 'before' | 'inside' | 'after';

export interface OutlineSectionMoveRequest {
  sourceIndex: number;
  targetIndex: number;
  placement: OutlineDropPlacement;
}

export type OutlineMoveFailureReason =
  | 'invalid-index'
  | 'self-or-descendant'
  | 'heading-level-overflow'
  | 'no-change';

export interface OutlineSectionMovePlan {
  sourceStartIndex: number;
  sourceEndIndex: number;
  targetEndIndex: number;
  insertionIndex: number;
  levelDelta: number;
  movedHeadingIndex: number;
  indexMap: number[];
}

export type OutlineMovePlanResult =
  | { ok: true; plan: OutlineSectionMovePlan }
  | { ok: false; reason: OutlineMoveFailureReason };

export type OutlineReorderResult =
  | {
      ok: true;
      markdown: string;
      movedHeadingIndex: number;
      movedHeadingLine: number;
      levelDelta: number;
      indexMap: number[];
    }
  | { ok: false; reason: OutlineMoveFailureReason };

interface MarkdownLine {
  text: string;
  ending: string;
}

export function planOutlineSectionMove(
  outline: readonly { level: number }[],
  request: OutlineSectionMoveRequest,
): OutlineMovePlanResult {
  const { sourceIndex, targetIndex, placement } = request;
  if (
    !Number.isInteger(sourceIndex) ||
    !Number.isInteger(targetIndex) ||
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= outline.length ||
    targetIndex >= outline.length
  ) {
    return { ok: false, reason: 'invalid-index' };
  }

  const sourceEndIndex = findSubtreeEnd(outline, sourceIndex);
  if (targetIndex >= sourceIndex && targetIndex < sourceEndIndex) {
    return { ok: false, reason: 'self-or-descendant' };
  }

  const targetEndIndex = findSubtreeEnd(outline, targetIndex);
  const desiredLevel =
    placement === 'inside' ? outline[targetIndex].level + 1 : outline[targetIndex].level;
  const levelDelta = desiredLevel - outline[sourceIndex].level;
  for (let index = sourceIndex; index < sourceEndIndex; index += 1) {
    const nextLevel = outline[index].level + levelDelta;
    if (nextLevel < 1 || nextLevel > 6) {
      return { ok: false, reason: 'heading-level-overflow' };
    }
  }

  const sourceIndexes = Array.from(
    { length: sourceEndIndex - sourceIndex },
    (_value, index) => sourceIndex + index,
  );
  const remainingIndexes = Array.from({ length: outline.length }, (_value, index) => index).filter(
    (index) => index < sourceIndex || index >= sourceEndIndex,
  );
  const insertionIndexBeforeRemoval = placement === 'before' ? targetIndex : targetEndIndex;
  const insertionIndex =
    insertionIndexBeforeRemoval > sourceIndex
      ? insertionIndexBeforeRemoval - sourceIndexes.length
      : insertionIndexBeforeRemoval;
  const reorderedIndexes = [
    ...remainingIndexes.slice(0, insertionIndex),
    ...sourceIndexes,
    ...remainingIndexes.slice(insertionIndex),
  ];
  const unchangedOrder = reorderedIndexes.every((originalIndex, index) => originalIndex === index);
  if (unchangedOrder && levelDelta === 0) {
    return { ok: false, reason: 'no-change' };
  }

  const indexMap = new Array<number>(outline.length);
  reorderedIndexes.forEach((originalIndex, nextIndex) => {
    indexMap[originalIndex] = nextIndex;
  });

  return {
    ok: true,
    plan: {
      sourceStartIndex: sourceIndex,
      sourceEndIndex,
      targetEndIndex,
      insertionIndex,
      levelDelta,
      movedHeadingIndex: indexMap[sourceIndex],
      indexMap,
    },
  };
}

export function reorderOutlineSection(
  markdown: string,
  outline: readonly OutlineItem[],
  request: OutlineSectionMoveRequest,
): OutlineReorderResult {
  const planResult = planOutlineSectionMove(outline, request);
  if (!planResult.ok) return planResult;
  const { plan } = planResult;
  const lines = splitMarkdownLines(markdown);
  const sourceStartLineIndex = outline[plan.sourceStartIndex].line - 1;
  const sourceEndLineIndex = outline[plan.sourceEndIndex]?.line
    ? outline[plan.sourceEndIndex].line - 1
    : lines.length;
  const insertionHeadingIndex = request.placement === 'before' ? request.targetIndex : plan.targetEndIndex;
  const insertionLineIndex = outline[insertionHeadingIndex]?.line
    ? outline[insertionHeadingIndex].line - 1
    : lines.length;
  const movedLines = lines
    .slice(sourceStartLineIndex, sourceEndLineIndex)
    .map((line) => ({ ...line }));

  for (let index = plan.sourceStartIndex; index < plan.sourceEndIndex; index += 1) {
    const relativeLineIndex = outline[index].line - 1 - sourceStartLineIndex;
    const line = movedLines[relativeLineIndex];
    if (!line) continue;
    line.text = line.text.replace(/^(#{1,6})(\s+)/, (match, hashes: string, spacing: string) => {
      return `${'#'.repeat(hashes.length + plan.levelDelta)}${spacing}`;
    });
  }

  const remainingLines = [
    ...lines.slice(0, sourceStartLineIndex),
    ...lines.slice(sourceEndLineIndex),
  ];
  const insertionLineAfterRemoval =
    insertionLineIndex > sourceStartLineIndex
      ? insertionLineIndex - (sourceEndLineIndex - sourceStartLineIndex)
      : insertionLineIndex;
  const reorderedLines = [
    ...remainingLines.slice(0, insertionLineAfterRemoval),
    ...movedLines,
    ...remainingLines.slice(insertionLineAfterRemoval),
  ];
  const nextMarkdown = joinMarkdownLines(reorderedLines, markdown);
  const movedHeadingLine =
    reorderedLines
      .slice(0, insertionLineAfterRemoval)
      .reduce((lineCount) => lineCount + 1, 1);

  return {
    ok: true,
    markdown: nextMarkdown,
    movedHeadingIndex: plan.movedHeadingIndex,
    movedHeadingLine,
    levelDelta: plan.levelDelta,
    indexMap: plan.indexMap,
  };
}

function findSubtreeEnd(
  outline: readonly { level: number }[],
  rootIndex: number,
): number {
  const rootLevel = outline[rootIndex].level;
  let index = rootIndex + 1;
  while (index < outline.length && outline[index].level > rootLevel) index += 1;
  return index;
}

function splitMarkdownLines(markdown: string): MarkdownLine[] {
  if (!markdown) return [];
  const lines: MarkdownLine[] = [];
  const pattern = /([^\r\n]*)(\r\n|\r|\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) && match[0] !== '') {
    lines.push({ text: match[1], ending: match[2] });
    if (!match[2]) break;
  }
  return lines;
}

function joinMarkdownLines(lines: MarkdownLine[], originalMarkdown: string): string {
  if (lines.length === 0) return '';
  const newline = originalMarkdown.match(/\r\n|\r|\n/)?.[0] ?? '\n';
  const hadTrailingNewline = /(?:\r\n|\r|\n)$/.test(originalMarkdown);
  lines.forEach((line, index) => {
    if (index < lines.length - 1 && !line.ending) line.ending = newline;
  });
  lines[lines.length - 1].ending = hadTrailingNewline
    ? lines[lines.length - 1].ending || newline
    : '';
  return lines.map((line) => `${line.text}${line.ending}`).join('');
}
