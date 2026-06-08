import { describe, expect, it } from 'vitest';
import {
  FIRST_RUN_SAMPLE_DOCUMENT_OPENED_KEY,
  shouldMarkFirstRunSampleHandled,
  shouldOpenFirstRunSample,
} from './firstRunSample';

describe('first run sample document', () => {
  const freshState = {
    settings: [],
    recentFilesCount: 0,
    restoredWorkspaceTabs: false,
    hasPendingFolder: false,
  };

  it('opens the sample for a fresh desktop profile', () => {
    expect(shouldOpenFirstRunSample(freshState)).toBe(true);
    expect(shouldMarkFirstRunSampleHandled(freshState)).toBe(false);
  });

  it('does not open the sample after the first-run marker exists', () => {
    const state = {
      ...freshState,
      settings: [{ key: FIRST_RUN_SAMPLE_DOCUMENT_OPENED_KEY, valueJson: 'true' }],
    };

    expect(shouldOpenFirstRunSample(state)).toBe(false);
    expect(shouldMarkFirstRunSampleHandled(state)).toBe(false);
  });

  it('marks existing users as handled instead of opening the sample', () => {
    for (const state of [
      { ...freshState, restoredWorkspaceTabs: true },
      { ...freshState, hasPendingFolder: true },
      { ...freshState, recentFilesCount: 1 },
    ]) {
      expect(shouldOpenFirstRunSample(state)).toBe(false);
      expect(shouldMarkFirstRunSampleHandled(state)).toBe(true);
    }
  });
});
