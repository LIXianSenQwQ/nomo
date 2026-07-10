import { describe, expect, it, vi } from 'vitest';
import type { SegmentedDocumentPort } from '../../lib/text-editor/protocol';
import { createBlankTab, createSegmentedTextTab } from './tabs';
import { flushSegmentedDocumentBeforeTransition } from './segmentedDocumentLifecycle';

describe('flushSegmentedDocumentBeforeTransition', () => {
  it('flushes the active Core before journaling the revision acknowledged by Rust', async () => {
    const tab = createSegmentedTextTab({
      documentKind: 'text',
      fileName: 'large.txt',
      filePath: '/tmp/large.txt',
      nativePath: '/tmp/large.txt',
      sessionId: 'session-1',
      revision: 3,
      persistedRevision: 2,
      indexProgress: 1,
    });
    const flushPendingEdits = vi.fn(async () => {
      // stateChange 会在 Core flush 完成时同步推进同一个 Tab 对象。
      tab.revision = 4;
    });
    const flushJournal = vi.fn().mockResolvedValue({ revision: 4 });

    await flushSegmentedDocumentBeforeTransition(tab, { flushPendingEdits }, {
      flushJournal,
    } as unknown as SegmentedDocumentPort);

    expect(flushPendingEdits).toHaveBeenCalledOnce();
    expect(flushJournal).toHaveBeenCalledWith('session-1', 4);
  });

  it('does not touch the segmented port for Markdown tabs', async () => {
    const flushPendingEdits = vi.fn();
    const flushJournal = vi.fn();

    await flushSegmentedDocumentBeforeTransition(createBlankTab(), { flushPendingEdits }, {
      flushJournal,
    } as unknown as SegmentedDocumentPort);

    expect(flushPendingEdits).not.toHaveBeenCalled();
    expect(flushJournal).not.toHaveBeenCalled();
  });
});
