import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeImageSettings } from './settings';

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
    const settingsDrawerSource = readFileSync(
      resolve(__dirname, '../components/SettingsDrawer.svelte'),
      'utf-8',
    );
    const documentActionsSource = readFileSync(
      resolve(__dirname, 'documentActionsController.ts'),
      'utf-8',
    );

    expect(appSource).toContain('autoSaveEnabled = false');
    expect(appSource).toContain("updateAppSetting('autoSaveEnabled', nextAutoSaveEnabled)");
    expect(appSource).toContain('autoSaveEnabled && desktopEnabled && dirty && nativePath');
    expect(settingsDrawerSource).toContain('自动保存');
    expect(settingsDrawerSource).toContain('toggleAutoSaveEnabled');
    expect(documentActionsSource).toContain('if (!options.getAutoSaveEnabled()) return;');
    expect(documentActionsSource).toContain('cancelPendingAutoSaves');
  });

  it('persists view preferences from the settings drawer', () => {
    const appSource = readFileSync(resolve(__dirname, '../App.svelte'), 'utf-8');
    const settingsDrawerSource = readFileSync(
      resolve(__dirname, '../components/SettingsDrawer.svelte'),
      'utf-8',
    );

    expect(settingsDrawerSource).toContain('默认编辑模式');
    expect(settingsDrawerSource).toContain('隐藏资源管理器侧边栏');
    expect(settingsDrawerSource).toContain('显示文档大纲');
    expect(settingsDrawerSource).toContain('setDraftEditorMode');
    expect(settingsDrawerSource).toContain('toggleSidebarHidden');
    expect(settingsDrawerSource).toContain('toggleOutlineVisible');
    expect(appSource).toContain("updateAppSetting('editorMode', nextMode)");
    expect(appSource).toContain("updateAppSetting('sidebarHidden', hidden)");
    expect(appSource).toContain("updateAppSetting('outlineVisible', visible)");
    expect(appSource).toContain("settings.find((s) => s.key === 'editorMode')");
    expect(appSource).toContain("settings.find((s) => s.key === 'sidebarHidden')");
    expect(appSource).toContain("settings.find((s) => s.key === 'outlineVisible')");
  });
});
