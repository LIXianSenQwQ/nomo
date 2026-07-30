export type ThemeMode = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export interface AppearancePreferences {
  themeMode: ThemeMode;
  colorThemeId: string;
  documentStyleId: string;
}

export type MermaidThemeName = 'default' | 'dark' | 'base';

export interface MermaidThemeDefinition {
  theme: MermaidThemeName;
  themeVariables?: Record<string, string>;
}

export interface ThemePreviewDefinition {
  background: string;
  surface: string;
  accent: string;
  foreground: string;
}

export interface ThemeVariantDefinition {
  tokens: ThemeColorTokens;
  shikiTheme: string;
  mermaid: MermaidThemeDefinition;
  preview: ThemePreviewDefinition;
}

export interface ThemeDefinition {
  schemaVersion: 1;
  id: string;
  version: string;
  author: string;
  localizedNames: Record<string, string>;
  variants: Record<ColorScheme, ThemeVariantDefinition>;
}

export interface DocumentStyleDefinition {
  schemaVersion: 1;
  id: string;
  version: string;
  author: string;
  localizedNames: Record<string, string>;
  legacyBlockStyle: 'classic' | 'modern';
}

export const THEME_COLOR_TOKEN_NAMES = [
  'background',
  'surface',
  'rail',
  'chrome',
  'documentBackground',
  'sidebarActive',
  'foreground',
  'mutedForeground',
  'border',
  'selection',
  'hoverBackground',
  'heading',
  'link',
  'accent',
  'accentStrong',
  'accentFill',
  'onAccent',
  'success',
  'warning',
  'danger',
  'blockquoteBorder',
  'blockquoteForeground',
  'blockquoteBackground',
  'blockquoteClassicBackground',
  'calloutNoteBorder',
  'calloutNoteBackground',
  'calloutNoteClassicBackground',
  'calloutNoteForeground',
  'calloutTipBorder',
  'calloutTipBackground',
  'calloutTipClassicBackground',
  'calloutTipForeground',
  'calloutImportantBorder',
  'calloutImportantBackground',
  'calloutImportantClassicBackground',
  'calloutImportantForeground',
  'calloutWarningBorder',
  'calloutWarningBackground',
  'calloutWarningClassicBackground',
  'calloutWarningForeground',
  'calloutCautionBorder',
  'calloutCautionBackground',
  'calloutCautionClassicBackground',
  'calloutCautionForeground',
  'codeBackground',
  'codeForeground',
  'codeBorder',
  'codeKeyword',
  'codeBoolean',
  'codeNumber',
  'codeString',
  'codeOperator',
  'codePunctuation',
  'tableBorder',
  'tableHeaderBackground',
  'titlebarBackground',
  'titlebarBorder',
  'titlebarForeground',
  'dropdownBackground',
  'dropdownBorder',
  'scrollbarTrack',
  'scrollbarThumbIdle',
  'scrollbarThumb',
  'scrollbarThumbHover',
  'scrollbarThumbActive',
] as const;

export type ThemeColorTokenName = (typeof THEME_COLOR_TOKEN_NAMES)[number];
export type ThemeColorTokens = Record<ThemeColorTokenName, string>;

export interface EditorThemeOptions {
  name: ColorScheme;
  colorThemeId: string;
  shikiTheme: string;
  mermaid: MermaidThemeDefinition;
}
