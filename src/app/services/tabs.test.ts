import { describe, expect, it } from 'vitest';
import { createBlankTab, createTabForDocument, isMarkdownTab, isSegmentedTextTab } from './tabs';

const segmentedSession = {
  sessionId: 'session-new',
  revision: 4,
  persistedRevision: 3,
  indexProgress: 0.25,
  readonly: false,
  recoveryConflictPath: '/tmp/recovery-conflict.journal',
};

describe('document tab routing', () => {
  it.each([
    ['README.md', 'markdown'],
    ['notes.MARKDOWN', 'markdown'],
    ['plain.txt', 'text'],
    ['data.JSON', 'json'],
  ] as const)('routes %s to a %s tab', (fileName, documentKind) => {
    const tab = createTabForDocument({
      fileName,
      filePath: `/tmp/${fileName}`,
      nativePath: `/tmp/${fileName}`,
      segmentedSession: documentKind === 'markdown' ? undefined : segmentedSession,
    });

    expect(tab.documentKind).toBe(documentKind);
    expect(isMarkdownTab(tab)).toBe(documentKind === 'markdown');
    expect(isSegmentedTextTab(tab)).toBe(documentKind !== 'markdown');
  });

  it('always creates a blank Markdown tab', () => {
    const tab = createBlankTab();

    expect(tab.documentKind).toBe('markdown');
    expect(tab).toMatchObject({
      fileName: 'untitled.md',
      markdown: '',
      savedMarkdown: '',
    });
  });

  it('keeps segmented tabs free of Markdown bodies and draft ids', () => {
    const tab = createTabForDocument({
      fileName: 'large.json',
      filePath: '/tmp/large.json',
      nativePath: '/tmp/large.json',
      segmentedSession,
    });

    expect(tab).toMatchObject({
      documentKind: 'json',
      sessionId: 'session-new',
      revision: 4,
      persistedRevision: 3,
      indexProgress: 0.25,
      recoveryConflictPath: '/tmp/recovery-conflict.journal',
    });
    expect('markdown' in tab).toBe(false);
    expect('savedMarkdown' in tab).toBe(false);
    expect('draftId' in tab).toBe(false);
  });

  it('defaults direct segmented tabs without a recovery conflict to null', () => {
    const tab = createTabForDocument({
      fileName: 'plain.txt',
      filePath: '/tmp/plain.txt',
      nativePath: '/tmp/plain.txt',
      segmentedSession: { ...segmentedSession, recoveryConflictPath: null },
    });

    expect(isSegmentedTextTab(tab) && tab.recoveryConflictPath).toBeNull();
  });

  it('rejects segmented files when no open session was supplied', () => {
    expect(() =>
      createTabForDocument({
        fileName: 'large.txt',
        filePath: '/tmp/large.txt',
        nativePath: '/tmp/large.txt',
      }),
    ).toThrow(/session/i);
  });
});
