import { describe, expect, it } from 'vitest';
import type { SegmentedTaskProgress } from '../../lib/text-editor/protocol';
import {
  classifySegmentedTaskProgress,
  estimateTotalLinesFromProgress,
  getAdjacentSegmentStart,
  resolveSegmentWindowStart,
} from './segmentedWorkspaceState';

describe('segmented workspace state', () => {
  it('extrapolates partial line counts monotonically and accepts the completed total', () => {
    expect(
      estimateTotalLinesFromProgress(
        { estimatedLines: 50, indexedBytes: 1_000, totalBytes: 10_000, completed: false },
        100,
      ),
    ).toBe(500);
    expect(
      estimateTotalLinesFromProgress(
        { estimatedLines: 60, indexedBytes: 2_000, totalBytes: 10_000, completed: false },
        500,
      ),
    ).toBe(500);
    expect(
      estimateTotalLinesFromProgress(
        { estimatedLines: 420, indexedBytes: 10_000, totalBytes: 10_000, completed: true },
        500,
      ),
    ).toBe(420);
  });

  it('resolves EOF to the final non-empty window and never advances past EOF', () => {
    expect(resolveSegmentWindowStart(1_000, 1_000, 256)).toBe(744);
    expect(resolveSegmentWindowStart(900, 1_000, 256)).toBe(744);
    expect(resolveSegmentWindowStart(20, 100, 256)).toBe(0);

    expect(
      getAdjacentSegmentStart(
        'next',
        { visibleStartByte: 744, visibleEndByte: 1_000, byteLength: 1_000 },
        256,
      ),
    ).toBeNull();
    expect(
      getAdjacentSegmentStart(
        'previous',
        { visibleStartByte: 744, visibleEndByte: 1_000, byteLength: 1_000 },
        256,
      ),
    ).toBe(488);
  });

  it('requires task identity and keeps stale terminal events from applying results', () => {
    const identity = {
      sessionId: 'session-1',
      taskId: 'task-current',
      baseRevision: 4,
      kind: 'search' as const,
    };
    const progress: SegmentedTaskProgress = {
      ...identity,
      state: 'completed',
      processedBytes: 100,
      totalBytes: 100,
      matchCount: 1,
      currentMatch: { startByte: 80, endByte: 85 },
    };

    expect(classifySegmentedTaskProgress(identity, progress, 4)).toEqual({
      accepted: true,
      terminal: true,
      resultCurrent: true,
    });
    expect(classifySegmentedTaskProgress(identity, progress, 5)).toEqual({
      accepted: true,
      terminal: true,
      resultCurrent: false,
    });
    expect(classifySegmentedTaskProgress(identity, { ...progress, taskId: 'task-old' }, 4)).toEqual(
      { accepted: false, terminal: true, resultCurrent: false },
    );
  });
});
