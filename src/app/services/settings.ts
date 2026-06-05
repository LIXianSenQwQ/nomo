import { listAppSettings, updateAppSetting } from '../../lib/desktop/tauriStorage';
import { CodeBlockNodeView } from '../../lib/editor-core/nodeViews/CodeBlockNodeView';
import { MermaidBlockNodeView } from '../../lib/editor-core/nodeViews/MermaidBlockNodeView';

export interface PersistedEditorSettings {
  theme?: 'light' | 'dark';
  fontSize?: number;
  lineHeight?: number;
  contentWidthPercent?: number;
  blockStyle?: 'classic' | 'modern';
}

export async function loadPersistedEditorSettings(
  desktopEnabled: boolean,
): Promise<PersistedEditorSettings> {
  const nativeSettings = desktopEnabled ? await listAppSettings().catch(() => []) : [];
  const settings = new Map(nativeSettings.map((setting) => [setting.key, setting.valueJson]));
  const savedTheme =
    parseSetting<string>(settings, 'theme') ?? localStorage.getItem('new-md-theme');
  const savedFontSize = Number(
    parseSetting<number>(settings, 'fontSize') ?? localStorage.getItem('new-md-font-size'),
  );
  const savedLineHeight = Number(
    parseSetting<number>(settings, 'lineHeight') ?? localStorage.getItem('new-md-line-height'),
  );
  const savedContentWidthPercent = Number(
    parseSetting<number>(settings, 'contentWidthPercent') ??
      localStorage.getItem('new-md-content-width-percent'),
  );
  const savedBlockStyle =
    parseSetting<string>(settings, 'blockStyle') ?? localStorage.getItem('new-md-block-style');

  return {
    theme: savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : undefined,
    fontSize:
      Number.isFinite(savedFontSize) && savedFontSize >= 14 && savedFontSize <= 22
        ? savedFontSize
        : undefined,
    lineHeight:
      Number.isFinite(savedLineHeight) && savedLineHeight >= 1.4 && savedLineHeight <= 2.1
        ? savedLineHeight
        : undefined,
    contentWidthPercent:
      Number.isFinite(savedContentWidthPercent) &&
      savedContentWidthPercent >= 45 &&
      savedContentWidthPercent <= 90
        ? savedContentWidthPercent
        : undefined,
    blockStyle: savedBlockStyle === 'classic' || savedBlockStyle === 'modern'
      ? savedBlockStyle
      : undefined,
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
  // 通知代码块更新语法高亮主题
  CodeBlockNodeView.updateTheme();
  MermaidBlockNodeView.updateTheme();
}

export function applyTypographySettings(fontSize: number, lineHeight: number) {
  document.documentElement.style.setProperty('--md-editor-font-size', `${fontSize}px`);
  document.documentElement.style.setProperty('--md-editor-line-height', String(lineHeight));
}

export function applyEditorLayoutSettings(contentWidthPercent: number) {
  document.documentElement.style.setProperty(
    '--md-editor-content-width-percent',
    String(contentWidthPercent),
  );
}

export function applyBlockStyleSetting(blockStyle: 'classic' | 'modern') {
  document.documentElement.dataset.blockStyle = blockStyle;
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
