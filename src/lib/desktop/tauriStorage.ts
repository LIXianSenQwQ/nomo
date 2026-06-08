import type { UnlistenFn } from '@tauri-apps/api/event';

export interface NativeDocument {
  path: string;
  fileName: string;
  markdown: string;
  modifiedAt: number;
  sizeBytes: number;
  readonly: boolean;
}

export type RecentEntryType = 'file' | 'folder';

export interface RecentEntry {
  path: string;
  entryType: RecentEntryType;
  title?: string | null;
  modifiedAt: number;
  wordCount: number;
  openedAt: number;
}

/** @deprecated 使用 RecentEntry */
export type RecentDocument = RecentEntry;

export interface SettingRecord {
  key: string;
  valueJson: string;
  updatedAt: number;
}

export interface FileStatus {
  path: string;
  exists: boolean;
  isFile: boolean;
  modifiedAt: number;
  sizeBytes: number;
  readonly: boolean;
}

export interface SnapshotRecord {
  id: string;
  documentPath: string;
  contentHash: string;
  markdown: string;
  createdAt: number;
  reason: string;
}

export interface WindowState {
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
}

export type DesktopMenuCommand =
  | 'new-file'
  | 'new-window'
  | 'open-file'
  | 'open-directory'
  | 'save-file'
  | 'save-file-as'
  | 'undo'
  | 'redo'
  | 'toggle-blockquote'
  | 'insert-table'
  | 'insert-math-block'
  | 'insert-code-block'
  | 'toggle-source'
  | 'toggle-theme'
  | 'toggle-focus'
  | string;

interface NativeDocumentPayload {
  path: string;
  file_name: string;
  markdown: string;
  modified_at: number;
  size_bytes: number;
  readonly: boolean;
}

interface RecentEntryPayload {
  path: string;
  entry_type: RecentEntryType;
  title?: string | null;
  modified_at: number;
  word_count: number;
  opened_at: number;
}

interface SettingRecordPayload {
  key: string;
  value_json: string;
  updated_at: number;
}

interface FileStatusPayload {
  path: string;
  exists: boolean;
  is_file: boolean;
  modified_at: number;
  size_bytes: number;
  readonly: boolean;
}

interface SnapshotRecordPayload {
  id: string;
  document_path: string;
  content_hash: string;
  markdown: string;
  created_at: number;
  reason: string;
}

interface ExternalOpenPayload {
  paths?: unknown;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function openMarkdownWithDialog(): Promise<NativeDocument | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: 'Markdown',
        extensions: ['md', 'markdown', 'txt'],
      },
    ],
  });

  if (typeof selected !== 'string') {
    return null;
  }

  return readMarkdownFile(selected);
}

export async function openFolderWithDialog(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    multiple: false,
    directory: true,
  });

  return typeof selected === 'string' ? selected : null;
}

export async function readMarkdownFile(path: string): Promise<NativeDocument> {
  const { invoke } = await import('@tauri-apps/api/core');
  return normalizeDocumentPayload(
    await invoke<NativeDocumentPayload>('read_markdown_file', { path }),
  );
}

export async function installSampleDocument(): Promise<NativeDocument> {
  const { invoke } = await import('@tauri-apps/api/core');
  return normalizeDocumentPayload(await invoke<NativeDocumentPayload>('install_sample_document'));
}

export async function saveMarkdownNative(
  path: string | null,
  markdown: string,
  fallbackName: string,
): Promise<NativeDocument | null> {
  const { invoke } = await import('@tauri-apps/api/core');
  const { save } = await import('@tauri-apps/plugin-dialog');
  const targetPath =
    path ??
    (await save({
      defaultPath: fallbackName,
      filters: [
        {
          name: 'Markdown',
          extensions: ['md', 'markdown'],
        },
      ],
    }));

  if (!targetPath) {
    return null;
  }

  return normalizeDocumentPayload(
    await invoke<NativeDocumentPayload>('write_markdown_file', { path: targetPath, markdown }),
  );
}

export async function checkPathsExist(paths: string[]): Promise<boolean[]> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<boolean[]>('check_paths_exist', { paths });
}

export async function statMarkdownFile(path: string): Promise<FileStatus> {
  const { invoke } = await import('@tauri-apps/api/core');
  return normalizeFileStatus(await invoke<FileStatusPayload>('stat_markdown_file', { path }));
}

export async function rememberRecentEntry(
  path: string,
  entryType: RecentEntryType,
  title: string | null,
  wordCount: number,
): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('remember_recent_entry', {
    input: {
      path,
      entry_type: entryType,
      title,
      word_count: wordCount,
    },
  });
}

/** @deprecated 使用 rememberRecentEntry */
export async function rememberRecentFile(
  path: string,
  title: string | null,
  wordCount: number,
): Promise<void> {
  return rememberRecentEntry(path, 'file', title, wordCount);
}

export async function listRecentEntries(): Promise<RecentEntry[]> {
  const { invoke } = await import('@tauri-apps/api/core');
  const rows = await invoke<RecentEntryPayload[]>('list_recent_entries');
  return rows.map((row) => ({
    path: row.path,
    entryType: row.entry_type,
    title: row.title,
    modifiedAt: row.modified_at,
    wordCount: row.word_count,
    openedAt: row.opened_at,
  }));
}

/** @deprecated 使用 listRecentEntries */
export async function listRecentFiles(): Promise<RecentDocument[]> {
  return listRecentEntries();
}

export async function clearRecentEntries(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('clear_recent_entries');
}

export async function createDocumentSnapshot(
  path: string,
  markdown: string,
  reason: string,
): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('create_document_snapshot', {
    input: {
      path,
      markdown,
      reason,
    },
  });
}

export async function listDocumentSnapshots(path: string): Promise<SnapshotRecord[]> {
  const { invoke } = await import('@tauri-apps/api/core');
  const rows = await invoke<SnapshotRecordPayload[]>('list_document_snapshots', { path });
  return rows.map((row) => ({
    id: row.id,
    documentPath: row.document_path,
    contentHash: row.content_hash,
    markdown: row.markdown,
    createdAt: row.created_at,
    reason: row.reason,
  }));
}

export async function updateAppSetting(key: string, value: unknown): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('update_app_setting', {
    input: {
      key,
      value_json: JSON.stringify(value),
    },
  });
}

export async function listAppSettings(): Promise<SettingRecord[]> {
  const { invoke } = await import('@tauri-apps/api/core');
  const rows = await invoke<SettingRecordPayload[]>('list_app_settings');
  return rows.map((row) => ({
    key: row.key,
    valueJson: row.value_json,
    updatedAt: row.updated_at,
  }));
}

export async function updateWindowState(state: WindowState): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const label = getCurrentWindow().label || 'main';
  await invoke('update_window_state', {
    key: `windowState:${label}`,
    input: toSnakeWindowState(state),
  });
}

export async function openExternalLink(href: string): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('open_external_link', { href });
}

export async function createFolder(path: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('create_folder', { path });
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('rename_file', { oldPath, newPath });
}

export async function deleteFile(path: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('delete_file', { path });
}

export async function revealInExplorer(path: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('reveal_in_explorer', { path });
}

export async function readCurrentWindowState(): Promise<WindowState> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const currentWindow = getCurrentWindow();
  const [position, size] = await Promise.all([
    currentWindow.outerPosition(),
    currentWindow.innerSize(),
  ]);

  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  };
}

export async function listenDesktopMenuCommands(
  handler: (command: DesktopMenuCommand) => void,
): Promise<UnlistenFn> {
  const { listen } = await import('@tauri-apps/api/event');
  return listen<string>('nomo://menu-command', (event) =>
    handler(event.payload as DesktopMenuCommand),
  );
}

export async function listenDesktopFileDrops(
  handler: (paths: string[]) => void,
): Promise<UnlistenFn> {
  const { listen, TauriEvent } = await import('@tauri-apps/api/event');
  return listen<{ paths: string[] }>(TauriEvent.DRAG_DROP, (event) => handler(event.payload.paths));
}

export async function listenDesktopOpenDocuments(
  handler: (paths: string[]) => void,
): Promise<UnlistenFn> {
  const { listen } = await import('@tauri-apps/api/event');
  return listen<ExternalOpenPayload>('nomo://open-document', (event) => {
    const paths = Array.isArray(event.payload?.paths)
      ? event.payload.paths.filter((path): path is string => typeof path === 'string')
      : [];
    if (paths.length > 0) {
      handler(paths);
    }
  });
}

function normalizeDocumentPayload(payload: NativeDocumentPayload): NativeDocument {
  return {
    path: payload.path,
    fileName: payload.file_name,
    markdown: payload.markdown,
    modifiedAt: payload.modified_at,
    sizeBytes: payload.size_bytes,
    readonly: payload.readonly,
  };
}

function normalizeFileStatus(payload: FileStatusPayload): FileStatus {
  return {
    path: payload.path,
    exists: payload.exists,
    isFile: payload.is_file,
    modifiedAt: payload.modified_at,
    sizeBytes: payload.size_bytes,
    readonly: payload.readonly,
  };
}

function toSnakeWindowState(state: WindowState) {
  return {
    x: state.x ?? null,
    y: state.y ?? null,
    width: state.width ?? null,
    height: state.height ?? null,
  };
}

/**
 * 解析 Tauri 原生错误消息，返回错误码和可读消息。
 * - 支持 '[ERROR_CODE] message' 格式的字符串
 * - 对于 Error 对象，提取其 message 属性后递归解析
 * - 非字符串类型回退到 UNKNOWN
 */
export function parseNativeError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    return parseNativeError(error.message);
  }
  if (typeof error !== 'string') {
    return { code: 'UNKNOWN', message: String(error) };
  }
  const match = error.match(/^\[([A-Z_]+)\]\s*(.*)$/);
  if (match) {
    return { code: match[1], message: match[2] };
  }
  return { code: 'UNKNOWN', message: error };
}
