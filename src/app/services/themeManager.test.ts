import { beforeEach, describe, expect, it } from 'vitest';
import {
  THEME_BOOT_SNAPSHOT_KEY,
  applyResolvedTheme,
  bootstrapThemeFromSnapshot,
  readThemeBootSnapshot,
  resolveTheme,
  resolveThemeMode,
  writeThemeBootSnapshot,
} from './themeManager';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-preference');
  document.documentElement.removeAttribute('data-color-theme');
  document.documentElement.removeAttribute('data-document-style');
  document.documentElement.removeAttribute('data-block-style');
});

describe('themeManager', () => {
  it('resolves system mode and explicit modes independently from the color theme', () => {
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
    expect(resolveThemeMode('light', 'dark')).toBe('light');
    expect(resolveThemeMode('dark', 'light')).toBe('dark');

    const resolved = resolveTheme(
      {
        themeMode: 'dark',
        colorThemeId: 'nomo-amber-paper',
        documentStyleId: 'nomo-classic',
      },
      'light',
    );
    expect(resolved.effectiveScheme).toBe('dark');
    expect(resolved.preferences.colorThemeId).toBe('nomo-amber-paper');
  });

  it('applies explicit root attributes and every required color token', () => {
    const resolved = resolveTheme(
      {
        themeMode: 'light',
        colorThemeId: 'nomo-amber-paper',
        documentStyleId: 'nomo-classic',
      },
      'dark',
    );
    applyResolvedTheme(resolved);

    expect(document.documentElement.dataset).toMatchObject({
      theme: 'light',
      themePreference: 'light',
      colorTheme: 'nomo-amber-paper',
      documentStyle: 'nomo-classic',
      blockStyle: 'classic',
    });
    expect(document.documentElement.style.getPropertyValue('--md-editor-bg')).toBe('#F3F0E8');
    expect(document.documentElement.style.getPropertyValue('--md-editor-code-string')).not.toBe('');
  });

  it('round-trips a validated boot snapshot and ignores damaged snapshots', () => {
    const resolved = resolveTheme(
      {
        themeMode: 'dark',
        colorThemeId: 'nomo-amber-paper',
        documentStyleId: 'nomo-modern',
      },
      'light',
    );
    writeThemeBootSnapshot(resolved);
    expect(readThemeBootSnapshot()).toMatchObject({
      themeMode: 'dark',
      colorThemeId: 'nomo-amber-paper',
      effectiveScheme: 'dark',
    });

    localStorage.setItem(
      THEME_BOOT_SNAPSHOT_KEY,
      '{"schemaVersion":1,"effectiveScheme":"dark","tokens":{}}',
    );
    expect(readThemeBootSnapshot()).toBeNull();
    const fallback = bootstrapThemeFromSnapshot();
    expect(fallback.preferences.colorThemeId).toBe('nomo-default');
    expect(fallback.effectiveScheme).toBe('dark');
  });

  it('falls back for invalid theme and document style identifiers', () => {
    const resolved = resolveTheme({
      themeMode: 'system',
      colorThemeId: 'not-installed',
      documentStyleId: 'not-installed',
    });

    expect(resolved.preferences).toMatchObject({
      colorThemeId: 'nomo-default',
      documentStyleId: 'nomo-modern',
    });
  });
});
