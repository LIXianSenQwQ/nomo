import { listAppSettings, updateAppSetting } from '../../lib/desktop/tauriStorage';

export interface PersistedEditorSettings {
  theme?: 'light' | 'dark';
  fontSize?: number;
  lineHeight?: number;
  contentWidthPercent?: number;
}

export async function loadPersistedEditorSettings(desktopEnabled: boolean): Promise<PersistedEditorSettings> {
  const nativeSettings = desktopEnabled ? await listAppSettings().catch(() => []) : [];
  const settings = new Map(nativeSettings.map((setting) => [setting.key, setting.valueJson]));
  const savedTheme = parseSetting<string>(settings, 'theme') ?? localStorage.getItem('new-md-theme');
  const savedFontSize = Number(parseSetting<number>(settings, 'fontSize') ?? localStorage.getItem('new-md-font-size'));
  const savedLineHeight = Number(parseSetting<number>(settings, 'lineHeight') ?? localStorage.getItem('new-md-line-height'));
  const savedContentWidthPercent = Number(parseSetting<number>(settings, 'contentWidthPercent') ?? localStorage.getItem('new-md-content-width-percent'));

  return {
    theme: savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : undefined,
    fontSize: Number.isFinite(savedFontSize) && savedFontSize >= 14 && savedFontSize <= 22 ? savedFontSize : undefined,
    lineHeight: Number.isFinite(savedLineHeight) && savedLineHeight >= 1.4 && savedLineHeight <= 2.1 ? savedLineHeight : undefined,
    contentWidthPercent:
      Number.isFinite(savedContentWidthPercent) && savedContentWidthPercent >= 45 && savedContentWidthPercent <= 90
        ? savedContentWidthPercent
        : undefined
  };
}

export function persistEditorSetting(desktopEnabled: boolean, key: string, value: unknown) {
  if (!desktopEnabled) {
    return;
  }
  updateAppSetting(key, value).catch(() => undefined);
}

export function applyThemeSetting(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : '';
}

export function applyTypographySettings(fontSize: number, lineHeight: number) {
  document.documentElement.style.setProperty('--md-editor-font-size', `${fontSize}px`);
  document.documentElement.style.setProperty('--md-editor-line-height', String(lineHeight));
}

export function applyEditorLayoutSettings(contentWidthPercent: number) {
  document.documentElement.style.setProperty('--md-editor-content-width-percent', String(contentWidthPercent));
}

function parseSetting<T>(settings: Map<string, string>, key: string): T | null {
  const value = settings.get(key);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
