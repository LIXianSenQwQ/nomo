import type {
  AppearancePreferences,
  ColorScheme,
  EditorThemeOptions,
  ThemeColorTokens,
  ThemeMode,
  ThemeStyleProfile,
  ThemeStyleTokens,
} from '../../lib/theme/types';
import { getDesktopSystemTheme, setDesktopIconTheme } from './desktopWindow';
import {
  DEFAULT_COLOR_THEME_ID,
  DEFAULT_DOCUMENT_STYLE_ID,
  THEME_STYLE_TOKEN_CSS_VARIABLES,
  THEME_TOKEN_CSS_VARIABLES,
  isRegisteredDocumentStyleId,
  isRegisteredThemeId,
  themeRegistry,
} from './themeRegistry';

export const THEME_BOOT_SNAPSHOT_KEY = 'nomo.themeBootSnapshot.v2';
export const LEGACY_THEME_BOOT_SNAPSHOT_KEY = 'nomo.themeBootSnapshot.v1';
export const THEME_BOOT_SNAPSHOT_SCHEMA_VERSION = 2;

const THEME_TRANSITION_CLASS = 'theme-transitioning';
const THEME_TRANSITION_MS = 180;
let themeTransitionTimer: number | null = null;

export interface ResolvedTheme {
  preferences: AppearancePreferences;
  effectiveScheme: ColorScheme;
  themeVersion: string;
  tokens: ThemeColorTokens;
  styleProfile: ThemeStyleProfile;
  styleTokens: ThemeStyleTokens;
  editorTheme: EditorThemeOptions;
}

export interface ThemeBootSnapshot {
  schemaVersion: 2;
  themeVersion: string;
  themeMode: ThemeMode;
  colorThemeId: string;
  documentStyleId: string;
  effectiveScheme: ColorScheme;
  tokens: ThemeColorTokens;
  styleProfile: ThemeStyleProfile;
  styleTokens: ThemeStyleTokens;
}

interface LegacyThemeBootSnapshot {
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
    styleProfile: theme.styleProfile,
    styleTokens: variant.styleTokens,
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
  root.dataset.themeStyle = resolved.styleProfile;
  root.dataset.documentStyle = resolved.preferences.documentStyleId;

  const documentStyle =
    themeRegistry.getDocumentStyle(resolved.preferences.documentStyleId) ??
    themeRegistry.getDocumentStyle(DEFAULT_DOCUMENT_STYLE_ID);
  root.dataset.blockStyle = documentStyle?.legacyBlockStyle ?? 'modern';

  for (const [tokenName, cssVariable] of Object.entries(THEME_TOKEN_CSS_VARIABLES)) {
    root.style.setProperty(cssVariable, resolved.tokens[tokenName as keyof ThemeColorTokens]);
  }
  for (const [tokenName, cssVariable] of Object.entries(THEME_STYLE_TOKEN_CSS_VARIABLES)) {
    root.style.setProperty(cssVariable, resolved.styleTokens[tokenName as keyof ThemeStyleTokens]);
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
  localStorage.setItem(THEME_BOOT_SNAPSHOT_KEY, JSON.stringify(createThemeBootSnapshot(resolved)));
  localStorage.removeItem(LEGACY_THEME_BOOT_SNAPSHOT_KEY);
}

function createThemeBootSnapshot(resolved: ResolvedTheme): ThemeBootSnapshot {
  return {
    schemaVersion: THEME_BOOT_SNAPSHOT_SCHEMA_VERSION,
    themeVersion: resolved.themeVersion,
    themeMode: resolved.preferences.themeMode,
    colorThemeId: resolved.preferences.colorThemeId,
    documentStyleId: resolved.preferences.documentStyleId,
    effectiveScheme: resolved.effectiveScheme,
    tokens: resolved.tokens,
    styleProfile: resolved.styleProfile,
    styleTokens: resolved.styleTokens,
  };
}

export function readThemeBootSnapshot(): ThemeBootSnapshot | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const currentSnapshot = parseThemeBootSnapshot(localStorage.getItem(THEME_BOOT_SNAPSHOT_KEY));
  if (currentSnapshot && isValidThemeBootSnapshot(currentSnapshot)) {
    return currentSnapshot as ThemeBootSnapshot;
  }

  return readLegacyThemeBootSnapshot();
}

function parseThemeBootSnapshot(value: string | null): Partial<ThemeBootSnapshot> | null {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as Partial<ThemeBootSnapshot>;
  } catch {
    return null;
  }
}

function readLegacyThemeBootSnapshot(): ThemeBootSnapshot | null {
  const value = localStorage.getItem(LEGACY_THEME_BOOT_SNAPSHOT_KEY);
  if (!value) {
    return null;
  }
  try {
    const snapshot = JSON.parse(value) as Partial<LegacyThemeBootSnapshot>;
    if (!isValidLegacyThemeBootSnapshot(snapshot)) {
      return null;
    }
    const resolved = resolveTheme(snapshot, snapshot.effectiveScheme);
    return createThemeBootSnapshot(resolved);
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
      tokensMatch(resolved.tokens, snapshot.tokens) &&
      resolved.styleProfile === snapshot.styleProfile &&
      tokensMatch(resolved.styleTokens, snapshot.styleTokens)
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
  for (const key of [THEME_BOOT_SNAPSHOT_KEY, LEGACY_THEME_BOOT_SNAPSHOT_KEY]) {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? 'null') as {
        effectiveScheme?: unknown;
      } | null;
      if (isColorScheme(value?.effectiveScheme)) {
        return value.effectiveScheme;
      }
    } catch {
      // 继续读取另一版本快照。
    }
  }
  return null;
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
    !snapshot.tokens ||
    !isThemeStyleProfile(snapshot.styleProfile) ||
    !snapshot.styleTokens
  ) {
    return false;
  }
  const resolved = resolveTheme(snapshot, snapshot.effectiveScheme);
  return (
    resolved.themeVersion === snapshot.themeVersion &&
    tokensMatch(resolved.tokens, snapshot.tokens) &&
    resolved.styleProfile === snapshot.styleProfile &&
    tokensMatch(resolved.styleTokens, snapshot.styleTokens)
  );
}

function isValidLegacyThemeBootSnapshot(
  snapshot: Partial<LegacyThemeBootSnapshot>,
): snapshot is LegacyThemeBootSnapshot {
  if (
    snapshot.schemaVersion !== 1 ||
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

function isThemeStyleProfile(value: unknown): value is ThemeStyleProfile {
  return value === 'modern' || value === 'paper' || value === 'classic';
}

function tokensMatch<T extends Record<string, string>>(expected: T, actual: T) {
  const expectedEntries = Object.entries(expected);
  const actualKeys = Object.keys(actual);
  return (
    expectedEntries.length === actualKeys.length &&
    expectedEntries.every(([key, value]) => actual[key] === value)
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
