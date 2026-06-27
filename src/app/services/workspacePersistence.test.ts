import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '../types';
import { createPersistedWorkspaceState, migrateWorkspaceSetting } from './workspacePersistence';

const writeWorkspaceDraft = vi.hoisted(() => vi.fn());
const deleteWorkspaceDraft = vi.hoisted(() => vi.fn());

vi.mock('../../lib/desktop/tauriStorage', () => ({
  writeWorkspaceDraft,
  deleteWorkspaceDraft,
}));

beforeEach(() => {
  writeWorkspaceDraft.mockReset();
  deleteWorkspaceDraft.mockReset();
  writeWorkspaceDraft.mockImplementation(async (_markdown: string, draftId?: string | null) => ({
    draftId: draftId ?? 'draft-created',
    markdown: _markdown,
    updatedAt: 1,
  }));
});

describe('workspacePersistence', () => {
  it('persists workspace tabs without markdown bodies', async () => {
    const tab = createTab({
      nativePath: 'D:\\docs\\a.md',
      markdown: '# changed',
      savedMarkdown: '# saved',
      dirty: false,
    });

    const state = await createPersistedWorkspaceState({
      tabs: [tab],
      activeTabId: tab.id,
      currentFolderPath: 'D:\\docs',
      desktopEnabled: true,
    });

    expect(JSON.stringify(state)).not.toContain('changed');
    expect(JSON.stringify(state)).not.toContain('saved');
    expect(state).toMatchObject({
      version: 2,
      activeTabId: tab.id,
      currentFolderPath: 'D:\\docs',
      tabs: [{ nativePath: 'D:\\docs\\a.md', draftId: null, dirty: false }],
    });
  });

  it('writes drafts only for dirty or pathless tabs', async () => {
    const dirtyNative = createTab({
      id: 'dirty-native',
      nativePath: 'D:\\docs\\a.md',
      markdown: '# dirty',
      dirty: true,
    });
    const cleanNative = createTab({
      id: 'clean-native',
      nativePath: 'D:\\docs\\b.md',
      markdown: '# clean',
      dirty: false,
    });
    const pathless = createTab({
      id: 'pathless',
      nativePath: null,
      markdown: '# local',
      dirty: false,
    });

    const state = await createPersistedWorkspaceState({
      tabs: [dirtyNative, cleanNative, pathless],
      activeTabId: dirtyNative.id,
      currentFolderPath: 'D:\\docs',
      desktopEnabled: true,
    });

    expect(writeWorkspaceDraft).toHaveBeenCalledTimes(2);
    expect(state.tabs.find((tab) => tab.id === 'dirty-native')?.draftId).toBe('draft-created');
    expect(state.tabs.find((tab) => tab.id === 'clean-native')?.draftId).toBeNull();
    expect(state.tabs.find((tab) => tab.id === 'pathless')?.draftId).toBe('draft-created');
  });

  it('preserves pending conflict drafts without rewriting or deleting them', async () => {
    const conflictTab = createTab({
      id: 'conflict-native',
      nativePath: 'D:\\docs\\conflict.md',
      draftId: 'draft-conflict',
      markdown: '# disk',
      savedMarkdown: '# disk',
      dirty: false,
    });

    const state = await createPersistedWorkspaceState({
      tabs: [conflictTab],
      activeTabId: conflictTab.id,
      currentFolderPath: 'D:\\docs',
      desktopEnabled: true,
      preservedDraftIds: new Set(['draft-conflict']),
    });

    expect(writeWorkspaceDraft).not.toHaveBeenCalled();
    expect(deleteWorkspaceDraft).not.toHaveBeenCalled();
    expect(state.tabs[0]).toMatchObject({
      id: 'conflict-native',
      draftId: 'draft-conflict',
      dirty: false,
    });
  });

  it('migrates legacy workspace markdown into drafts only when needed', async () => {
    writeWorkspaceDraft.mockImplementation(async (markdown: string) => ({
      draftId: `draft-${markdown.length}`,
      markdown,
      updatedAt: 1,
    }));

    const result = await migrateWorkspaceSetting({
      valueJson: JSON.stringify({
        tabs: [
          createTab({
            id: 'clean-native',
            nativePath: 'D:\\docs\\clean.md',
            markdown: '# clean',
            dirty: false,
          }),
          createTab({
            id: 'dirty-native',
            nativePath: 'D:\\docs\\dirty.md',
            markdown: '# dirty',
            dirty: true,
          }),
          createTab({
            id: 'pathless',
            nativePath: null,
            markdown: '# local',
            dirty: false,
          }),
        ],
        activeTabId: 'dirty-native',
        currentFolderPath: 'D:\\docs',
      }),
    });

    expect(result?.migrated).toBe(true);
    expect(writeWorkspaceDraft).toHaveBeenCalledTimes(2);
    expect(result?.state.tabs.find((tab) => tab.id === 'clean-native')?.draftId).toBeNull();
    expect(result?.state.tabs.find((tab) => tab.id === 'dirty-native')?.draftId).toBe('draft-7');
    expect(result?.state.tabs.find((tab) => tab.id === 'pathless')?.draftId).toBe('draft-7');
    expect(JSON.stringify(result?.state)).not.toContain('markdown');
    expect(JSON.stringify(result?.state)).not.toContain('# clean');
  });
});

function createTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: 'tab-1',
    fileName: 'a.md',
    filePath: 'D:\\docs\\a.md',
    nativePath: 'D:\\docs\\a.md',
    draftId: null,
    markdown: '# a',
    savedMarkdown: '# a',
    dirty: false,
    lastKnownModifiedAt: 100,
    largeDocumentMode: false,
    readonlyDocumentMode: false,
    externalFileChange: {
      type: 'none',
      path: null,
      modifiedAt: 0,
      dirtyAtDetection: false,
      message: '',
    },
    version: 1,
    ...overrides,
  };
}
