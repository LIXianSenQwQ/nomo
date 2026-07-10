import type { SegmentedTaskProgress, SegmentedTaskType } from '../../lib/text-editor/protocol';
import type { SegmentedIndexProgress } from '../../lib/text-editor/protocol';

export type SegmentDirection = 'previous' | 'next';

export interface VisibleSegmentRange {
  visibleStartByte: number;
  visibleEndByte: number;
  byteLength: number;
}

export interface SegmentedTaskIdentity {
  sessionId: string;
  taskId: string;
  baseRevision: number;
  kind: SegmentedTaskType;
}

export interface SegmentedTaskProgressDecision {
  accepted: boolean;
  terminal: boolean;
  /** 只有任务基线仍是当前 Core revision 时，命中位置和写结果才可作用于编辑器。 */
  resultCurrent: boolean;
}

/**
 * Rust 的未完成 estimatedLines 是已扫描前缀行数；先按字节密度外推全文。
 * 扫描过程保持单调，completed 才允许用最终精确行数修正此前估计。
 */
export function estimateTotalLinesFromProgress(
  progress: Pick<
    SegmentedIndexProgress,
    'estimatedLines' | 'indexedBytes' | 'totalBytes' | 'completed'
  >,
  currentEstimate: number,
) {
  const safeCurrent = Math.max(1, Math.trunc(currentEstimate));
  const scannedLines = Math.max(0, Math.trunc(progress.estimatedLines));
  if (progress.completed) return Math.max(1, scannedLines);
  if (scannedLines === 0 || progress.indexedBytes <= 0 || progress.totalBytes <= 0) {
    return safeCurrent;
  }
  const extrapolated = Math.ceil((scannedLines / progress.indexedBytes) * progress.totalBytes);
  if (!Number.isFinite(extrapolated)) return safeCurrent;
  return Math.max(safeCurrent, scannedLines, Math.min(Number.MAX_SAFE_INTEGER, extrapolated));
}

/**
 * 把 EOF 或接近 EOF 的锚点回退到一个有正文的完整尾窗口。
 * 后端 readWindow 使用 startByte 语义，直接请求 byteLength 只会得到空窗口。
 */
export function resolveSegmentWindowStart(
  anchorByte: number,
  byteLength: number,
  windowBytes: number,
) {
  assertByteValue(anchorByte, 'anchorByte');
  assertByteValue(byteLength, 'byteLength');
  if (!Number.isSafeInteger(windowBytes) || windowBytes <= 0) {
    throw new RangeError('windowBytes 必须是正安全整数');
  }
  const maxStart = Math.max(0, byteLength - windowBytes);
  return Math.min(Math.max(0, anchorByte), maxStart);
}

/** 显式段导航始终以前后窗口边界推进，且永不发出 EOF 空窗口请求。 */
export function getAdjacentSegmentStart(
  direction: SegmentDirection,
  range: VisibleSegmentRange,
  windowBytes: number,
) {
  if (!Number.isSafeInteger(windowBytes) || windowBytes <= 0) {
    throw new RangeError('windowBytes 必须是正安全整数');
  }
  if (direction === 'previous') {
    return range.visibleStartByte > 0 ? Math.max(0, range.visibleStartByte - windowBytes) : null;
  }
  return range.visibleEndByte < range.byteLength ? range.visibleEndByte : null;
}

/** taskId/baseRevision/kind 共同标识一次启动；revision 变化后只消费终态，不消费旧结果。 */
export function classifySegmentedTaskProgress(
  identity: SegmentedTaskIdentity,
  progress: SegmentedTaskProgress,
  currentRevision: number,
): SegmentedTaskProgressDecision {
  const terminal = progress.state !== 'running';
  const accepted =
    progress.sessionId === identity.sessionId &&
    progress.taskId === identity.taskId &&
    progress.baseRevision === identity.baseRevision &&
    progress.kind === identity.kind;
  return {
    accepted,
    terminal,
    resultCurrent: accepted && currentRevision === identity.baseRevision,
  };
}

function assertByteValue(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} 必须是非负安全整数`);
  }
}
