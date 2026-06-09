import { isTauriRuntime } from './tauriStorage';

export type SoftwareUpdateStatus =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'unsupported'
  | 'error';

export interface SoftwareUpdateCheckResult {
  supported: boolean;
  available: boolean;
  currentVersion: string;
  version?: string;
  date?: string;
  body?: string;
  update?: SoftwareUpdateHandle;
}

export interface SoftwareUpdateProgress {
  downloadedBytes: number;
  totalBytes?: number;
  percent?: number;
}

export interface SoftwareUpdateUiState {
  status: SoftwareUpdateStatus;
  message: string;
  version?: string;
  progress?: SoftwareUpdateProgress;
  error?: string;
}

export type SoftwareUpdateDownloadEvent =
  | { event: 'Started'; data: { contentLength?: number } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished' };

export interface SoftwareUpdateHandle {
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
  download(onEvent?: (event: SoftwareUpdateDownloadEvent) => void): Promise<void>;
  install(): Promise<void>;
  close?(): Promise<void>;
}

interface SoftwareUpdateRuntime {
  isDesktopRuntime: () => boolean;
  isWindowsRuntime: () => boolean;
  isInstallerRuntime: () => Promise<boolean>;
  getCurrentVersion: () => Promise<string>;
  check: () => Promise<SoftwareUpdateHandle | null>;
  relaunch: () => Promise<void>;
}

export function isSoftwareUpdateSupported(runtime: Partial<SoftwareUpdateRuntime> = {}): boolean {
  return (
    (runtime.isDesktopRuntime ?? isTauriRuntime)() && (runtime.isWindowsRuntime ?? isWindows)()
  );
}

export async function isSoftwareUpdateInstallerSupported(
  runtime: Partial<SoftwareUpdateRuntime> = {},
): Promise<boolean> {
  const fullRuntime = await resolveRuntime(runtime);
  return isSoftwareUpdateSupported(fullRuntime) && (await fullRuntime.isInstallerRuntime());
}

export async function checkSoftwareUpdate(
  runtime: Partial<SoftwareUpdateRuntime> = {},
): Promise<SoftwareUpdateCheckResult> {
  const fullRuntime = await resolveRuntime(runtime);
  const currentVersion = await fullRuntime.getCurrentVersion().catch(() => '');

  if (!isSoftwareUpdateSupported(fullRuntime) || !(await fullRuntime.isInstallerRuntime())) {
    return {
      supported: false,
      available: false,
      currentVersion,
    };
  }

  const update = await fullRuntime.check();
  if (!update) {
    return {
      supported: true,
      available: false,
      currentVersion,
    };
  }

  return {
    supported: true,
    available: true,
    currentVersion: update.currentVersion || currentVersion,
    version: update.version,
    date: update.date,
    body: update.body,
    update,
  };
}

export async function downloadSoftwareUpdate(
  update: SoftwareUpdateHandle,
  onProgress?: (progress: SoftwareUpdateProgress) => void,
): Promise<void> {
  let downloadedBytes = 0;
  let totalBytes: number | undefined;

  await update.download((event) => {
    if (event.event === 'Started') {
      downloadedBytes = 0;
      totalBytes = event.data.contentLength;
    } else if (event.event === 'Progress') {
      downloadedBytes += event.data.chunkLength;
    } else if (event.event === 'Finished' && typeof totalBytes === 'number') {
      downloadedBytes = totalBytes;
    }

    onProgress?.(createSoftwareUpdateProgress(downloadedBytes, totalBytes));
  });
}

export async function installSoftwareUpdate(
  update: SoftwareUpdateHandle,
  runtime: Partial<SoftwareUpdateRuntime> = {},
): Promise<void> {
  const fullRuntime = await resolveRuntime(runtime);
  await update.install();
  await fullRuntime.relaunch();
}

export function createSoftwareUpdateProgress(
  downloadedBytes: number,
  totalBytes?: number,
): SoftwareUpdateProgress {
  const safeDownloaded = Math.max(0, downloadedBytes);
  const safeTotal = typeof totalBytes === 'number' && totalBytes > 0 ? totalBytes : undefined;

  return {
    downloadedBytes: safeDownloaded,
    totalBytes: safeTotal,
    percent: safeTotal ? Math.min(100, Math.round((safeDownloaded / safeTotal) * 100)) : undefined,
  };
}

async function resolveRuntime(
  runtime: Partial<SoftwareUpdateRuntime>,
): Promise<SoftwareUpdateRuntime> {
  return {
    isDesktopRuntime: runtime.isDesktopRuntime ?? isTauriRuntime,
    isWindowsRuntime: runtime.isWindowsRuntime ?? isWindows,
    isInstallerRuntime: runtime.isInstallerRuntime ?? defaultIsInstallerRuntime,
    getCurrentVersion: runtime.getCurrentVersion ?? defaultGetCurrentVersion,
    check: runtime.check ?? defaultCheck,
    relaunch: runtime.relaunch ?? defaultRelaunch,
  };
}

async function defaultGetCurrentVersion(): Promise<string> {
  const { getVersion } = await import('@tauri-apps/api/app');
  return getVersion();
}

async function defaultCheck(): Promise<SoftwareUpdateHandle | null> {
  const { check } = await import('@tauri-apps/plugin-updater');
  return check() as Promise<SoftwareUpdateHandle | null>;
}

async function defaultIsInstallerRuntime(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<boolean>('is_windows_installer_installation').catch(() => false);
}

async function defaultRelaunch(): Promise<void> {
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}

function isWindows(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgentNavigator = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform =
    userAgentNavigator.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;
  return /win/i.test(platform);
}
