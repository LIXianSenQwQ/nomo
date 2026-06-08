import { listAppSettings, updateAppSetting } from '../../lib/desktop/tauriStorage';
import { CodeBlockNodeView } from '../../lib/editor-core/nodeViews/CodeBlockNodeView';
import { MermaidBlockNodeView } from '../../lib/editor-core/nodeViews/MermaidBlockNodeView';
import type { DiagramType } from '../../lib/editor-core/diagramTemplates';
import {
  DEFAULT_IMAGE_HANDLING_SETTINGS,
  type ImageHandlingSettings,
  type ImageInsertStrategy,
  type ImageUploadProvider,
} from '../../lib/services/render';

export type ThemePreference = 'light' | 'dark';
export type EditorModePreference = 'semantic' | 'source';
export type BlockStylePreference = 'classic' | 'modern';
export type FolderOpenDefaultBehavior = 'current-window' | 'new-window' | 'ask-every-time';
export type WritingStatsMetric = 'lines' | 'words' | 'chars';

export interface PersistedEditorSettings {
  theme?: ThemePreference;
  fontSize?: number;
  lineHeight?: number;
  contentWidthPercent?: number;
  blockStyle?: BlockStylePreference;
}

export interface AppPreferences {
  theme: ThemePreference;
  editorMode: EditorModePreference;
  autoSaveEnabled: boolean;
  autoSaveDelayMs: number;
  createSnapshotBeforeSave: boolean;
  fontSize: number;
  lineHeight: number;
  contentWidthPercent: number;
  blockStyle: BlockStylePreference;
  largeDocumentLimit: number;
  folderOpenDefaultBehavior: FolderOpenDefaultBehavior;
  filePreviewEnabled: boolean;
  closeToTrayEnabled: boolean;
  sidebarHidden: boolean;
  outlineVisible: boolean;
  writingStatsVisible: boolean;
  writingStatsMetric: WritingStatsMetric;
  readingTimeVisible: boolean;
  defaultCodeBlockLanguage: string;
  defaultDiagramType: DiagramType;
  imageHandlingSettings: ImageHandlingSettings;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  theme: 'light',
  editorMode: 'semantic',
  autoSaveEnabled: false,
  autoSaveDelayMs: 1000,
  createSnapshotBeforeSave: true,
  fontSize: 16,
  lineHeight: 1.75,
  contentWidthPercent: 68,
  blockStyle: 'modern',
  largeDocumentLimit: 300_000,
  folderOpenDefaultBehavior: 'ask-every-time',
  filePreviewEnabled: true,
  closeToTrayEnabled: false,
  sidebarHidden: false,
  outlineVisible: true,
  writingStatsVisible: true,
  writingStatsMetric: 'words',
  readingTimeVisible: false,
  defaultCodeBlockLanguage: 'ts',
  defaultDiagramType: 'flowchart',
  imageHandlingSettings: { ...DEFAULT_IMAGE_HANDLING_SETTINGS },
};

export const SETTINGS_UPDATED_EVENT = 'nomo://settings-updated';

const IMAGE_SETTINGS_STORAGE_KEY = 'nomo-image-handling-settings';
const THEME_TRANSITION_CLASS = 'theme-transitioning';
const THEME_TRANSITION_MS = 180;
let themeTransitionTimer: number | null = null;

export async function loadPersistedEditorSettings(
  desktopEnabled: boolean,
): Promise<PersistedEditorSettings> {
  const nativeSettings = desktopEnabled ? await listAppSettings().catch(() => []) : [];
  const settings = new Map(nativeSettings.map((setting) => [setting.key, setting.valueJson]));
  const savedTheme = parseSetting<string>(settings, 'theme') ?? localStorage.getItem('nomo-theme');
  const savedFontSize = Number(
    parseSetting<number>(settings, 'fontSize') ?? localStorage.getItem('nomo-font-size'),
  );
  const savedLineHeight = Number(
    parseSetting<number>(settings, 'lineHeight') ?? localStorage.getItem('nomo-line-height'),
  );
  const savedContentWidthPercent = Number(
    parseSetting<number>(settings, 'contentWidthPercent') ??
      localStorage.getItem('nomo-content-width-percent'),
  );
  const savedBlockStyle =
    parseSetting<string>(settings, 'blockStyle') ?? localStorage.getItem('nomo-block-style');

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
    blockStyle:
      savedBlockStyle === 'classic' || savedBlockStyle === 'modern' ? savedBlockStyle : undefined,
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

export async function loadAppPreferences(desktopEnabled: boolean): Promise<AppPreferences> {
  const nativeSettings = desktopEnabled ? await listAppSettings().catch(() => []) : [];
  const settings = new Map(nativeSettings.map((setting) => [setting.key, setting.valueJson]));
  const local = readLocalPreferenceFallbacks();

  return normalizeAppPreferences({
    theme: parseSetting<unknown>(settings, 'theme') ?? local.theme,
    editorMode: parseSetting<unknown>(settings, 'editorMode'),
    autoSaveEnabled: parseSetting<unknown>(settings, 'autoSaveEnabled'),
    autoSaveDelayMs: parseSetting<unknown>(settings, 'autoSaveDelayMs'),
    createSnapshotBeforeSave: parseSetting<unknown>(settings, 'createSnapshotBeforeSave'),
    fontSize: parseSetting<unknown>(settings, 'fontSize') ?? local.fontSize,
    lineHeight: parseSetting<unknown>(settings, 'lineHeight') ?? local.lineHeight,
    contentWidthPercent:
      parseSetting<unknown>(settings, 'contentWidthPercent') ?? local.contentWidthPercent,
    blockStyle: parseSetting<unknown>(settings, 'blockStyle') ?? local.blockStyle,
    largeDocumentLimit: parseSetting<unknown>(settings, 'largeDocumentLimit'),
    folderOpenDefaultBehavior: parseSetting<unknown>(settings, 'folderOpenDefaultBehavior'),
    filePreviewEnabled: parseSetting<unknown>(settings, 'filePreviewEnabled'),
    closeToTrayEnabled: parseSetting<unknown>(settings, 'closeToTrayEnabled'),
    sidebarHidden: parseSetting<unknown>(settings, 'sidebarHidden'),
    outlineVisible: parseSetting<unknown>(settings, 'outlineVisible'),
    writingStatsVisible: parseSetting<unknown>(settings, 'writingStatsVisible'),
    writingStatsMetric: parseSetting<unknown>(settings, 'writingStatsMetric'),
    readingTimeVisible: parseSetting<unknown>(settings, 'readingTimeVisible'),
    defaultCodeBlockLanguage: parseSetting<unknown>(settings, 'defaultCodeBlockLanguage'),
    defaultDiagramType: parseSetting<unknown>(settings, 'defaultDiagramType'),
    imageHandlingSettings:
      parseSetting<Partial<ImageHandlingSettings>>(settings, 'imageHandlingSettings') ??
      parseLocalImageSettings(),
  });
}

export async function saveAppPreferences(desktopEnabled: boolean, preferences: AppPreferences) {
  const normalized = normalizeAppPreferences(preferences);

  writeLocalPreferenceFallbacks(normalized);
  persistImageSettings(desktopEnabled, normalized.imageHandlingSettings);

  if (!desktopEnabled) {
    return normalized;
  }

  await Promise.all(
    Object.entries(toPersistedPreferenceEntries(normalized)).map(([key, value]) =>
      updateAppSetting(key, value),
    ),
  );

  return normalized;
}

export function normalizeAppPreferences(
  value: Partial<Record<keyof AppPreferences, unknown>>,
): AppPreferences {
  return {
    theme: isThemePreference(value.theme) ? value.theme : DEFAULT_APP_PREFERENCES.theme,
    editorMode: isEditorModePreference(value.editorMode)
      ? value.editorMode
      : DEFAULT_APP_PREFERENCES.editorMode,
    autoSaveEnabled:
      typeof value.autoSaveEnabled === 'boolean'
        ? value.autoSaveEnabled
        : DEFAULT_APP_PREFERENCES.autoSaveEnabled,
    autoSaveDelayMs: clampNumber(value.autoSaveDelayMs, 500, 5000, 1000),
    createSnapshotBeforeSave:
      typeof value.createSnapshotBeforeSave === 'boolean'
        ? value.createSnapshotBeforeSave
        : DEFAULT_APP_PREFERENCES.createSnapshotBeforeSave,
    fontSize: clampNumber(value.fontSize, 14, 22, DEFAULT_APP_PREFERENCES.fontSize),
    lineHeight: clampNumber(value.lineHeight, 1.4, 2.1, DEFAULT_APP_PREFERENCES.lineHeight),
    contentWidthPercent: clampNumber(
      value.contentWidthPercent,
      45,
      90,
      DEFAULT_APP_PREFERENCES.contentWidthPercent,
    ),
    blockStyle: isBlockStylePreference(value.blockStyle)
      ? value.blockStyle
      : DEFAULT_APP_PREFERENCES.blockStyle,
    largeDocumentLimit: clampNumber(
      value.largeDocumentLimit,
      100_000,
      1_000_000,
      DEFAULT_APP_PREFERENCES.largeDocumentLimit,
    ),
    folderOpenDefaultBehavior: isFolderOpenDefaultBehavior(value.folderOpenDefaultBehavior)
      ? value.folderOpenDefaultBehavior
      : DEFAULT_APP_PREFERENCES.folderOpenDefaultBehavior,
    filePreviewEnabled:
      typeof value.filePreviewEnabled === 'boolean'
        ? value.filePreviewEnabled
        : DEFAULT_APP_PREFERENCES.filePreviewEnabled,
    closeToTrayEnabled:
      typeof value.closeToTrayEnabled === 'boolean'
        ? value.closeToTrayEnabled
        : DEFAULT_APP_PREFERENCES.closeToTrayEnabled,
    sidebarHidden:
      typeof value.sidebarHidden === 'boolean'
        ? value.sidebarHidden
        : DEFAULT_APP_PREFERENCES.sidebarHidden,
    outlineVisible:
      typeof value.outlineVisible === 'boolean'
        ? value.outlineVisible
        : DEFAULT_APP_PREFERENCES.outlineVisible,
    writingStatsVisible:
      typeof value.writingStatsVisible === 'boolean'
        ? value.writingStatsVisible
        : DEFAULT_APP_PREFERENCES.writingStatsVisible,
    writingStatsMetric: isWritingStatsMetric(value.writingStatsMetric)
      ? value.writingStatsMetric
      : DEFAULT_APP_PREFERENCES.writingStatsMetric,
    readingTimeVisible:
      typeof value.readingTimeVisible === 'boolean'
        ? value.readingTimeVisible
        : DEFAULT_APP_PREFERENCES.readingTimeVisible,
    defaultCodeBlockLanguage:
      typeof value.defaultCodeBlockLanguage === 'string' &&
      /^[A-Za-z0-9_+#.-]{1,32}$/.test(value.defaultCodeBlockLanguage.trim())
        ? value.defaultCodeBlockLanguage.trim()
        : DEFAULT_APP_PREFERENCES.defaultCodeBlockLanguage,
    defaultDiagramType: isDiagramTypePreference(value.defaultDiagramType)
      ? value.defaultDiagramType
      : DEFAULT_APP_PREFERENCES.defaultDiagramType,
    imageHandlingSettings: normalizeImageSettings(
      value.imageHandlingSettings as Partial<ImageHandlingSettings> | null | undefined,
    ),
  };
}

export function applyThemeSetting(theme: ThemePreference, options?: { transition?: boolean }) {
  if (options?.transition && !prefersReducedMotion()) {
    document.documentElement.classList.add(THEME_TRANSITION_CLASS);
    if (themeTransitionTimer !== null) {
      window.clearTimeout(themeTransitionTimer);
    }
    themeTransitionTimer = window.setTimeout(() => {
      document.documentElement.classList.remove(THEME_TRANSITION_CLASS);
      themeTransitionTimer = null;
    }, THEME_TRANSITION_MS + 40);
  }

  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : '';
  // 通知代码块更新语法高亮主题
  CodeBlockNodeView.updateTheme();
  MermaidBlockNodeView.updateTheme();
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
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

export function applyBlockStyleSetting(blockStyle: BlockStylePreference) {
  document.documentElement.dataset.blockStyle = blockStyle;
}

function toPersistedPreferenceEntries(preferences: AppPreferences) {
  return {
    theme: preferences.theme,
    editorMode: preferences.editorMode,
    autoSaveEnabled: preferences.autoSaveEnabled,
    autoSaveDelayMs: preferences.autoSaveDelayMs,
    createSnapshotBeforeSave: preferences.createSnapshotBeforeSave,
    fontSize: preferences.fontSize,
    lineHeight: preferences.lineHeight,
    contentWidthPercent: preferences.contentWidthPercent,
    blockStyle: preferences.blockStyle,
    largeDocumentLimit: preferences.largeDocumentLimit,
    folderOpenDefaultBehavior: preferences.folderOpenDefaultBehavior,
    filePreviewEnabled: preferences.filePreviewEnabled,
    closeToTrayEnabled: preferences.closeToTrayEnabled,
    sidebarHidden: preferences.sidebarHidden,
    outlineVisible: preferences.outlineVisible,
    writingStatsVisible: preferences.writingStatsVisible,
    writingStatsMetric: preferences.writingStatsMetric,
    readingTimeVisible: preferences.readingTimeVisible,
    defaultCodeBlockLanguage: preferences.defaultCodeBlockLanguage,
    defaultDiagramType: preferences.defaultDiagramType,
    imageHandlingSettings: preferences.imageHandlingSettings,
  };
}

function readLocalPreferenceFallbacks(): Partial<AppPreferences> {
  if (typeof localStorage === 'undefined') {
    return {};
  }

  return {
    theme: localStorage.getItem('nomo-theme') ?? undefined,
    fontSize: localStorage.getItem('nomo-font-size') ?? undefined,
    lineHeight: localStorage.getItem('nomo-line-height') ?? undefined,
    contentWidthPercent: localStorage.getItem('nomo-content-width-percent') ?? undefined,
    blockStyle: localStorage.getItem('nomo-block-style') ?? undefined,
  } as Partial<AppPreferences>;
}

function writeLocalPreferenceFallbacks(preferences: AppPreferences) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem('nomo-theme', preferences.theme);
  localStorage.setItem('nomo-font-size', String(preferences.fontSize));
  localStorage.setItem('nomo-line-height', String(preferences.lineHeight));
  localStorage.setItem('nomo-content-width-percent', String(preferences.contentWidthPercent));
  localStorage.setItem('nomo-block-style', preferences.blockStyle);
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
    autoDeleteUnusedLocalImages:
      typeof value?.autoDeleteUnusedLocalImages === 'boolean'
        ? value.autoDeleteUnusedLocalImages
        : DEFAULT_IMAGE_HANDLING_SETTINGS.autoDeleteUnusedLocalImages,
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

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = typeof value === 'string' ? Number(value) : Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numberValue));
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark';
}

function isEditorModePreference(value: unknown): value is EditorModePreference {
  return value === 'semantic' || value === 'source';
}

function isBlockStylePreference(value: unknown): value is BlockStylePreference {
  return value === 'classic' || value === 'modern';
}

function isFolderOpenDefaultBehavior(value: unknown): value is FolderOpenDefaultBehavior {
  return value === 'current-window' || value === 'new-window' || value === 'ask-every-time';
}

function isWritingStatsMetric(value: unknown): value is WritingStatsMetric {
  return value === 'lines' || value === 'words' || value === 'chars';
}

function isDiagramTypePreference(value: unknown): value is DiagramType {
  return (
    value === 'flowchart' ||
    value === 'sequenceDiagram' ||
    value === 'classDiagram' ||
    value === 'stateDiagram' ||
    value === 'pie' ||
    value === 'gantt' ||
    value === 'erDiagram'
  );
}
