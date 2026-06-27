import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '../types';
import {
  createPersistedWorkspaceState,
  migrateWorkspaceSetting,
  persistWorkspaceDrafts,
  type WorkspaceDraftPersistenceCache,
} from './workspacePersistence';

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

  it('can ensure missing draft ids without rewriting existing drafts', async () => {
    const existingDirty = createTab({
      id: 'existing-dirty',
      nativePath: 'D:\\docs\\existing.md',
      draftId: 'draft-existing',
      markdown: '# existing',
      dirty: true,
    });
    const missingDirty = createTab({
      id: 'missing-dirty',
      nativePath: 'D:\\docs\\missing.md',
      draftId: null,
      markdown: '# missing',
      dirty: true,
    });

    const state = await createPersistedWorkspaceState({
      tabs: [existingDirty, missingDirty],
      activeTabId: existingDirty.id,
      currentFolderPath: 'D:\\docs',
      desktopEnabled: true,
      draftWritePolicy: 'missing-only',
    });

    expect(writeWorkspaceDraft).toHaveBeenCalledTimes(1);
    expect(writeWorkspaceDraft).toHaveBeenCalledWith('# missing', null);
    expect(state.tabs.find((tab) => tab.id === 'existing-dirty')?.draftId).toBe('draft-existing');
    expect(state.tabs.find((tab) => tab.id === 'missing-dirty')?.draftId).toBe('draft-created');
  });

  it('can build workspace metadata without touching draft files', async () => {
    const dirtyTab = createTab({
      id: 'dirty-native',
      draftId: 'draft-existing',
      markdown: '# dirty',
      dirty: true,
    });

    const state = await createPersistedWorkspaceState({
      tabs: [dirtyTab],
      activeTabId: dirtyTab.id,
      currentFolderPath: 'D:\\docs',
      desktopEnabled: true,
      draftWritePolicy: 'skip',
    });

    expect(writeWorkspaceDraft).not.toHaveBeenCalled();
    expect(deleteWorkspaceDraft).not.toHaveBeenCalled();
    expect(state.tabs[0].draftId).toBe('draft-existing');
    expect(JSON.stringify(state)).not.toContain('# dirty');
  });

  it('persists changed drafts once per content signature', async () => {
    const cache: WorkspaceDraftPersistenceCache = new Map();
    const dirtyTab = createTab({
      id: 'dirty-native',
      nativePath: 'D:\\docs\\a.md',
      draftId: null,
      markdown: '# dirty',
      dirty: true,
      version: 1,
    });

    const first = await persistWorkspaceDrafts({
      tabs: [dirtyTab],
      desktopEnabled: true,
      policy: 'changed',
      cache,
    });
    const second = await persistWorkspaceDrafts({
      tabs: [dirtyTab],
      desktopEnabled: true,
      policy: 'changed',
      cache,
    });
    dirtyTab.markdown = '# dirty changed';
    dirtyTab.version = 2;
    const third = await persistWorkspaceDrafts({
      tabs: [dirtyTab],
      desktopEnabled: true,
      policy: 'changed',
      cache,
    });

    expect(first).toEqual({ changed: true, changedDraftIds: true });
    expect(second).toEqual({ changed: false, changedDraftIds: false });
    expect(third).toEqual({ changed: true, changedDraftIds: false });
    expect(writeWorkspaceDraft).toHaveBeenCalledTimes(2);
    expect(writeWorkspaceDraft).toHaveBeenNthCalledWith(1, '# dirty', null);
    expect(writeWorkspaceDraft).toHaveBeenNthCalledWith(2, '# dirty changed', 'draft-created');
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
