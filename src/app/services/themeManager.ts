import type {
  AppearancePreferences,
  ColorScheme,
  EditorThemeOptions,
  ThemeColorTokens,
  ThemeMode,
} from '../../lib/theme/types';
import { getDesktopSystemTheme, setDesktopIconTheme } from './desktopWindow';
import {
  DEFAULT_COLOR_THEME_ID,
  DEFAULT_DOCUMENT_STYLE_ID,
  THEME_TOKEN_CSS_VARIABLES,
  isRegisteredDocumentStyleId,
  isRegisteredThemeId,
  themeRegistry,
} from './themeRegistry';

export const THEME_BOOT_SNAPSHOT_KEY = 'nomo.themeBootSnapshot.v1';
export const THEME_BOOT_SNAPSHOT_SCHEMA_VERSION = 1;

const THEME_TRANSITION_CLASS = 'theme-transitioning';
const THEME_TRANSITION_MS = 180;
let themeTransitionTimer: number | null = null;

export interface ResolvedTheme {
  preferences: AppearancePreferences;
  effectiveScheme: ColorScheme;
  themeVersion: string;
  tokens: ThemeColorTokens;
  editorTheme: EditorThemeOptions;
}

export interface ThemeBootSnapshot {
  schemaVersion: 1;
  themeVersion: string;
  themeMode: ThemeMode;
  colorThemeId: string;
  documentStyleId: string;
  effectiveScheme: ColorScheme;
  tokens: ThemeColorTokens;
}

export interface ThemeRuntimeEditor {
  updateTheme(theme: EditorThemeOptions): void;
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function isColorScheme(value: unknown): value is ColorScheme {
  return value === 'light' || value === 'dark';
}

export function resolveThemeMode(mode: ThemeMode, systemScheme = getBrowserSystemScheme()) {
  return mode === 'system' ? systemScheme : mode;
}

export function getBrowserSystemScheme(): ColorScheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function normalizeAppearancePreferences(
  value: Partial<AppearancePreferences> | null | undefined,
): AppearancePreferences {
  return {
    themeMode: isThemeMode(value?.themeMode) ? value.themeMode : 'system',
    colorThemeId: isRegisteredThemeId(value?.colorThemeId)
      ? value.colorThemeId
      : DEFAULT_COLOR_THEME_ID,
    documentStyleId: isRegisteredDocumentStyleId(value?.documentStyleId)
      ? value.documentStyleId
      : DEFAULT_DOCUMENT_STYLE_ID,
  };
}

export function resolveTheme(
  value: Partial<AppearancePreferences>,
  systemScheme = getBrowserSystemScheme(),
): ResolvedTheme {
  const preferences = normalizeAppearancePreferences(value);
  const effectiveScheme = resolveThemeMode(preferences.themeMode, systemScheme);
  const theme =
    themeRegistry.getTheme(preferences.colorThemeId) ??
    themeRegistry.getTheme(DEFAULT_COLOR_THEME_ID);
  if (!theme) {
    throw new Error('默认主题未注册');
  }
  const variant = theme.variants[effectiveScheme] ?? theme.variants.light;
  if (!variant) {
    throw new Error(`主题缺少可用变体：${theme.id}`);
  }

  return {
    preferences: {
      ...preferences,
      colorThemeId: theme.id,
    },
    effectiveScheme,
    themeVersion: theme.version,
    tokens: variant.tokens,
    editorTheme: {
      name: effectiveScheme,
      colorThemeId: theme.id,
      shikiTheme: variant.shikiTheme,
      mermaid: variant.mermaid,
    },
  };
}

export function applyResolvedTheme(
  resolved: ResolvedTheme,
  options?: { transition?: boolean; root?: HTMLElement },
) {
  const root = options?.root ?? document.documentElement;
  startThemeTransition(root, options?.transition === true);

  root.dataset.theme = resolved.effectiveScheme;
  root.dataset.themePreference = resolved.preferences.themeMode;
  root.dataset.colorTheme = resolved.preferences.colorThemeId;
  root.dataset.documentStyle = resolved.preferences.documentStyleId;

  const documentStyle =
    themeRegistry.getDocumentStyle(resolved.preferences.documentStyleId) ??
    themeRegistry.getDocumentStyle(DEFAULT_DOCUMENT_STYLE_ID);
  root.dataset.blockStyle = documentStyle?.legacyBlockStyle ?? 'modern';

  for (const [tokenName, cssVariable] of Object.entries(THEME_TOKEN_CSS_VARIABLES)) {
    root.style.setProperty(cssVariable, resolved.tokens[tokenName as keyof ThemeColorTokens]);
  }
  root.style.colorScheme = resolved.effectiveScheme;
  return resolved;
}

export async function applyThemeRuntime(
  preferences: Partial<AppearancePreferences>,
  options?: {
    transition?: boolean;
    systemScheme?: ColorScheme;
    desktopEnabled?: boolean;
    editor?: ThemeRuntimeEditor | null;
  },
) {
  const resolved = resolveTheme(preferences, options?.systemScheme);
  applyResolvedTheme(resolved, { transition: options?.transition });
  options?.editor?.updateTheme(resolved.editorTheme);
  if (options?.desktopEnabled !== undefined) {
    await setDesktopIconTheme(options.desktopEnabled, resolved.effectiveScheme).catch(
      () => undefined,
    );
  }
  return resolved;
}

export async function readEffectiveSystemScheme(desktopEnabled: boolean) {
  return (
    (await getDesktopSystemTheme(desktopEnabled).catch(() => null)) ?? getBrowserSystemScheme()
  );
}

export function writeThemeBootSnapshot(resolved: ResolvedTheme) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const snapshot: ThemeBootSnapshot = {
    schemaVersion: THEME_BOOT_SNAPSHOT_SCHEMA_VERSION,
    themeVersion: resolved.themeVersion,
    themeMode: resolved.preferences.themeMode,
    colorThemeId: resolved.preferences.colorThemeId,
    documentStyleId: resolved.preferences.documentStyleId,
    effectiveScheme: resolved.effectiveScheme,
    tokens: resolved.tokens,
  };
  localStorage.setItem(THEME_BOOT_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function readThemeBootSnapshot(): ThemeBootSnapshot | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const value = localStorage.getItem(THEME_BOOT_SNAPSHOT_KEY);
  if (!value) {
    return null;
  }
  try {
    const snapshot = JSON.parse(value) as Partial<ThemeBootSnapshot>;
    if (!isValidThemeBootSnapshot(snapshot)) {
      return null;
    }
    return snapshot as ThemeBootSnapshot;
  } catch {
    return null;
  }
}

export function bootstrapThemeFromSnapshot() {
  const snapshot = readThemeBootSnapshot();
  if (snapshot) {
    const resolved = resolveTheme(snapshot, snapshot.effectiveScheme);
    if (
      resolved.themeVersion === snapshot.themeVersion &&
      tokensMatch(resolved.tokens, snapshot.tokens)
    ) {
      return applyResolvedTheme(resolved);
    }
  }

  const fallback = resolveTheme(
    {
      themeMode: 'system',
      colorThemeId: DEFAULT_COLOR_THEME_ID,
      documentStyleId: DEFAULT_DOCUMENT_STYLE_ID,
    },
    readThemeBootSchemeHint() ?? getBrowserSystemScheme(),
  );
  return applyResolvedTheme(fallback);
}

function readThemeBootSchemeHint(): ColorScheme | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const value = JSON.parse(localStorage.getItem(THEME_BOOT_SNAPSHOT_KEY) ?? 'null') as {
      effectiveScheme?: unknown;
    } | null;
    return isColorScheme(value?.effectiveScheme) ? value.effectiveScheme : null;
  } catch {
    return null;
  }
}

export function listenForSystemThemeChanges(sync: () => void | Promise<void>) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  const runSync = () => void sync();
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      runSync();
    }
  };

  mediaQuery?.addEventListener?.('change', runSync);
  window.addEventListener('focus', runSync);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    mediaQuery?.removeEventListener?.('change', runSync);
    window.removeEventListener('focus', runSync);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

function isValidThemeBootSnapshot(snapshot: Partial<ThemeBootSnapshot>) {
  if (
    snapshot.schemaVersion !== THEME_BOOT_SNAPSHOT_SCHEMA_VERSION ||
    !snapshot.themeVersion ||
    !isThemeMode(snapshot.themeMode) ||
    !isRegisteredThemeId(snapshot.colorThemeId) ||
    !isRegisteredDocumentStyleId(snapshot.documentStyleId) ||
    !isColorScheme(snapshot.effectiveScheme) ||
    !snapshot.tokens
  ) {
    return false;
  }
  const resolved = resolveTheme(snapshot, snapshot.effectiveScheme);
  return (
    resolved.themeVersion === snapshot.themeVersion && tokensMatch(resolved.tokens, snapshot.tokens)
  );
}

function tokensMatch(expected: ThemeColorTokens, actual: ThemeColorTokens) {
  const expectedEntries = Object.entries(expected);
  const actualKeys = Object.keys(actual);
  return (
    expectedEntries.length === actualKeys.length &&
    expectedEntries.every(([key, value]) => actual[key as keyof ThemeColorTokens] === value)
  );
}

function startThemeTransition(root: HTMLElement, enabled: boolean) {
  if (!enabled || prefersReducedMotion() || typeof window === 'undefined') {
    return;
  }
  root.classList.add(THEME_TRANSITION_CLASS);
  if (themeTransitionTimer !== null) {
    window.clearTimeout(themeTransitionTimer);
  }
  themeTransitionTimer = window.setTimeout(() => {
    root.classList.remove(THEME_TRANSITION_CLASS);
    themeTransitionTimer = null;
  }, THEME_TRANSITION_MS + 40);
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
