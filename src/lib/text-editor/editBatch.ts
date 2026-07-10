import type { ApplySegmentedEditsResult, SegmentedEdit, SegmentedEditBatch } from './protocol';

export interface AnimationFrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface SegmentedEditBatcherOptions {
  sessionId: string;
  baseRevision: number;
  applyEdits(batch: SegmentedEditBatch): Promise<ApplySegmentedEditsResult>;
  scheduler?: AnimationFrameScheduler;
  onApplied?: (result: ApplySegmentedEditsResult) => void;
  onError?: (error: unknown) => void;
}

/**
 * 把一个 CodeMirror transaction 内、基于同一 revision 的相邻 edits 合并。
 * 不同 enqueue 调用保持顺序并逐批等待 Rust ack，避免乐观坐标误套到旧 revision。
 */
export class SegmentedEditBatcher {
  private baseRevision: number;
  private readonly pendingBatches: SegmentedEdit[][] = [];
  private readonly scheduler: AnimationFrameScheduler;
  private scheduledFrame: number | null = null;
  private flushPromise: Promise<ApplySegmentedEditsResult | undefined> | null = null;
  private retryRequired = false;
  private destroyed = false;

  constructor(private readonly options: SegmentedEditBatcherOptions) {
    if (!Number.isSafeInteger(options.baseRevision) || options.baseRevision < 0) {
      throw new RangeError('baseRevision 必须是非负安全整数');
    }
    this.baseRevision = options.baseRevision;
    this.scheduler = options.scheduler ?? createDefaultScheduler();
  }

  getBaseRevision() {
    return this.baseRevision;
  }

  get hasPendingEdits() {
    return this.pendingBatches.length > 0 || this.flushPromise !== null;
  }

  enqueue(edits: SegmentedEdit | SegmentedEdit[]) {
    this.assertAlive();
    const normalized = mergeAdjacentEdits(Array.isArray(edits) ? edits : [edits]);
    if (normalized.length === 0) return;
    this.pendingBatches.push(normalized);
    this.scheduleFlush();
  }

  flush(): Promise<ApplySegmentedEditsResult | undefined> {
    this.assertAlive();
    this.cancelScheduledFrame();
    if (this.flushPromise) {
      return this.flushPromise;
    }

    this.retryRequired = false;
    this.flushPromise = this.flushQueuedBatches().finally(() => {
      this.flushPromise = null;
      if (this.pendingBatches.length > 0 && !this.destroyed && !this.retryRequired) {
        this.scheduleFlush();
      }
    });
    return this.flushPromise;
  }

  setBaseRevision(revision: number) {
    if (this.hasPendingEdits) {
      throw new Error('存在待提交编辑时不能替换 baseRevision');
    }
    if (!Number.isSafeInteger(revision) || revision < this.baseRevision) {
      throw new RangeError('新的 baseRevision 不得倒退');
    }
    this.baseRevision = revision;
  }

  destroy() {
    this.destroyed = true;
    this.cancelScheduledFrame();
    this.pendingBatches.length = 0;
  }

  private async flushQueuedBatches() {
    let lastResult: ApplySegmentedEditsResult | undefined;
    while (this.pendingBatches.length > 0) {
      const edits = this.pendingBatches.shift()!;
      const batch: SegmentedEditBatch = {
        sessionId: this.options.sessionId,
        baseRevision: this.baseRevision,
        edits,
      };
      try {
        const result = await this.options.applyEdits(batch);
        if (result.revision < this.baseRevision) {
          throw new Error(
            `Rust 返回倒退 revision：base=${this.baseRevision}, result=${result.revision}`,
          );
        }
        this.baseRevision = result.revision;
        lastResult = result;
        this.options.onApplied?.(result);
      } catch (error) {
        // 失败批次保留在队首，让显式 flush 可以重试；错误同时透传，不能伪装成功。
        this.pendingBatches.unshift(edits);
        this.retryRequired = true;
        this.options.onError?.(error);
        throw error;
      }
    }
    return lastResult;
  }

  private scheduleFlush() {
    if (this.scheduledFrame !== null || this.flushPromise || this.retryRequired) return;
    this.scheduledFrame = this.scheduler.request(() => {
      this.scheduledFrame = null;
      void this.flush().catch((error) => reportUnhandledError(error));
    });
  }

  private cancelScheduledFrame() {
    if (this.scheduledFrame === null) return;
    this.scheduler.cancel(this.scheduledFrame);
    this.scheduledFrame = null;
  }

  private assertAlive() {
    if (this.destroyed) {
      throw new Error('SegmentedEditBatcher 已销毁');
    }
  }
}

export function mergeAdjacentEdits(edits: SegmentedEdit[]) {
  if (edits.length === 0) return [];
  const sorted = edits.map(validateEdit).sort((left, right) => left.fromByte - right.fromByte);
  const merged: SegmentedEdit[] = [{ ...sorted[0] }];
  for (const next of sorted.slice(1)) {
    const current = merged[merged.length - 1];
    if (next.fromByte < current.toByte) {
      throw new Error('同一批次的编辑范围不得重叠');
    }
    if (next.fromByte === current.toByte) {
      current.toByte = next.toByte;
      current.insertedText += next.insertedText;
    } else {
      merged.push({ ...next });
    }
  }
  return merged;
}

function validateEdit(edit: SegmentedEdit) {
  if (
    !Number.isSafeInteger(edit.fromByte) ||
    !Number.isSafeInteger(edit.toByte) ||
    edit.fromByte < 0 ||
    edit.toByte < edit.fromByte
  ) {
    throw new RangeError('编辑字节范围无效');
  }
  return edit;
}

function createDefaultScheduler(): AnimationFrameScheduler {
  if (typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function') {
    return {
      request: (callback) => requestAnimationFrame(callback),
      cancel: (handle) => cancelAnimationFrame(handle),
    };
  }
  return {
    request: (callback) => setTimeout(() => callback(Date.now()), 0) as unknown as number,
    cancel: (handle) => clearTimeout(handle),
  };
}

function reportUnhandledError(error: unknown) {
  if (typeof globalThis.reportError === 'function') {
    globalThis.reportError(error);
    return;
  }
  // 缺少 reportError 的旧 WebView 仍显式打印，避免后台批次失败被静默吞掉。
  console.error(error);
}
