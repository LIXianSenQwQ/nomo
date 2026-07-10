import { describe, expect, it } from 'vitest';
import { reconcileSegmentedExternalChangeCheck } from './segmentedExternalChangeReconciliation';

const result = {
  sessionId: 'session-1',
  revision: 4,
  type: 'modified' as const,
  modifiedAt: 10,
  dirty: false,
  saveInProgress: false,
};

describe('reconcileSegmentedExternalChangeCheck', () => {
  it('rejects stale revisions and optimistic edits that have not been acknowledged', () => {
    expect(
      reconcileSegmentedExternalChangeCheck(result, {
        sessionId: 'session-1',
        revision: 5,
        dirty: true,
        hasPendingEdits: false,
      }),
    ).toBeNull();
    expect(
      reconcileSegmentedExternalChangeCheck(result, {
        sessionId: 'session-1',
        revision: 4,
        dirty: false,
        hasPendingEdits: true,
      }),
    ).toBeNull();
  });

  it('uses the current tab dirty state even when the backend check began while clean', () => {
    expect(
      reconcileSegmentedExternalChangeCheck(result, {
        sessionId: 'session-1',
        revision: 4,
        dirty: true,
        hasPendingEdits: false,
      }),
    ).toEqual({ dirtyAtDetection: true });
  });
});
