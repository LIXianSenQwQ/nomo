import {
  THEME_COLOR_TOKEN_NAMES,
  type ColorScheme,
  type DocumentStyleDefinition,
  type ThemeColorTokens,
  type ThemeDefinition,
  type ThemeVariantDefinition,
} from '../../lib/theme/types';

export const DEFAULT_COLOR_THEME_ID = 'nomo-default';
export const AMBER_PAPER_THEME_ID = 'nomo-amber-paper';
export const DEFAULT_DOCUMENT_STYLE_ID = 'nomo-modern';
export const CLASSIC_DOCUMENT_STYLE_ID = 'nomo-classic';

const SUPPORTED_SHIKI_THEMES = new Set([
  'github-light',
  'github-dark',
  'gruvbox-light-medium',
  'gruvbox-dark-medium',
]);
const SUPPORTED_MERMAID_THEMES = new Set(['default', 'dark', 'base']);
const THEME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const THEME_TOKEN_CSS_VARIABLES: Record<keyof ThemeColorTokens, string> = {
  background: '--md-editor-bg',
  surface: '--md-editor-surface',
  rail: '--md-editor-rail',
  chrome: '--md-editor-chrome',
  documentBackground: '--md-editor-document-bg',
  sidebarActive: '--md-editor-sidebar-active',
  foreground: '--md-editor-fg',
  mutedForeground: '--md-editor-muted-fg',
  border: '--md-editor-border',
  selection: '--md-editor-selection-bg',
  hoverBackground: '--md-editor-hover-bg',
  heading: '--md-editor-heading-fg',
  link: '--md-editor-link-fg',
  accent: '--md-editor-accent',
  accentStrong: '--md-editor-accent-strong',
  accentFill: '--md-editor-accent-fill',
  onAccent: '--md-editor-on-accent',
  success: '--md-editor-success',
  warning: '--md-editor-warning',
  danger: '--md-editor-danger',
  blockquoteBorder: '--md-editor-blockquote-border',
  blockquoteForeground: '--md-editor-blockquote-fg',
  blockquoteBackground: '--md-editor-blockquote-bg',
  blockquoteClassicBackground: '--md-editor-blockquote-bg-classic',
  calloutNoteBorder: '--md-editor-callout-note-border',
  calloutNoteBackground: '--md-editor-callout-note-bg',
  calloutNoteClassicBackground: '--md-editor-callout-note-bg-classic',
  calloutNoteForeground: '--md-editor-callout-note-fg',
  calloutTipBorder: '--md-editor-callout-tip-border',
  calloutTipBackground: '--md-editor-callout-tip-bg',
  calloutTipClassicBackground: '--md-editor-callout-tip-bg-classic',
  calloutTipForeground: '--md-editor-callout-tip-fg',
  calloutImportantBorder: '--md-editor-callout-important-border',
  calloutImportantBackground: '--md-editor-callout-important-bg',
  calloutImportantClassicBackground: '--md-editor-callout-important-bg-classic',
  calloutImportantForeground: '--md-editor-callout-important-fg',
  calloutWarningBorder: '--md-editor-callout-warning-border',
  calloutWarningBackground: '--md-editor-callout-warning-bg',
  calloutWarningClassicBackground: '--md-editor-callout-warning-bg-classic',
  calloutWarningForeground: '--md-editor-callout-warning-fg',
  calloutCautionBorder: '--md-editor-callout-caution-border',
  calloutCautionBackground: '--md-editor-callout-caution-bg',
  calloutCautionClassicBackground: '--md-editor-callout-caution-bg-classic',
  calloutCautionForeground: '--md-editor-callout-caution-fg',
  codeBackground: '--md-editor-code-bg',
  codeForeground: '--md-editor-code-fg',
  codeBorder: '--md-editor-code-border',
  codeKeyword: '--md-editor-code-keyword',
  codeBoolean: '--md-editor-code-boolean',
  codeNumber: '--md-editor-code-number',
  codeString: '--md-editor-code-string',
  codeOperator: '--md-editor-code-operator',
  codePunctuation: '--md-editor-code-punctuation',
  tableBorder: '--md-editor-table-border',
  tableHeaderBackground: '--md-editor-table-header-bg',
  titlebarBackground: '--md-titlebar-bg',
  titlebarBorder: '--md-titlebar-border',
  titlebarForeground: '--md-titlebar-fg',
  dropdownBackground: '--md-dropdown-bg',
  dropdownBorder: '--md-dropdown-border',
  scrollbarTrack: '--md-scrollbar-track',
  scrollbarThumbIdle: '--md-scrollbar-thumb-idle',
  scrollbarThumb: '--md-scrollbar-thumb',
  scrollbarThumbHover: '--md-scrollbar-thumb-hover',
  scrollbarThumbActive: '--md-scrollbar-thumb-active',
};

const defaultLightTokens: ThemeColorTokens = {
  background: '#f6f7f9',
  surface: '#ffffff',
  rail: '#f3f4f6',
  chrome: '#f8f9fb',
  documentBackground: '#ffffff',
  sidebarActive: '#e7f0ee',
  foreground: '#202428',
  mutedForeground: '#68707a',
  border: '#dfe3e8',
  selection: 'rgba(47, 125, 111, 0.18)',
  hoverBackground: '#edf1f2',
  heading: '#171a1f',
  link: '#116d8f',
  accent: '#2f7d6f',
  accentStrong: '#174e45',
  accentFill: '#2f7d6f',
  onAccent: '#ffffff',
  success: '#166534',
  warning: '#9a6700',
  danger: '#b42318',
  blockquoteBorder: '#7f9f97',
  blockquoteForeground: '#465753',
  blockquoteBackground: 'transparent',
  blockquoteClassicBackground: '#f2f4f5',
  calloutNoteBorder: '#3b82f6',
  calloutNoteBackground: 'transparent',
  calloutNoteClassicBackground: '#f2f4f5',
  calloutNoteForeground: '#1e40af',
  calloutTipBorder: '#22c55e',
  calloutTipBackground: 'transparent',
  calloutTipClassicBackground: '#f2f4f5',
  calloutTipForeground: '#166534',
  calloutImportantBorder: '#a855f7',
  calloutImportantBackground: 'transparent',
  calloutImportantClassicBackground: '#f2f4f5',
  calloutImportantForeground: '#6b21a8',
  calloutWarningBorder: '#f59e0b',
  calloutWarningBackground: 'transparent',
  calloutWarningClassicBackground: '#f2f4f5',
  calloutWarningForeground: '#92400e',
  calloutCautionBorder: '#ef4444',
  calloutCautionBackground: 'transparent',
  calloutCautionClassicBackground: '#f2f4f5',
  calloutCautionForeground: '#991b1b',
  codeBackground: '#f5f6f8',
  codeForeground: '#383a42',
  codeBorder: '#e0e2e6',
  codeKeyword: '#8250df',
  codeBoolean: '#0550ae',
  codeNumber: '#0550ae',
  codeString: '#0a3069',
  codeOperator: '#cf222e',
  codePunctuation: '#57606a',
  tableBorder: '#dfe3e8',
  tableHeaderBackground: '#f0f2f4',
  titlebarBackground: '#fcfcfc',
  titlebarBorder: '#e5e5e5',
  titlebarForeground: '#333333',
  dropdownBackground: 'rgba(255, 255, 255, 0.96)',
  dropdownBorder: '#d8d8d8',
  scrollbarTrack: 'rgba(35, 42, 49, 0.035)',
  scrollbarThumbIdle: 'rgba(126, 136, 146, 0.72)',
  scrollbarThumb: '#7e8892',
  scrollbarThumbHover: '#66717c',
  scrollbarThumbActive: '#4f5964',
};

const defaultDarkTokens: ThemeColorTokens = {
  background: '#15181d',
  surface: '#1d2229',
  rail: '#181d23',
  chrome: '#20262e',
  documentBackground: '#1d2229',
  sidebarActive: '#203530',
  foreground: '#eef2f5',
  mutedForeground: '#9aa4af',
  border: '#333b46',
  selection: 'rgba(103, 183, 165, 0.28)',
  hoverBackground: '#29313a',
  heading: '#ffffff',
  link: '#79c9d8',
  accent: '#67b7a5',
  accentStrong: '#9fd8c7',
  accentFill: '#2f7d6f',
  onAccent: '#ffffff',
  success: '#86efac',
  warning: '#d4a72c',
  danger: '#ff8a7a',
  blockquoteBorder: '#6f938b',
  blockquoteForeground: '#c8d8d4',
  blockquoteBackground: 'transparent',
  blockquoteClassicBackground: '#1a1e23',
  calloutNoteBorder: '#3b82f6',
  calloutNoteBackground: 'transparent',
  calloutNoteClassicBackground: '#1a1e23',
  calloutNoteForeground: '#93c5fd',
  calloutTipBorder: '#22c55e',
  calloutTipBackground: 'transparent',
  calloutTipClassicBackground: '#1a1e23',
  calloutTipForeground: '#86efac',
  calloutImportantBorder: '#a855f7',
  calloutImportantBackground: 'transparent',
  calloutImportantClassicBackground: '#1a1e23',
  calloutImportantForeground: '#d8b4fe',
  calloutWarningBorder: '#f59e0b',
  calloutWarningBackground: 'transparent',
  calloutWarningClassicBackground: '#1a1e23',
  calloutWarningForeground: '#fcd34d',
  calloutCautionBorder: '#ef4444',
  calloutCautionBackground: 'transparent',
  calloutCautionClassicBackground: '#1a1e23',
  calloutCautionForeground: '#fca5a5',
  codeBackground: '#11151a',
  codeForeground: '#edf3f6',
  codeBorder: '#2b333d',
  codeKeyword: '#d2a8ff',
  codeBoolean: '#79c0ff',
  codeNumber: '#79c0ff',
  codeString: '#a5d6ff',
  codeOperator: '#ff7b72',
  codePunctuation: '#8b949e',
  tableBorder: '#333b46',
  tableHeaderBackground: '#252c35',
  titlebarBackground: '#1a1a1a',
  titlebarBorder: '#2e2e2e',
  titlebarForeground: '#cccccc',
  dropdownBackground: 'rgba(30, 30, 30, 0.96)',
  dropdownBorder: '#3a3a3a',
  scrollbarTrack: 'rgba(235, 241, 247, 0.04)',
  scrollbarThumbIdle: 'rgba(142, 154, 166, 0.72)',
  scrollbarThumb: '#8e9aa6',
  scrollbarThumbHover: '#a9b4bf',
  scrollbarThumbActive: '#c4ccd4',
};

const amberLightTokens: ThemeColorTokens = {
  ...defaultLightTokens,
  background: '#F3F0E8',
  surface: '#FBF8F1',
  rail: '#EAE5DA',
  chrome: '#F0ECE3',
  documentBackground: '#FBF8F1',
  sidebarActive: '#E5D8C4',
  foreground: '#2B2925',
  mutedForeground: '#716B61',
  border: '#D8D0C2',
  selection: 'rgba(154, 77, 16, 0.22)',
  hoverBackground: '#EDE5D8',
  heading: '#211F1B',
  link: '#8A430E',
  accent: '#9A4D10',
  accentStrong: '#71360A',
  accentFill: '#9A4D10',
  onAccent: '#FFF8ED',
  success: '#4F6B2A',
  warning: '#96610C',
  danger: '#A33A2B',
  blockquoteBorder: '#B58A54',
  blockquoteForeground: '#5F4E39',
  blockquoteClassicBackground: '#EEE7DB',
  calloutNoteBorder: '#557A8E',
  calloutNoteClassicBackground: '#E8ECE9',
  calloutNoteForeground: '#31586A',
  calloutTipBorder: '#66844C',
  calloutTipClassicBackground: '#E9ECDD',
  calloutTipForeground: '#46612E',
  calloutImportantBorder: '#8B648D',
  calloutImportantClassicBackground: '#EEE5EC',
  calloutImportantForeground: '#68466A',
  calloutWarningBorder: '#B2781D',
  calloutWarningClassicBackground: '#F2E7D1',
  calloutWarningForeground: '#80500A',
  calloutCautionBorder: '#B55743',
  calloutCautionClassicBackground: '#F1E1DA',
  calloutCautionForeground: '#873829',
  codeBackground: '#ECE6DA',
  codeForeground: '#3C3836',
  codeBorder: '#D8CDBD',
  codeKeyword: '#9D0006',
  codeBoolean: '#8F3F71',
  codeNumber: '#8F3F71',
  codeString: '#79740E',
  codeOperator: '#B57614',
  codePunctuation: '#665C54',
  tableBorder: '#D4C9B8',
  tableHeaderBackground: '#EAE2D5',
  titlebarBackground: '#F0ECE3',
  titlebarBorder: '#D8D0C2',
  titlebarForeground: '#3A352E',
  dropdownBackground: 'rgba(251, 248, 241, 0.97)',
  dropdownBorder: '#CFC4B3',
  scrollbarTrack: 'rgba(74, 58, 39, 0.05)',
  scrollbarThumbIdle: 'rgba(132, 111, 84, 0.68)',
  scrollbarThumb: '#846F54',
  scrollbarThumbHover: '#6D583F',
  scrollbarThumbActive: '#59452F',
};

const amberDarkTokens: ThemeColorTokens = {
  ...defaultDarkTokens,
  background: '#191713',
  surface: '#23201B',
  rail: '#1E1B17',
  chrome: '#28241E',
  documentBackground: '#23201B',
  sidebarActive: '#3A2C1D',
  foreground: '#F2EBDD',
  mutedForeground: '#AAA092',
  border: '#403A31',
  selection: 'rgba(227, 160, 76, 0.3)',
  hoverBackground: '#332D25',
  heading: '#FFF7E8',
  link: '#F0B86E',
  accent: '#E3A04C',
  accentStrong: '#F2C27D',
  accentFill: '#E3A04C',
  onAccent: '#1E1308',
  success: '#A8C26F',
  warning: '#E2B85B',
  danger: '#F08A72',
  blockquoteBorder: '#9F7441',
  blockquoteForeground: '#D5C2A7',
  blockquoteClassicBackground: '#2B251E',
  calloutNoteBorder: '#6F9BAE',
  calloutNoteClassicBackground: '#252B2C',
  calloutNoteForeground: '#A9CEDC',
  calloutTipBorder: '#86A965',
  calloutTipClassicBackground: '#272B20',
  calloutTipForeground: '#B8D38F',
  calloutImportantBorder: '#AF83B0',
  calloutImportantClassicBackground: '#2D252D',
  calloutImportantForeground: '#D9B2D9',
  calloutWarningBorder: '#D69B3C',
  calloutWarningClassicBackground: '#30291D',
  calloutWarningForeground: '#F0C777',
  calloutCautionBorder: '#D46E58',
  calloutCautionClassicBackground: '#30231F',
  calloutCautionForeground: '#F1A08E',
  codeBackground: '#171510',
  codeForeground: '#EBDBB2',
  codeBorder: '#3B342A',
  codeKeyword: '#FB4934',
  codeBoolean: '#D3869B',
  codeNumber: '#D3869B',
  codeString: '#B8BB26',
  codeOperator: '#FABD2F',
  codePunctuation: '#A89984',
  tableBorder: '#453D32',
  tableHeaderBackground: '#2E2922',
  titlebarBackground: '#1E1B17',
  titlebarBorder: '#403A31',
  titlebarForeground: '#E8DFD0',
  dropdownBackground: 'rgba(35, 32, 27, 0.97)',
  dropdownBorder: '#4A4236',
  scrollbarTrack: 'rgba(240, 224, 199, 0.05)',
  scrollbarThumbIdle: 'rgba(150, 132, 108, 0.7)',
  scrollbarThumb: '#96846C',
  scrollbarThumbHover: '#B09A7C',
  scrollbarThumbActive: '#CCB18C',
};

function createVariant(
  tokens: ThemeColorTokens,
  shikiTheme: string,
  mermaidTheme: 'default' | 'dark' | 'base',
): ThemeVariantDefinition {
  const mermaid =
    mermaidTheme === 'base'
      ? {
          theme: mermaidTheme,
          themeVariables: {
            background: tokens.documentBackground,
            primaryColor: tokens.surface,
            primaryTextColor: tokens.foreground,
            primaryBorderColor: tokens.border,
            lineColor: tokens.mutedForeground,
            secondaryColor: tokens.rail,
            tertiaryColor: tokens.chrome,
            mainBkg: tokens.surface,
            nodeBorder: tokens.accent,
            clusterBkg: tokens.rail,
            clusterBorder: tokens.border,
            edgeLabelBackground: tokens.documentBackground,
            textColor: tokens.foreground,
            titleColor: tokens.heading,
          },
        }
      : { theme: mermaidTheme };

  return {
    tokens,
    shikiTheme,
    mermaid,
    preview: {
      background: tokens.background,
      surface: tokens.surface,
      accent: tokens.accent,
      foreground: tokens.foreground,
    },
  };
}

const BUILTIN_THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    schemaVersion: 1,
    id: DEFAULT_COLOR_THEME_ID,
    version: '1.0.0',
    author: 'Nomo',
    localizedNames: {
      'zh-CN': 'Nomo 默认',
      'zh-TW': 'Nomo 預設',
      'en-US': 'Nomo Default',
      'ja-JP': 'Nomo デフォルト',
    },
    variants: {
      light: createVariant(defaultLightTokens, 'github-light', 'default'),
      dark: createVariant(defaultDarkTokens, 'github-dark', 'dark'),
    },
  },
  {
    schemaVersion: 1,
    id: AMBER_PAPER_THEME_ID,
    version: '1.0.0',
    author: 'Nomo',
    localizedNames: {
      'zh-CN': '琥珀纸页',
      'zh-TW': '琥珀紙頁',
      'en-US': 'Amber Paper',
      'ja-JP': '琥珀の紙面',
    },
    variants: {
      light: createVariant(amberLightTokens, 'gruvbox-light-medium', 'base'),
      dark: createVariant(amberDarkTokens, 'gruvbox-dark-medium', 'base'),
    },
  },
];

const BUILTIN_DOCUMENT_STYLES: DocumentStyleDefinition[] = [
  {
    schemaVersion: 1,
    id: CLASSIC_DOCUMENT_STYLE_ID,
    version: '1.0.0',
    author: 'Nomo',
    localizedNames: {
      'zh-CN': '经典',
      'zh-TW': '經典',
      'en-US': 'Classic',
      'ja-JP': 'クラシック',
    },
    legacyBlockStyle: 'classic',
  },
  {
    schemaVersion: 1,
    id: DEFAULT_DOCUMENT_STYLE_ID,
    version: '1.0.0',
    author: 'Nomo',
    localizedNames: {
      'zh-CN': '现代',
      'zh-TW': '現代',
      'en-US': 'Modern',
      'ja-JP': 'モダン',
    },
    legacyBlockStyle: 'modern',
  },
];

export class ThemeRegistry {
  private readonly themes = new Map<string, ThemeDefinition>();
  private readonly documentStyles = new Map<string, DocumentStyleDefinition>();

  registerTheme(theme: ThemeDefinition) {
    validateThemeDefinition(theme);
    if (this.themes.has(theme.id)) {
      throw new Error(`主题 ID 重复：${theme.id}`);
    }
    this.themes.set(theme.id, theme);
  }

  registerDocumentStyle(style: DocumentStyleDefinition) {
    validateDocumentStyleDefinition(style);
    if (this.documentStyles.has(style.id)) {
      throw new Error(`文档样式 ID 重复：${style.id}`);
    }
    this.documentStyles.set(style.id, style);
  }

  getTheme(id: string) {
    return this.themes.get(id);
  }

  getDocumentStyle(id: string) {
    return this.documentStyles.get(id);
  }

  listThemes() {
    return Array.from(this.themes.values());
  }

  listDocumentStyles() {
    return Array.from(this.documentStyles.values());
  }
}

export function validateThemeDefinition(theme: ThemeDefinition) {
  if (theme.schemaVersion !== 1 || !THEME_ID_PATTERN.test(theme.id)) {
    throw new Error(`非法主题定义：${theme.id || '(empty)'}`);
  }
  if (!theme.version || !theme.author || Object.keys(theme.localizedNames).length === 0) {
    throw new Error(`主题元数据不完整：${theme.id}`);
  }

  for (const scheme of ['light', 'dark'] as const) {
    const variant = theme.variants?.[scheme];
    if (!variant) {
      throw new Error(`主题缺少 ${scheme} 变体：${theme.id}`);
    }
    validateThemeVariant(theme.id, scheme, variant);
  }
}

function validateThemeVariant(
  themeId: string,
  scheme: ColorScheme,
  variant: ThemeVariantDefinition,
) {
  const tokenKeys = Object.keys(variant.tokens);
  const requiredKeys = new Set<string>(THEME_COLOR_TOKEN_NAMES);
  const missing = THEME_COLOR_TOKEN_NAMES.filter((name) => !tokenKeys.includes(name));
  const unknown = tokenKeys.filter((name) => !requiredKeys.has(name));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `主题令牌不完整：${themeId}/${scheme}; missing=${missing.join(',')}; unknown=${unknown.join(',')}`,
    );
  }
  for (const [name, value] of Object.entries(variant.tokens)) {
    if (!isSafeThemeValue(value)) {
      throw new Error(`主题令牌值非法：${themeId}/${scheme}/${name}`);
    }
  }
  if (!SUPPORTED_SHIKI_THEMES.has(variant.shikiTheme)) {
    throw new Error(`不支持的 Shiki 主题：${variant.shikiTheme}`);
  }
  if (!SUPPORTED_MERMAID_THEMES.has(variant.mermaid.theme)) {
    throw new Error(`不支持的 Mermaid 主题：${variant.mermaid.theme}`);
  }
  if (variant.mermaid.theme !== 'base' && variant.mermaid.themeVariables) {
    throw new Error(`仅 Mermaid base 主题允许 themeVariables：${themeId}/${scheme}`);
  }
}

function validateDocumentStyleDefinition(style: DocumentStyleDefinition) {
  if (
    style.schemaVersion !== 1 ||
    !THEME_ID_PATTERN.test(style.id) ||
    !style.version ||
    !style.author ||
    Object.keys(style.localizedNames).length === 0
  ) {
    throw new Error(`非法文档样式定义：${style.id || '(empty)'}`);
  }
}

function isSafeThemeValue(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !/[;{}]/.test(value) &&
    !/url\s*\(|@import/i.test(value)
  );
}

export const themeRegistry = new ThemeRegistry();
for (const theme of BUILTIN_THEME_DEFINITIONS) {
  themeRegistry.registerTheme(theme);
}
for (const style of BUILTIN_DOCUMENT_STYLES) {
  themeRegistry.registerDocumentStyle(style);
}

export function getThemeDisplayName(theme: ThemeDefinition, locale: string) {
  return theme.localizedNames[locale] ?? theme.localizedNames['en-US'] ?? theme.id;
}

export function getDocumentStyleDisplayName(style: DocumentStyleDefinition, locale: string) {
  return style.localizedNames[locale] ?? style.localizedNames['en-US'] ?? style.id;
}

export function isRegisteredThemeId(value: unknown): value is string {
  return typeof value === 'string' && Boolean(themeRegistry.getTheme(value));
}

export function isRegisteredDocumentStyleId(value: unknown): value is string {
  return typeof value === 'string' && Boolean(themeRegistry.getDocumentStyle(value));
}
