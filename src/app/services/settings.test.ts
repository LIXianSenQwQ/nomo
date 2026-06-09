import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMock = vi.hoisted(() => ({
  listAppSettings: vi.fn(),
  updateAppSetting: vi.fn(),
  updateAppSettings: vi.fn(),
}));

vi.mock('../../lib/desktop/tauriStorage', () => storageMock);

import {
  DEFAULT_APP_PREFERENCES,
  applyZoomSetting,
  loadAppPreferences,
  normalizeAppPreferences,
  normalizeImageSettings,
} from './settings';

beforeEach(() => {
  storageMock.listAppSettings.mockReset();
  storageMock.updateAppSetting.mockReset();
  storageMock.updateAppSettings.mockReset();
  localStorage.clear();
});

describe('settings', () => {
  it('keeps automatic local image cleanup enabled for existing image settings', () => {
    expect(normalizeImageSettings({}).autoDeleteUnusedLocalImages).toBe(true);
  });

  it('preserves an explicit automatic local image cleanup choice', () => {
    expect(
      normalizeImageSettings({
        autoDeleteUnusedLocalImages: false,
      }).autoDeleteUnusedLocalImages,
    ).toBe(false);
  });

  it('keeps autosave disabled by default and guarded by settings', () => {
    const appSource = readFileSync(resolve(__dirname, '../App.svelte'), 'utf-8');
    const settingsWindowSource = readFileSync(
      resolve(__dirname, '../components/SettingsWindow.svelte'),
      'utf-8',
    );
    const documentActionsSource = readFileSync(
      resolve(__dirname, 'documentActionsController.ts'),
      'utf-8',
    );

    expect(appSource).toContain('DEFAULT_APP_PREFERENCES.autoSaveEnabled');
    expect(settingsWindowSource).toContain('t.autoSave()');
    expect(settingsWindowSource).toContain('autoSaveDelayMs');
    expect(appSource).toContain('autoSaveEnabled && desktopEnabled && dirty && nativePath');
    expect(documentActionsSource).toContain('if (!options.getAutoSaveEnabled()) return;');
    expect(documentActionsSource).toContain('options.getAutoSaveDelayMs()');
    expect(documentActionsSource).toContain('cancelPendingAutoSaves');
  });

  it('persists view preferences from the settings window', () => {
    const appSource = readFileSync(resolve(__dirname, '../App.svelte'), 'utf-8');
    const settingsWindowSource = readFileSync(
      resolve(__dirname, '../components/SettingsWindow.svelte'),
      'utf-8',
    );

    expect(settingsWindowSource).toContain('t.editorModeDefault()');
    expect(settingsWindowSource).toContain('t.hideExplorerOnLaunch()');
    expect(settingsWindowSource).toContain('t.showDocumentOutline()');
    expect(settingsWindowSource).toContain('setEditorMode');
    expect(settingsWindowSource).toContain('sidebarHidden');
    expect(settingsWindowSource).toContain('outlineVisible');
    expect(appSource).toContain("updateAppSetting('editorMode', nextMode)");
    expect(appSource).toContain("updateAppSetting('sidebarHidden', hidden)");
    expect(appSource).toContain("updateAppSetting('outlineVisible', visible)");
    expect(appSource).toContain('loadAppPreferences(desktopEnabled)');
    expect(appSource).toContain('loadAppPreferences(desktopEnabled, settings)');
    expect(appSource).toContain('applyAppPreferences');
  });

  it('reuses provided native settings rows without another desktop read', async () => {
    const preferences = await loadAppPreferences(true, [
      createSetting('themeFollowSystemMigrationV1', true),
      createSetting('fontSize', 18),
      createSetting('interfaceLanguage', 'ja-JP'),
    ]);

    expect(preferences.fontSize).toBe(18);
    expect(preferences.interfaceLanguage).toBe('ja-JP');
    expect(storageMock.listAppSettings).not.toHaveBeenCalled();
  });

  it('reads native settings when no reusable rows are provided', async () => {
    storageMock.listAppSettings.mockResolvedValue([
      createSetting('themeFollowSystemMigrationV1', true),
      createSetting('fontSize', 19),
    ]);

    const preferences = await loadAppPreferences(true);

    expect(preferences.fontSize).toBe(19);
    expect(storageMock.listAppSettings).toHaveBeenCalledTimes(1);
  });

  it('saves settings window changes as dirty preference patches', () => {
    const appSource = readFileSync(resolve(__dirname, '../App.svelte'), 'utf-8');
    const settingsWindowSource = readFileSync(
      resolve(__dirname, '../components/SettingsWindow.svelte'),
      'utf-8',
    );
    const settingsServiceSource = readFileSync(resolve(__dirname, 'settings.ts'), 'utf-8');
    const tauriStorageSource = readFileSync(
      resolve(__dirname, '../../lib/desktop/tauriStorage.ts'),
      'utf-8',
    );

    expect(settingsWindowSource).toContain('dirtyPreferenceKeys');
    expect(settingsWindowSource).toContain(
      'saveAppPreferences(desktopEnabled, settingsToSave, keysToSave)',
    );
    expect(settingsWindowSource).toContain("{ source: 'settings-window', patch }");
    expect(settingsWindowSource).toContain("'interfaceLanguage' in patch");
    expect(settingsServiceSource).toContain('updateAppSettings(persistedEntries)');
    expect(tauriStorageSource).toContain("invoke('update_app_settings'");
    expect(appSource).toContain('applyAppPreferencesPatch');
    expect(appSource).toContain('handleSettingsUpdated(event.payload)');
  });

  it('uses a real updater entry in the settings about page', () => {
    const appSource = readFileSync(resolve(__dirname, '../App.svelte'), 'utf-8');
    const settingsWindowSource = readFileSync(
      resolve(__dirname, '../components/SettingsWindow.svelte'),
      'utf-8',
    );

    expect(settingsWindowSource).toContain('checkForSoftwareUpdate');
    expect(settingsWindowSource).toContain('installDownloadedSoftwareUpdate');
    expect(settingsWindowSource).toContain('getSoftwareUpdateButtonLabel');
    expect(settingsWindowSource).toContain('isSoftwareUpdateIntegrityFailure');
    expect(settingsWindowSource).toContain('softwareUpdateIntegrityFailed');
    expect(settingsWindowSource).toContain('nomo://request-update-install');
    expect(settingsWindowSource).not.toContain(
      '<span class="disabled-pill">{t.futureVersionSupport()}</span>\n            </div>\n          </div>\n        {/if}',
    );
    expect(appSource).toContain('nomo://request-update-install');
    expect(appSource).toContain('nomo://update-install-decision');
    expect(appSource).toContain('unsavedChangesBeforeUpdate');
  });

  it('normalizes new preference boundaries and invalid enum values', () => {
    const normalized = normalizeAppPreferences({
      interfaceLanguage: 'zh-TW',
      autoSaveDelayMs: 50,
      largeDocumentLimit: 5_000_000,
      defaultDiagramType: 'unknown' as never,
      defaultCodeBlockLanguage: 'ts script!' as never,
    });

    expect(normalized.interfaceLanguage).toBe('zh-TW');
    expect(normalized.autoSaveDelayMs).toBe(500);
    expect(normalized.largeDocumentLimit).toBe(1_000_000);
    expect(normalized.defaultDiagramType).toBe(DEFAULT_APP_PREFERENCES.defaultDiagramType);
    expect(normalized.defaultCodeBlockLanguage).toBe(
      DEFAULT_APP_PREFERENCES.defaultCodeBlockLanguage,
    );
  });

  it('normalizes first and second batch preference fields', () => {
    const normalized = normalizeAppPreferences({
      theme: 'system',
      zoomPercent: 500,
      outlineDefaultExpandLevel: 0,
      codeBlockIndent: 'tab',
      inlineCodeRenderingEnabled: false,
      shortcutPreferences: {
        'toggle-source': 'Ctrl+Alt+E',
      },
      imageHandlingSettings: {
        defaultImageWidth: '2000%',
        defaultImageAlign: 'center',
      } as never,
    });

    expect(normalized.theme).toBe('system');
    expect(normalized.zoomPercent).toBe(160);
    expect(normalized.outlineDefaultExpandLevel).toBe(1);
    expect(normalized.codeBlockIndent).toBe('tab');
    expect(DEFAULT_APP_PREFERENCES.inlineCodeRenderingEnabled).toBe(true);
    expect(normalized.inlineCodeRenderingEnabled).toBe(false);
    expect(normalized.shortcutPreferences['toggle-source']).toBe('Ctrl+Alt+E');
    expect(normalized.imageHandlingSettings.defaultImageWidth).toBe('100%');
    expect(normalized.imageHandlingSettings.defaultImageAlign).toBe('center');
  });

  it('falls back to system interface language for invalid preference values', () => {
    const normalized = normalizeAppPreferences({
      interfaceLanguage: 'xx-XX' as never,
    });

    expect(normalized.interfaceLanguage).toBe('system');
  });

  it('preserves the Japanese interface language preference', () => {
    const normalized = normalizeAppPreferences({
      interfaceLanguage: 'ja-JP',
    });

    expect(normalized.interfaceLanguage).toBe('ja-JP');
  });

  it('falls back to enabled inline code rendering for invalid preference values', () => {
    const normalized = normalizeAppPreferences({
      inlineCodeRenderingEnabled: 'false' as never,
    });

    expect(normalized.inlineCodeRenderingEnabled).toBe(true);
  });

  it('normalizes close window behavior settings', () => {
    const normalized = normalizeAppPreferences({
      closeWindowBehavior: {} as never,
    });

    expect(DEFAULT_APP_PREFERENCES.closeWindowBehavior).toBe('ask-every-time');
    expect(normalized.closeWindowBehavior).toBe('ask-every-time');
    expect(
      normalizeAppPreferences({ closeWindowBehavior: 'close-to-tray' }).closeWindowBehavior,
    ).toBe('close-to-tray');
  });

  it('migrates legacy close-to-tray choices into close window behavior', async () => {
    await expect(
      loadAppPreferences(true, [
        createSetting('themeFollowSystemMigrationV1', true),
        createSetting('closeToTrayEnabled', true),
      ]),
    ).resolves.toMatchObject({ closeWindowBehavior: 'close-to-tray' });

    await expect(
      loadAppPreferences(true, [
        createSetting('themeFollowSystemMigrationV1', true),
        createSetting('closeToTrayEnabled', false),
        createSetting('closeToTrayPromptAnswered', true),
      ]),
    ).resolves.toMatchObject({ closeWindowBehavior: 'close-window' });

    await expect(
      loadAppPreferences(true, [
        createSetting('themeFollowSystemMigrationV1', true),
        createSetting('closeToTrayEnabled', false),
      ]),
    ).resolves.toMatchObject({ closeWindowBehavior: 'ask-every-time' });
  });

  it('calls the zoom frame callback after applying an immediate zoom value', () => {
    const onFrame = vi.fn();

    applyZoomSetting(120, { onFrame });

    expect(document.documentElement.style.getPropertyValue('--md-editor-zoom')).toBe('1.2');
    expect(onFrame).toHaveBeenCalledTimes(1);
  });

  it('calls the zoom frame callback while animated zoom is progressing', () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    const frames: FrameRequestCallback[] = [];
    let now = 0;
    const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => now);
    const onFrame = vi.fn();

    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = vi.fn() as typeof window.cancelAnimationFrame;

    try {
      applyZoomSetting(130, { transition: true, onFrame });
      expect(onFrame).not.toHaveBeenCalled();

      now = 75;
      frames.shift()?.(75);
      expect(onFrame).toHaveBeenCalledTimes(1);

      now = 200;
      frames.shift()?.(200);
      expect(document.documentElement.style.getPropertyValue('--md-editor-zoom')).toBe('1.3');
      expect(onFrame).toHaveBeenCalledTimes(3);
    } finally {
      dateNow.mockRestore();
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
      applyZoomSetting(100);
    }
  });
});

function createSetting(key: string, value: unknown) {
  return {
    key,
    valueJson: JSON.stringify(value),
    updatedAt: 1,
  };
}
