import {
  deleteWorkspaceDraft,
  writeWorkspaceDraft,
  type SettingRecord,
} from '../../lib/desktop/tauriStorage';
import type {
  ExternalFileChangeState,
  PersistedWorkspaceState,
  PersistedWorkspaceTab,
  Tab,
} from '../types';

type LegacyWorkspaceState = {
  tabs?: Array<Partial<Tab> & { markdown?: string; savedMarkdown?: string }>;
  activeTabId?: string;
  currentFolderPath?: string;
};

export interface WorkspaceMigrationResult {
  state: PersistedWorkspaceState;
  migrated: boolean;
}

export type WorkspaceDraftWritePolicy = 'write-needed' | 'missing-only' | 'skip';
export type WorkspaceDraftPersistPolicy = 'changed' | 'missing-only';

export interface WorkspaceDraftPersistenceCacheEntry {
  draftId: string;
  signature: string;
}

export type WorkspaceDraftPersistenceCache = Map<string, WorkspaceDraftPersistenceCacheEntry>;

export interface WorkspaceDraftPersistenceResult {
  changed: boolean;
  changedDraftIds: boolean;
}

export function isPersistedWorkspaceState(value: unknown): value is PersistedWorkspaceState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const state = value as Partial<PersistedWorkspaceState>;
  return state.version === 2 && Array.isArray(state.tabs) && typeof state.activeTabId === 'string';
}

export async function createPersistedWorkspaceState(input: {
  tabs: Tab[];
  activeTabId: string;
  currentFolderPath: string;
  desktopEnabled: boolean;
  preservedDraftIds?: ReadonlySet<string>;
  draftWritePolicy?: WorkspaceDraftWritePolicy;
}): Promise<PersistedWorkspaceState> {
  const persistedTabs: PersistedWorkspaceTab[] = [];
  const draftWritePolicy = input.draftWritePolicy ?? 'write-needed';

  for (const tab of input.tabs) {
    let draftId = tab.draftId ?? null;
    if (draftId && input.preservedDraftIds?.has(draftId)) {
      persistedTabs.push(toPersistedWorkspaceTab(tab, draftId));
      continue;
    }

    if (input.desktopEnabled && shouldPersistDraft(tab)) {
      const shouldWriteDraft =
        draftWritePolicy === 'write-needed' || (draftWritePolicy === 'missing-only' && !draftId);
      if (shouldWriteDraft) {
        const draft = await writeWorkspaceDraft(tab.markdown, draftId);
        draftId = draft.draftId;
        tab.draftId = draftId;
      }
    } else if (input.desktopEnabled && draftId) {
      if (draftWritePolicy !== 'skip') {
        await deleteWorkspaceDraft(draftId).catch(() => undefined);
        draftId = null;
        tab.draftId = null;
      }
    }

    persistedTabs.push(toPersistedWorkspaceTab(tab, draftId));
  }

  return {
    version: 2,
    tabs: persistedTabs,
    activeTabId: input.activeTabId,
    currentFolderPath: input.currentFolderPath || undefined,
  };
}

export async function persistWorkspaceDrafts(input: {
  tabs: Tab[];
  desktopEnabled: boolean;
  policy: WorkspaceDraftPersistPolicy;
  preservedDraftIds?: ReadonlySet<string>;
  cache?: WorkspaceDraftPersistenceCache;
}): Promise<WorkspaceDraftPersistenceResult> {
  const result: WorkspaceDraftPersistenceResult = {
    changed: false,
    changedDraftIds: false,
  };

  if (!input.desktopEnabled) {
    return result;
  }

  for (const tab of input.tabs) {
    let draftId = tab.draftId ?? null;
    if (draftId && input.preservedDraftIds?.has(draftId)) {
      continue;
    }

    if (shouldPersistDraft(tab)) {
      const signature = createWorkspaceDraftSignature(tab);
      const cached = input.cache?.get(tab.id);
      const hasCurrentDraft =
        Boolean(draftId) && cached?.draftId === draftId && cached.signature === signature;
      const shouldWrite = !draftId || (input.policy === 'changed' && !hasCurrentDraft);

      if (!shouldWrite) {
        continue;
      }

      const previousDraftId = draftId;
      const draft = await writeWorkspaceDraft(tab.markdown, draftId);
      draftId = draft.draftId;
      tab.draftId = draftId;
      input.cache?.set(tab.id, { draftId, signature });
      result.changed = true;
      result.changedDraftIds = result.changedDraftIds || previousDraftId !== draftId;
      continue;
    }

    if (draftId) {
      await deleteWorkspaceDraft(draftId).catch(() => undefined);
      tab.draftId = null;
      input.cache?.delete(tab.id);
      result.changed = true;
      result.changedDraftIds = true;
    }
  }

  return result;
}

export async function migrateWorkspaceSetting(
  setting: Pick<SettingRecord, 'valueJson'>,
): Promise<WorkspaceMigrationResult | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(setting.valueJson);
  } catch {
    return null;
  }

  if (isPersistedWorkspaceState(parsed)) {
    return { state: normalizePersistedWorkspaceState(parsed), migrated: false };
  }

  const legacy = parsed as LegacyWorkspaceState;
  if (!Array.isArray(legacy.tabs)) {
    return null;
  }

  const tabs: PersistedWorkspaceTab[] = [];
  for (const legacyTab of legacy.tabs) {
    const markdown = typeof legacyTab.markdown === 'string' ? legacyTab.markdown : '';
    const dirty = Boolean(legacyTab.dirty);
    const nativePath = typeof legacyTab.nativePath === 'string' ? legacyTab.nativePath : null;
    let draftId = typeof legacyTab.draftId === 'string' ? legacyTab.draftId : null;

    if (dirty || (!nativePath && markdown.length > 0)) {
      const draft = await writeWorkspaceDraft(markdown, draftId);
      draftId = draft.draftId;
    } else {
      draftId = null;
    }

    tabs.push(
      normalizePersistedWorkspaceTab({
        id: legacyTab.id,
        fileName: legacyTab.fileName,
        filePath: legacyTab.filePath,
        nativePath,
        draftId,
        dirty,
        lastKnownModifiedAt: legacyTab.lastKnownModifiedAt,
        largeDocumentMode: legacyTab.largeDocumentMode,
        readonlyDocumentMode: legacyTab.readonlyDocumentMode,
        version: legacyTab.version,
      }),
    );
  }

  return {
    migrated: true,
    state: {
      version: 2,
      tabs,
      activeTabId:
        typeof legacy.activeTabId === 'string' ? legacy.activeTabId : (tabs[0]?.id ?? ''),
      currentFolderPath:
        typeof legacy.currentFolderPath === 'string' ? legacy.currentFolderPath : undefined,
    },
  };
}

export function createRuntimeTabFromPersisted(
  tab: PersistedWorkspaceTab,
  markdown: string,
  options?: {
    savedMarkdown?: string;
    dirty?: boolean;
    lastKnownModifiedAt?: number;
    largeDocumentMode?: boolean;
    readonlyDocumentMode?: boolean;
    externalFileChange?: ExternalFileChangeState;
  },
): Tab {
  return {
    id: tab.id,
    fileName: tab.fileName,
    filePath: tab.filePath,
    nativePath: tab.nativePath,
    draftId: tab.draftId ?? null,
    markdown,
    savedMarkdown: options?.savedMarkdown ?? markdown,
    dirty: options?.dirty ?? tab.dirty,
    lastKnownModifiedAt: options?.lastKnownModifiedAt ?? tab.lastKnownModifiedAt,
    largeDocumentMode: options?.largeDocumentMode ?? tab.largeDocumentMode,
    readonlyDocumentMode: options?.readonlyDocumentMode ?? tab.readonlyDocumentMode,
    externalFileChange: options?.externalFileChange ?? {
      type: 'none',
      path: null,
      modifiedAt: 0,
      dirtyAtDetection: false,
      message: '',
    },
    version: tab.version,
  };
}

function shouldPersistDraft(tab: Tab) {
  return tab.dirty || (!tab.nativePath && tab.markdown.length > 0);
}

function createWorkspaceDraftSignature(tab: Tab) {
  return `${tab.version}:${hashText(tab.markdown)}`;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${value.length}:${hash >>> 0}`;
}

function toPersistedWorkspaceTab(tab: Tab, draftId: string | null): PersistedWorkspaceTab {
  return normalizePersistedWorkspaceTab({
    id: tab.id,
    fileName: tab.fileName,
    filePath: tab.filePath,
    nativePath: tab.nativePath,
    draftId,
    dirty: tab.dirty,
    lastKnownModifiedAt: tab.lastKnownModifiedAt,
    largeDocumentMode: tab.largeDocumentMode,
    readonlyDocumentMode: tab.readonlyDocumentMode,
    version: tab.version,
  });
}

function normalizePersistedWorkspaceState(state: PersistedWorkspaceState): PersistedWorkspaceState {
  return {
    version: 2,
    tabs: state.tabs.map(normalizePersistedWorkspaceTab),
    activeTabId: state.activeTabId,
    currentFolderPath:
      typeof state.currentFolderPath === 'string' ? state.currentFolderPath : undefined,
  };
}

function normalizePersistedWorkspaceTab(
  tab: Partial<PersistedWorkspaceTab>,
): PersistedWorkspaceTab {
  const fallbackId = createFallbackTabId();
  return {
    id: typeof tab.id === 'string' && tab.id ? tab.id : fallbackId,
    fileName: typeof tab.fileName === 'string' ? tab.fileName : 'untitled.md',
    filePath: typeof tab.filePath === 'string' ? tab.filePath : '',
    nativePath: typeof tab.nativePath === 'string' ? tab.nativePath : null,
    draftId: typeof tab.draftId === 'string' && tab.draftId ? tab.draftId : null,
    dirty: Boolean(tab.dirty),
    lastKnownModifiedAt: typeof tab.lastKnownModifiedAt === 'number' ? tab.lastKnownModifiedAt : 0,
    largeDocumentMode: Boolean(tab.largeDocumentMode),
    readonlyDocumentMode: Boolean(tab.readonlyDocumentMode),
    version: typeof tab.version === 'number' ? tab.version : 0,
  };
}

function createFallbackTabId() {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
