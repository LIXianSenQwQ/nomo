import { describe, expect, it } from 'vitest';
import { getExplorerRenameSelectionRange } from './explorerRename';

describe('getExplorerRenameSelectionRange', () => {
  it('selects the entire directory name', () => {
    expect(getExplorerRenameSelectionRange('docs.archive', true)).toEqual({
      start: 0,
      end: 'docs.archive'.length,
    });
  });

  it('selects only the file stem before the final extension', () => {
    expect(getExplorerRenameSelectionRange('release.notes.md', false)).toEqual({
      start: 0,
      end: 'release.notes'.length,
    });
  });

  it('selects the entire file name when there is no extension or it is a dotfile', () => {
    expect(getExplorerRenameSelectionRange('README', false)).toEqual({
      start: 0,
      end: 'README'.length,
    });
    expect(getExplorerRenameSelectionRange('.env', false)).toEqual({
      start: 0,
      end: '.env'.length,
    });
  });
});
