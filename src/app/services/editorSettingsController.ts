import type { EditorCore } from '../../lib/editor-core';
import {
  applyEditorLayoutSettings,
  applyThemeSetting,
  applyTypographySettings,
  loadPersistedEditorSettings,
  persistEditorSetting,
} from './settings';

type Theme = 'light' | 'dark';

interface EditorSettingsControllerOptions {
  getDesktopEnabled(): boolean;
  getEditor(): EditorCore;
  getTheme(): Theme;
  setTheme(theme: Theme): void;
  getFontSize(): number;
  setFontSize(value: number): void;
  getLineHeight(): number;
  setLineHeight(value: number): void;
  getContentWidthPercent(): number;
  setContentWidthPercent(value: number): void;
}

export function createEditorSettingsController(options: EditorSettingsControllerOptions) {
  async function loadPersistedSettings() {
    const settings = await loadPersistedEditorSettings(options.getDesktopEnabled());

    if (settings.theme) {
      options.setTheme(settings.theme);
      applyThemeSetting(settings.theme);
      options.getEditor().updateTheme({ name: settings.theme });
    }
    if (settings.fontSize) {
      options.setFontSize(settings.fontSize);
      applyTypographySettings(options.getFontSize(), options.getLineHeight());
    }
    if (settings.lineHeight) {
      options.setLineHeight(settings.lineHeight);
      applyTypographySettings(options.getFontSize(), options.getLineHeight());
    }
    if (settings.contentWidthPercent) {
      options.setContentWidthPercent(settings.contentWidthPercent);
      applyEditorLayoutSettings(options.getContentWidthPercent());
    }
  }

  function toggleTheme() {
    const nextTheme = options.getTheme() === 'light' ? 'dark' : 'light';
    options.setTheme(nextTheme);
    applyThemeSetting(nextTheme);
    localStorage.setItem('new-md-theme', nextTheme);
    persistSetting('theme', nextTheme);
    options.getEditor().updateTheme({ name: nextTheme });
  }

  function updateFontSize(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    options.setFontSize(value);
    localStorage.setItem('new-md-font-size', String(value));
    persistSetting('fontSize', value);
    applyTypographySettings(options.getFontSize(), options.getLineHeight());
  }

  function updateLineHeight(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    options.setLineHeight(value);
    localStorage.setItem('new-md-line-height', String(value));
    persistSetting('lineHeight', value);
    applyTypographySettings(options.getFontSize(), options.getLineHeight());
  }

  function updateContentWidth(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    options.setContentWidthPercent(value);
    localStorage.setItem('new-md-content-width-percent', String(value));
    persistSetting('contentWidthPercent', value);
    applyEditorLayoutSettings(options.getContentWidthPercent());
  }

  function persistSetting(key: string, value: unknown) {
    persistEditorSetting(options.getDesktopEnabled(), key, value);
  }

  return {
    loadPersistedSettings,
    toggleTheme,
    updateFontSize,
    updateLineHeight,
    updateContentWidth,
  };
}
