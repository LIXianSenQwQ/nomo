import type { EditorCore } from '../../lib/editor-core';
import {
  applyBlockStyleSetting,
  applyEditorLayoutSettings,
  applyThemeSetting,
  applyTypographySettings,
  loadPersistedEditorSettings,
  persistEditorSetting,
  type ThemePreference,
} from './settings';

type Theme = 'light' | 'dark';

interface EditorSettingsControllerOptions {
  getDesktopEnabled(): boolean;
  getEditor(): EditorCore;
  getTheme(): Theme;
  setTheme(theme: ThemePreference): void;
  getFontSize(): number;
  setFontSize(value: number): void;
  getLineHeight(): number;
  setLineHeight(value: number): void;
  getContentWidthPercent(): number;
  setContentWidthPercent(value: number): void;
  getBlockStyle(): 'classic' | 'modern';
  setBlockStyle(value: 'classic' | 'modern'): void;
}

export function createEditorSettingsController(options: EditorSettingsControllerOptions) {
  async function loadPersistedSettings() {
    const settings = await loadPersistedEditorSettings(options.getDesktopEnabled());

    if (settings.theme) {
      options.setTheme(settings.theme);
      const effectiveTheme = applyThemeSetting(settings.theme);
      options.getEditor().updateTheme({ name: effectiveTheme });
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
    if (settings.blockStyle) {
      options.setBlockStyle(settings.blockStyle);
      applyBlockStyleSetting(settings.blockStyle);
    }
  }

  function toggleTheme() {
    const nextTheme = options.getTheme() === 'light' ? 'dark' : 'light';
    options.setTheme(nextTheme);
    applyThemeSetting(nextTheme, { transition: true });
    localStorage.setItem('nomo-theme', nextTheme);
    persistSetting('theme', nextTheme);
    options.getEditor().updateTheme({ name: nextTheme });
  }

  function updateFontSizeValue(value: number) {
    options.setFontSize(value);
    localStorage.setItem('nomo-font-size', String(value));
    persistSetting('fontSize', value);
    applyTypographySettings(options.getFontSize(), options.getLineHeight());
  }

  function updateFontSize(event: Event) {
    updateFontSizeValue(Number((event.currentTarget as HTMLInputElement).value));
  }

  function updateLineHeightValue(value: number) {
    options.setLineHeight(value);
    localStorage.setItem('nomo-line-height', String(value));
    persistSetting('lineHeight', value);
    applyTypographySettings(options.getFontSize(), options.getLineHeight());
  }

  function updateLineHeight(event: Event) {
    updateLineHeightValue(Number((event.currentTarget as HTMLInputElement).value));
  }

  function updateContentWidth(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    options.setContentWidthPercent(value);
    localStorage.setItem('nomo-content-width-percent', String(value));
    persistSetting('contentWidthPercent', value);
    applyEditorLayoutSettings(options.getContentWidthPercent());
  }

  function updateBlockStyle(blockStyle: 'classic' | 'modern') {
    options.setBlockStyle(blockStyle);
    localStorage.setItem('nomo-block-style', blockStyle);
    persistSetting('blockStyle', blockStyle);
    applyBlockStyleSetting(blockStyle);
  }

  function persistSetting(key: string, value: unknown) {
    persistEditorSetting(options.getDesktopEnabled(), key, value);
  }

  return {
    loadPersistedSettings,
    toggleTheme,
    updateFontSize,
    updateFontSizeValue,
    updateLineHeight,
    updateLineHeightValue,
    updateContentWidth,
    updateBlockStyle,
  };
}
