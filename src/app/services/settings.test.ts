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
    expect(settingsWindowSource).toContain('自动保存');
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

    expect(settingsWindowSource).toContain('启动默认编辑模式');
    expect(settingsWindowSource).toContain('启动时隐藏资源管理器侧边栏');
    expect(settingsWindowSource).toContain('显示文档大纲');
    expect(settingsWindowSource).toContain('setEditorMode');
    expect(settingsWindowSource).toContain('sidebarHidden');
    expect(settingsWindowSource).toContain('outlineVisible');
    expect(appSource).toContain("updateAppSetting('editorMode', nextMode)");
    expect(appSource).toContain("updateAppSetting('sidebarHidden', hidden)");
    expect(appSource).toContain("updateAppSetting('outlineVisible', visible)");
    expect(appSource).toContain('loadAppPreferences(desktopEnabled)');
    expect(appSource).toContain('applyAppPreferences');
  });

  it('normalizes new preference boundaries and invalid enum values', () => {
    const normalized = normalizeAppPreferences({
      autoSaveDelayMs: 50,
      largeDocumentLimit: 5_000_000,
      defaultDiagramType: 'unknown' as never,
      defaultCodeBlockLanguage: 'ts script!' as never,
    });

    expect(normalized.autoSaveDelayMs).toBe(500);
    expect(normalized.largeDocumentLimit).toBe(1_000_000);
    expect(normalized.defaultDiagramType).toBe(DEFAULT_APP_PREFERENCES.defaultDiagramType);
    expect(normalized.defaultCodeBlockLanguage).toBe(
      DEFAULT_APP_PREFERENCES.defaultCodeBlockLanguage,
    );
  });
});
