export interface Tab {
  id: string;
  fileName: string;
  filePath: string;
  nativePath: string | null;
  draftId?: string | null;
  markdown: string;
  savedMarkdown: string;
  dirty: boolean;
  lastKnownModifiedAt: number;
  largeDocumentMode: boolean;
  readonlyDocumentMode: boolean;
  diskReadonly: boolean;
  externalFileChange: ExternalFileChangeState;
  version: number;
}

export type ExternalFileChangeType = 'none' | 'modified' | 'deleted';

export interface ExternalFileChangeState {
  type: ExternalFileChangeType;
  path: string | null;
  modifiedAt: number;
  dirtyAtDetection: boolean;
  message: string;
}

export function createEmptyExternalFileChange(): ExternalFileChangeState {
  return {
    type: 'none',
    path: null,
    modifiedAt: 0,
    dirtyAtDetection: false,
    message: '',
  };
}

export function normalizeExternalFileChange(value: unknown): ExternalFileChangeState {
  if (!value || typeof value !== 'object') {
    return createEmptyExternalFileChange();
  }

  const state = value as Partial<ExternalFileChangeState>;
  if (state.type !== 'modified' && state.type !== 'deleted') {
    return createEmptyExternalFileChange();
  }

  return {
    type: state.type,
    path: typeof state.path === 'string' ? state.path : null,
    modifiedAt: typeof state.modifiedAt === 'number' ? state.modifiedAt : 0,
    dirtyAtDetection: Boolean(state.dirtyAtDetection),
    message: typeof state.message === 'string' ? state.message : '',
  };
}

export interface FileTreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  has_children?: boolean;
  children_loaded?: boolean;
  loading?: boolean;
  children: FileTreeNode[];
}

export interface WorkspaceState {
  tabs: Tab[];
  activeTabId: string;
  currentFolderPath?: string;
}

export interface PersistedWorkspaceTab {
  id: string;
  fileName: string;
  filePath: string;
  nativePath: string | null;
  draftId?: string | null;
  dirty: boolean;
  lastKnownModifiedAt: number;
  largeDocumentMode: boolean;
  readonlyDocumentMode: boolean;
  diskReadonly: boolean;
  version: number;
}

export interface PersistedWorkspaceState {
  version: 2;
  tabs: PersistedWorkspaceTab[];
  activeTabId: string;
  currentFolderPath?: string;
}
