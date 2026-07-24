import { describe, expect, it } from 'vitest';
import { reconcileSegmentedSaveState } from './segmentedSaveReconciliation';

describe('reconcileSegmentedSaveState', () => {
  it('keeps a local edit queued during save dirty instead of overwriting it with the frozen result', () => {
    const state = reconcileSegmentedSaveState(
      {
        sessionId: 'session-1',
        savedRevision: 4,
        currentRevision: 4,
        persistedRevision: 4,
        dirty: false,
        filesystemReadonly: false,
        readonly: false,
        modifiedAt: 10,
      },
      {
        revision: 4,
        persistedRevision: 4,
        dirty: true,
        filesystemReadonly: true,
        readonly: false,
      },
    );

    expect(state).toEqual({
      revision: 4,
      persistedRevision: 4,
      dirty: true,
      filesystemReadonly: true,
      readonly: false,
    });
  });

  it('uses the Rust result when no mounted Core exists', () => {
    const state = reconcileSegmentedSaveState(
      {
        sessionId: 'session-1',
        savedRevision: 2,
        currentRevision: 3,
        persistedRevision: 2,
        dirty: true,
        filesystemReadonly: true,
        readonly: true,
        modifiedAt: 10,
      },
      null,
    );

    expect(state).toEqual({
      revision: 3,
      persistedRevision: 2,
      dirty: true,
      filesystemReadonly: true,
      readonly: true,
    });
  });
});
