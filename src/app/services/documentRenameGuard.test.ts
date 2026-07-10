import { describe, expect, it } from 'vitest';
import { createMarkdownTab, createSegmentedTextTab } from './tabs';
import { getOpenDocumentRenameBlock } from './documentRenameGuard';

describe('getOpenDocumentRenameBlock', () => {
  const segmented = createSegmentedTextTab({
    documentKind: 'text',
    fileName: 'notes.txt',
    filePath: '/work/docs/notes.txt',
    nativePath: '/work/docs/notes.txt',
    sessionId: 'session-1',
    revision: 0,
    persistedRevision: 0,
    indexProgress: 1,
  });

  it('blocks renaming an open segmented file or one of its parent folders', () => {
    expect(
      getOpenDocumentRenameBlock([segmented], '/work/docs/notes.txt', '/work/docs/renamed.txt'),
    ).toBe('segmented-session');
    expect(getOpenDocumentRenameBlock([segmented], '/work/docs', '/work/archive')).toBe(
      'segmented-session',
    );
  });

  it('blocks changing the extension family of an open Markdown document', () => {
    const markdown = createMarkdownTab({
      fileName: 'guide.md',
      filePath: '/work/guide.md',
      nativePath: '/work/guide.md',
    });

    expect(getOpenDocumentRenameBlock([markdown], '/work/guide.md', '/work/guide.json')).toBe(
      'document-kind',
    );
    expect(
      getOpenDocumentRenameBlock([markdown], '/work/guide.md', '/work/guide.markdown'),
    ).toBeNull();
  });

  it('allows a parent-folder rename when all affected tabs keep the same Markdown kind', () => {
    const markdown = createMarkdownTab({
      fileName: 'guide.md',
      filePath: '/work/docs/guide.md',
      nativePath: '/work/docs/guide.md',
    });

    expect(getOpenDocumentRenameBlock([markdown], '/work/docs', '/work/archive')).toBeNull();
  });
});
