import { describe, expect, it, vi } from 'vitest';
import {
  checkSoftwareUpdate,
  createSoftwareUpdateProgress,
  downloadSoftwareUpdate,
  installSoftwareUpdate,
  isSoftwareUpdateInstallerSupported,
  isSoftwareUpdateSupported,
  type SoftwareUpdateDownloadEvent,
  type SoftwareUpdateHandle,
} from './tauriUpdater';

function createMockUpdate(options: Partial<SoftwareUpdateHandle> = {}): SoftwareUpdateHandle {
  return {
    currentVersion: '0.1.3',
    version: '0.1.4',
    date: '2026-06-09T00:00:00Z',
    body: 'Bug fixes',
    download: vi.fn(async (onEvent?: (event: SoftwareUpdateDownloadEvent) => void) => {
      onEvent?.({ event: 'Started', data: { contentLength: 100 } });
      onEvent?.({ event: 'Progress', data: { chunkLength: 25 } });
      onEvent?.({ event: 'Progress', data: { chunkLength: 75 } });
      onEvent?.({ event: 'Finished' });
    }),
    install: vi.fn(async () => undefined),
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
      check: async () => createMockUpdate(),
    });

    expect(result).toEqual({
      supported: false,
      available: false,
      currentVersion: '0.1.3',
    });
  });

  it('returns unsupported check results outside a Windows installer installation', async () => {
    const check = vi.fn(async () => createMockUpdate());
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
      check: async () => null,
    });

    expect(result.supported).toBe(true);
    expect(result.available).toBe(false);
    expect(result.currentVersion).toBe('0.1.3');
  });

  it('returns available update metadata when a new version exists', async () => {
    const update = createMockUpdate();
    const result = await checkSoftwareUpdate({
      isDesktopRuntime: () => true,
      isWindowsRuntime: () => true,
      isInstallerRuntime: async () => true,
      getCurrentVersion: async () => '0.1.3',
      check: async () => update,
    });

    expect(result.supported).toBe(true);
    expect(result.available).toBe(true);
    expect(result.version).toBe('0.1.4');
    expect(result.update).toBe(update);
  });

  it('converts download events into percent progress', async () => {
    const progresses: number[] = [];

    await downloadSoftwareUpdate(createMockUpdate(), (progress) => {
      if (typeof progress.percent === 'number') {
        progresses.push(progress.percent);
      }
    });

    expect(progresses).toEqual([0, 25, 100, 100]);
  });

  it('rejects when download fails', async () => {
    const update = createMockUpdate({
      download: vi.fn(async () => {
        throw new Error('network failed');
      }),
    });

    await expect(downloadSoftwareUpdate(update)).rejects.toThrow('network failed');
  });

  it('installs and relaunches after install succeeds', async () => {
    const update = createMockUpdate();
    const relaunch = vi.fn(async () => undefined);

    await installSoftwareUpdate(update, {
      isDesktopRuntime: () => true,
      isWindowsRuntime: () => true,
      relaunch,
    });

    expect(update.install).toHaveBeenCalledOnce();
    expect(relaunch).toHaveBeenCalledOnce();
  });

  it('rejects when install fails', async () => {
    const update = createMockUpdate({
      install: vi.fn(async () => {
        throw new Error('install failed');
      }),
    });

    await expect(
      installSoftwareUpdate(update, {
        isDesktopRuntime: () => true,
        isWindowsRuntime: () => true,
        relaunch: vi.fn(async () => undefined),
      }),
    ).rejects.toThrow('install failed');
  });

  it('normalizes progress without a total size', () => {
    expect(createSoftwareUpdateProgress(50)).toEqual({
      downloadedBytes: 50,
      totalBytes: undefined,
      percent: undefined,
    });
  });
});
