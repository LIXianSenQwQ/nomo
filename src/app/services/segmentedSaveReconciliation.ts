import type { SaveSegmentedRevisionResult } from '../../lib/text-editor/protocol';

export interface SegmentedSaveState {
  revision: number;
  persistedRevision: number;
  dirty: boolean;
  readonly: boolean;
}

/**
 * Rust 保存结果冻结在启动 revision；挂载中的 Core 还可能持有保存期间的新输入。
 * Core 已合并 persisted 水位时以它为准，避免应用层用旧的 `dirty: false` 覆盖本地状态。
 */
export function reconcileSegmentedSaveState(
  result: SaveSegmentedRevisionResult,
  observed: SegmentedSaveState | null | undefined,
): SegmentedSaveState {
  if (observed) {
    return {
      revision: observed.revision,
      persistedRevision: observed.persistedRevision,
      dirty: observed.dirty,
      readonly: observed.readonly,
    };
  }
  return {
    revision: result.currentRevision,
    persistedRevision: result.persistedRevision,
    dirty: result.dirty,
    readonly: result.readonly,
  };
}
