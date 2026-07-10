import type { SegmentedExternalChangeResult } from '../../lib/text-editor/protocol';

interface ObservedSegmentedExternalState {
  sessionId: string;
  revision: number;
  dirty: boolean;
  hasPendingEdits: boolean;
}

/** 异步磁盘检查只能作用于同一 session/revision；乐观输入和当前 dirty 都优先于旧返回值。 */
export function reconcileSegmentedExternalChangeCheck(
  result: SegmentedExternalChangeResult,
  observed: ObservedSegmentedExternalState,
) {
  if (
    result.sessionId !== observed.sessionId ||
    result.revision !== observed.revision ||
    observed.hasPendingEdits
  ) {
    return null;
  }
  return { dirtyAtDetection: result.dirty || observed.dirty };
}
