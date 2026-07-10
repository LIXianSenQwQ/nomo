import { describe, expect, it, vi } from 'vitest';
import type { ApplySegmentedEditsResult, SegmentedEditBatch } from './protocol';
import { SegmentedEditBatcher, type AnimationFrameScheduler } from './editBatch';

function result(revision: number): ApplySegmentedEditsResult {
  return {
    revision,
    persistedRevision: 0,
    dirty: true,
    invalidatedFromByte: 0,
    invalidatedToByte: 10,
  };
}

function createScheduler() {
  let callback: FrameRequestCallback | undefined;
  const scheduler: AnimationFrameScheduler = {
    request: vi.fn((next) => {
      callback = next;
      return 1;
    }),
    cancel: vi.fn(() => {
      callback = undefined;
    }),
  };
  return { scheduler, run: () => callback?.(0) };
}

describe('SegmentedEditBatcher', () => {
  it('merges adjacent edits and sends them on the animation-frame boundary', async () => {
    const applyEdits = vi.fn(async () => result(5));
    const { scheduler } = createScheduler();
    const batcher = new SegmentedEditBatcher({
      sessionId: 'session-1',
      baseRevision: 4,
      applyEdits,
      scheduler,
    });

    batcher.enqueue([
      { fromByte: 10, toByte: 11, insertedText: 'A' },
      { fromByte: 11, toByte: 13, insertedText: 'BC' },
    ]);
    expect(scheduler.request).toHaveBeenCalledTimes(1);
    await batcher.flush();

    expect(applyEdits).toHaveBeenCalledWith({
      sessionId: 'session-1',
      baseRevision: 4,
      edits: [{ fromByte: 10, toByte: 13, insertedText: 'ABC' }],
    });
    expect(batcher.getBaseRevision()).toBe(5);
  });

  it('serializes edits queued during an in-flight apply onto the acknowledged revision', async () => {
    let resolveFirst: ((value: ApplySegmentedEditsResult) => void) | undefined;
    const batches: SegmentedEditBatch[] = [];
    const applyEdits = vi.fn(async (batch: SegmentedEditBatch) => {
      batches.push(batch);
      if (batches.length === 1) {
        return new Promise<ApplySegmentedEditsResult>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return result(7);
    });
    const batcher = new SegmentedEditBatcher({
      sessionId: 'session-1',
      baseRevision: 5,
      applyEdits,
    });

    batcher.enqueue({ fromByte: 0, toByte: 0, insertedText: 'a' });
    const flushing = batcher.flush();
    batcher.enqueue({ fromByte: 1, toByte: 1, insertedText: 'b' });
    resolveFirst?.(result(6));
    await flushing;

    expect(batches.map((batch) => batch.baseRevision)).toEqual([5, 6]);
    expect(batcher.getBaseRevision()).toBe(7);
  });
});
