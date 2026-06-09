import { describe, expect, it, vi } from 'vitest';
import {
  checkSoftwareUpdate,
  createSoftwareUpdateProgress,
  downloadSoftwareUpdate,
  installSoftwareUpdate,
  isSoftwareUpdateInstallerSupported,
  isSoftwareUpdateIntegrityFailure,
  isSoftwareUpdateSupported,
  type DownloadedSoftwareUpdate,
  type SoftwareUpdateCandidate,
  type SoftwareUpdateProgressEvent,
} from './tauriUpdater';

function createMockCandidate(options: Partial<SoftwareUpdateCandidate> = {}): SoftwareUpdateCandidate {
  return {
    version: '0.1.4',
    date: '2026-06-09T00:00:00Z',
    body: 'Bug fixes',
    assetName: 'Nomo_0.1.4_x64-setup.exe',
    assetSize: 100,
    downloadUrl: 'https://example.test/Nomo_0.1.4_x64-setup.exe',
    md5: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ...options,
  };
}

function createDownloadedUpdate(
  options: Partial<DownloadedSoftwareUpdate> = {},
): DownloadedSoftwareUpdate {
  return {
    version: '0.1.4',
    assetName: 'Nomo_0.1.4_x64-setup.exe',
    filePath: 'C:\\Users\\Qing Yu\\AppData\\Local\\Nomo\\updates\\Nomo_0.1.4_x64-setup.exe',
    md5: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    downloadedBytes: 100,
    ...options,
  };
}

describe('tauriUpdater', () => {
  it('reports unsupported outside a Windows desktop runtime', () => {
    expect(
      isSoftwareUpdateSupported({
        isDesktopRuntime: () => false,
        isWindowsRuntime: () => true,
      }),
    ).toBe(false);
    expect(
      isSoftwareUpdateSupported({
        isDesktopRuntime: () => true,
        isWindowsRuntime: () => false,
      }),
    ).toBe(false);
  });

  it('returns unsupported check results for non-desktop runtime', async () => {
    const result = await checkSoftwareUpdate({
      isDesktopRuntime: () => false,
      isWindowsRuntime: () => true,
      getCurrentVersion: async () => '0.1.3',
      check: async () => ({
        supported: true,
        available: true,
        currentVersion: '0.1.3',
        candidate: createMockCandidate(),
      }),
    });

    expect(result).toEqual({
      supported: false,
      available: false,
      currentVersion: '0.1.3',
    });
  });

  it('returns unsupported check results outside a Windows installer installation', async () => {
    const check = vi.fn(async () => ({
      supported: true,
      available: true,
      currentVersion: '0.1.3',
      candidate: createMockCandidate(),
    }));
    const result = await checkSoftwareUpdate({
      isDesktopRuntime: () => true,
      isWindowsRuntime: () => true,
      isInstallerRuntime: async () => false,
      getCurrentVersion: async () => '0.1.3',
      check,
    });

    expect(result).toEqual({
      supported: false,
      available: false,
      currentVersion: '0.1.3',
    });
    expect(check).not.toHaveBeenCalled();
  });

  it('reports installer-supported runtime only for Windows desktop installer builds', async () => {
    await expect(
      isSoftwareUpdateInstallerSupported({
        isDesktopRuntime: () => true,
        isWindowsRuntime: () => true,
        isInstallerRuntime: async () => true,
      }),
    ).resolves.toBe(true);
  });

  it('returns up-to-date check results when no update is available', async () => {
    const result = await checkSoftwareUpdate({
      isDesktopRuntime: () => true,
      isWindowsRuntime: () => true,
      isInstallerRuntime: async () => true,
      getCurrentVersion: async () => '0.1.3',
      check: async () => ({
        supported: true,
        available: false,
        currentVersion: '0.1.3',
      }),
    });

    expect(result.supported).toBe(true);
    expect(result.available).toBe(false);
    expect(result.currentVersion).toBe('0.1.3');
  });

  it('returns available update metadata when a new version exists', async () => {
    const candidate = createMockCandidate();
    const result = await checkSoftwareUpdate({
      isDesktopRuntime: () => true,
      isWindowsRuntime: () => true,
      isInstallerRuntime: async () => true,
      getCurrentVersion: async () => '0.1.3',
      check: async () => ({
        supported: true,
        available: true,
        currentVersion: '0.1.3',
        version: candidate.version,
        date: candidate.date,
        body: candidate.body,
        candidate,
      }),
    });

    expect(result.supported).toBe(true);
    expect(result.available).toBe(true);
    expect(result.version).toBe('0.1.4');
    expect(result.candidate).toBe(candidate);
  });

  it('converts download progress events into percent progress', async () => {
    const progresses: number[] = [];
    const candidate = createMockCandidate();
    const downloadedUpdate = createDownloadedUpdate();
    let progressHandler: ((event: SoftwareUpdateProgressEvent) => void) | null = null;
    const unlisten = vi.fn();

    const result = await downloadSoftwareUpdate(
      candidate,
      (progress) => {
        if (typeof progress.percent === 'number') {
          progresses.push(progress.percent);
        }
      },
      {
        download: vi.fn(async (_candidate, requestId) => {
          progressHandler?.({ requestId, downloadedBytes: 0, totalBytes: 100, percent: 0 });
          progressHandler?.({ requestId, downloadedBytes: 25, totalBytes: 100, percent: 25 });
          progressHandler?.({ requestId: 'other', downloadedBytes: 50, totalBytes: 100, percent: 50 });
          progressHandler?.({ requestId, downloadedBytes: 100, totalBytes: 100, percent: 100 });
          return downloadedUpdate;
        }),
        listenProgress: async (handler) => {
          progressHandler = handler;
          return unlisten;
        },
      },
    );

    expect(result).toBe(downloadedUpdate);
    expect(progresses).toEqual([0, 25, 100]);
    expect(unlisten).toHaveBeenCalledOnce();
  });

  it('rejects when download fails and cleans up listener', async () => {
    const unlisten = vi.fn();

    await expect(
      downloadSoftwareUpdate(createMockCandidate(), undefined, {
        download: vi.fn(async () => {
          throw new Error('network failed');
        }),
        listenProgress: async () => unlisten,
      }),
    ).rejects.toThrow('network failed');
    expect(unlisten).not.toHaveBeenCalled();
  });

  it('installs a verified downloaded update', async () => {
    const downloadedUpdate = createDownloadedUpdate();
    const install = vi.fn(async () => undefined);

    await installSoftwareUpdate(downloadedUpdate, { install });

    expect(install).toHaveBeenCalledWith(downloadedUpdate);
  });

  it('rejects when install fails', async () => {
    await expect(
      installSoftwareUpdate(createDownloadedUpdate(), {
        install: vi.fn(async () => {
          throw new Error('install failed');
        }),
      }),
    ).rejects.toThrow('install failed');
  });

  it('detects integrity failures from backend errors', () => {
    expect(isSoftwareUpdateIntegrityFailure(new Error('更新包校验失败'))).toBe(true);
    expect(isSoftwareUpdateIntegrityFailure('MD5 mismatch')).toBe(true);
    expect(isSoftwareUpdateIntegrityFailure(new Error('network failed'))).toBe(false);
  });

  it('normalizes progress without a total size', () => {
    expect(createSoftwareUpdateProgress(50)).toEqual({
      downloadedBytes: 50,
      totalBytes: undefined,
      percent: undefined,
    });
  });
});
