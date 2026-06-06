import { listAppSettings, updateAppSetting } from '../../lib/desktop/tauriStorage';
import { CodeBlockNodeView } from '../../lib/editor-core/nodeViews/CodeBlockNodeView';
import { MermaidBlockNodeView } from '../../lib/editor-core/nodeViews/MermaidBlockNodeView';
import {
  DEFAULT_IMAGE_HANDLING_SETTINGS,
  type ImageHandlingSettings,
  type ImageInsertStrategy,
  type ImageUploadProvider,
} from '../../lib/services/render';

export interface PersistedEditorSettings {
  theme?: 'light' | 'dark';
  fontSize?: number;
  lineHeight?: number;
  contentWidthPercent?: number;
  blockStyle?: 'classic' | 'modern';
}

const IMAGE_SETTINGS_STORAGE_KEY = 'new-md-image-handling-settings';

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

export async function loadPersistedImageSettings(
  desktopEnabled: boolean,
): Promise<ImageHandlingSettings> {
  const nativeSettings = desktopEnabled ? await listAppSettings().catch(() => []) : [];
  const settings = new Map(nativeSettings.map((setting) => [setting.key, setting.valueJson]));
  const saved =
    parseSetting<Partial<ImageHandlingSettings>>(settings, 'imageHandlingSettings') ??
    parseLocalImageSettings();

  return normalizeImageSettings(saved);
}

export function persistImageSettings(desktopEnabled: boolean, settings: ImageHandlingSettings) {
  const normalized = normalizeImageSettings(settings);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(IMAGE_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  }
  if (!desktopEnabled) {
    return;
  }
  updateAppSetting('imageHandlingSettings', normalized).catch(() => undefined);
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

function parseLocalImageSettings(): Partial<ImageHandlingSettings> | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem(IMAGE_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Partial<ImageHandlingSettings>;
  } catch {
    return null;
  }
}

export function normalizeImageSettings(
  value: Partial<ImageHandlingSettings> | null | undefined,
): ImageHandlingSettings {
  const strategy = value?.imageInsertStrategy;
  const provider = value?.uploadProvider;

  return {
    imageInsertStrategy: isImageInsertStrategy(strategy)
      ? strategy
      : DEFAULT_IMAGE_HANDLING_SETTINGS.imageInsertStrategy,
    uploadProvider: isImageUploadProvider(provider)
      ? provider
      : DEFAULT_IMAGE_HANDLING_SETTINGS.uploadProvider,
    picgoServerUrl:
      typeof value?.picgoServerUrl === 'string' && value.picgoServerUrl.trim()
        ? value.picgoServerUrl.trim()
        : DEFAULT_IMAGE_HANDLING_SETTINGS.picgoServerUrl,
    picgoCoreCommand:
      typeof value?.picgoCoreCommand === 'string' && value.picgoCoreCommand.trim()
        ? value.picgoCoreCommand.trim()
        : DEFAULT_IMAGE_HANDLING_SETTINGS.picgoCoreCommand,
    picgoCoreConfigPath:
      typeof value?.picgoCoreConfigPath === 'string' ? value.picgoCoreConfigPath.trim() : '',
  };
}

function isImageInsertStrategy(value: unknown): value is ImageInsertStrategy {
  return (
    value === 'copy-current-folder' ||
    value === 'copy-assets' ||
    value === 'copy-document-assets' ||
    value === 'upload'
  );
}

function isImageUploadProvider(value: unknown): value is ImageUploadProvider {
  return value === 'picgo' || value === 'picgo-core';
}
