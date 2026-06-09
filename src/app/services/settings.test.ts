import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_PREFERENCES,
  normalizeAppPreferences,
  normalizeImageSettings,
} from './settings';

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
    expect(appSource).toContain('applyAppPreferences');
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
});
