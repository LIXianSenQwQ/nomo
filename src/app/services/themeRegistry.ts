import {
  THEME_COLOR_TOKEN_NAMES,
  THEME_STYLE_TOKEN_NAMES,
  type ColorScheme,
  type DocumentStyleDefinition,
  type ThemeColorTokens,
  type ThemeDefinition,
  type ThemeStyleProfile,
  type ThemeStyleTokens,
  type ThemeVariantDefinition,
} from '../../lib/theme/types';

export const DEFAULT_COLOR_THEME_ID = 'nomo-default';
export const AMBER_PAPER_THEME_ID = 'nomo-amber-paper';
export const CLASSIC_GRAY_THEME_ID = 'nomo-classic-gray';
export const DEFAULT_DOCUMENT_STYLE_ID = 'nomo-modern';
export const CLASSIC_DOCUMENT_STYLE_ID = 'nomo-classic';

const SUPPORTED_SHIKI_THEMES = new Set([
  'github-light',
  'github-dark',
  'gruvbox-light-medium',
  'gruvbox-dark-medium',
]);
const SUPPORTED_MERMAID_THEMES = new Set(['default', 'dark', 'base']);
const SUPPORTED_STYLE_PROFILES = new Set<ThemeStyleProfile>(['modern', 'paper', 'classic']);
const THEME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STYLE_LENGTH_TOKEN_NAMES = new Set<keyof ThemeStyleTokens>([
  'radiusXs',
  'radiusSm',
  'radiusMd',
  'radiusLg',
  'radiusPill',
  'borderWidth',
  'spaceXs',
  'spaceSm',
  'spaceMd',
  'spaceLg',
  'spaceXl',
  'controlHeightSm',
  'controlHeightMd',
  'controlHeightLg',
]);
const SAFE_CSS_LENGTH_PATTERN = /^(?:0|\d+(?:\.\d+)?(?:px|rem))$/;

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

export const THEME_STYLE_TOKEN_CSS_VARIABLES: Record<keyof ThemeStyleTokens, string> = {
  radiusXs: '--md-editor-radius-xs',
  radiusSm: '--md-editor-radius-sm',
  radiusMd: '--md-editor-radius-md',
  radiusLg: '--md-editor-radius-lg',
  radiusPill: '--md-editor-radius-pill',
  borderWidth: '--md-editor-border-width',
  shadowRaised: '--md-editor-shadow-raised',
  shadowFloating: '--md-editor-shadow',
  shadowDialog: '--md-editor-shadow-dialog',
  spaceXs: '--md-editor-space-xs',
  spaceSm: '--md-editor-space-sm',
  spaceMd: '--md-editor-space-md',
  spaceLg: '--md-editor-space-lg',
  spaceXl: '--md-editor-space-xl',
  controlHeightSm: '--md-editor-control-height-sm',
  controlHeightMd: '--md-editor-control-height-md',
  controlHeightLg: '--md-editor-control-height-lg',
  fontUi: '--md-editor-font-body',
  fontDocument: '--md-editor-font-document',
  fontMono: '--md-editor-font-mono',
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

const classicGrayLightTokens: ThemeColorTokens = {
  ...defaultLightTokens,
  background: '#EFEFEF',
  surface: '#FAFAFA',
  rail: '#E9E9E9',
  chrome: '#F4F4F4',
  documentBackground: '#FFFFFF',
  sidebarActive: '#E1E1E1',
  foreground: '#2E2E2E',
  mutedForeground: '#626262',
  border: '#D4D4D4',
  selection: 'rgba(80, 80, 80, 0.2)',
  hoverBackground: '#E6E6E6',
  heading: '#202020',
  accent: '#686868',
  accentStrong: '#3F3F3F',
  accentFill: '#565656',
  onAccent: '#FFFFFF',
  blockquoteBorder: '#8A8A8A',
  blockquoteForeground: '#515151',
  blockquoteClassicBackground: '#F0F0F0',
  calloutNoteClassicBackground: '#F0F0F0',
  calloutTipClassicBackground: '#F0F0F0',
  calloutImportantClassicBackground: '#F0F0F0',
  calloutWarningClassicBackground: '#F0F0F0',
  calloutCautionClassicBackground: '#F0F0F0',
  codeBackground: '#DCDCDC',
  codeForeground: '#444444',
  codeBorder: '#E4E4E4',
  tableBorder: '#D2D2D2',
  tableHeaderBackground: '#EAEAEA',
  titlebarBackground: '#F4F4F4',
  titlebarBorder: '#D8D8D8',
  titlebarForeground: '#333333',
  dropdownBackground: 'rgba(250, 250, 250, 0.97)',
  dropdownBorder: '#D0D0D0',
  scrollbarTrack: 'rgba(0, 0, 0, 0.04)',
  scrollbarThumbIdle: 'rgba(96, 96, 96, 0.55)',
  scrollbarThumb: '#777777',
  scrollbarThumbHover: '#626262',
  scrollbarThumbActive: '#4D4D4D',
};

const classicGrayDarkTokens: ThemeColorTokens = {
  ...defaultDarkTokens,
  background: '#181818',
  surface: '#222222',
  rail: '#1D1D1D',
  chrome: '#262626',
  documentBackground: '#222222',
  sidebarActive: '#343434',
  foreground: '#E8E8E8',
  mutedForeground: '#A6A6A6',
  border: '#3D3D3D',
  selection: 'rgba(190, 190, 190, 0.24)',
  hoverBackground: '#2E2E2E',
  heading: '#F3F3F3',
  accent: '#A3A3A3',
  accentStrong: '#D4D4D4',
  accentFill: '#666666',
  onAccent: '#FFFFFF',
  blockquoteBorder: '#858585',
  blockquoteForeground: '#C8C8C8',
  blockquoteClassicBackground: '#2A2A2A',
  calloutNoteClassicBackground: '#2A2A2A',
  calloutTipClassicBackground: '#2A2A2A',
  calloutImportantClassicBackground: '#2A2A2A',
  calloutWarningClassicBackground: '#2A2A2A',
  calloutCautionClassicBackground: '#2A2A2A',
  codeBackground: '#303030',
  codeForeground: '#E0E0E0',
  codeBorder: '#484848',
  tableBorder: '#3F3F3F',
  tableHeaderBackground: '#2B2B2B',
  titlebarBackground: '#1C1C1C',
  titlebarBorder: '#363636',
  titlebarForeground: '#D0D0D0',
  dropdownBackground: 'rgba(32, 32, 32, 0.97)',
  dropdownBorder: '#444444',
  scrollbarTrack: 'rgba(255, 255, 255, 0.04)',
  scrollbarThumbIdle: 'rgba(166, 166, 166, 0.58)',
  scrollbarThumb: '#8D8D8D',
  scrollbarThumbHover: '#AAAAAA',
  scrollbarThumbActive: '#C4C4C4',
};

const COMMON_UI_FONT = "'Segoe UI', 'Microsoft YaHei', sans-serif";
const COMMON_MONO_FONT = "'Cascadia Code', 'JetBrains Mono', Consolas, monospace";

const modernLightStyleTokens: ThemeStyleTokens = {
  radiusXs: '2px',
  radiusSm: '4px',
  radiusMd: '8px',
  radiusLg: '12px',
  radiusPill: '999px',
  borderWidth: '1px',
  shadowRaised: '0 1px 4px rgba(22, 32, 44, 0.08)',
  shadowFloating: '0 14px 34px rgba(22, 32, 44, 0.08)',
  shadowDialog: '0 20px 60px rgba(0, 0, 0, 0.22)',
  spaceXs: '4px',
  spaceSm: '8px',
  spaceMd: '12px',
  spaceLg: '16px',
  spaceXl: '24px',
  controlHeightSm: '28px',
  controlHeightMd: '34px',
  controlHeightLg: '38px',
  fontUi: COMMON_UI_FONT,
  fontDocument: COMMON_UI_FONT,
  fontMono: COMMON_MONO_FONT,
};

const modernDarkStyleTokens: ThemeStyleTokens = {
  ...modernLightStyleTokens,
  shadowRaised: '0 1px 4px rgba(0, 0, 0, 0.18)',
  shadowFloating: '0 16px 44px rgba(0, 0, 0, 0.32)',
  shadowDialog: '0 20px 60px rgba(0, 0, 0, 0.42)',
};

const paperLightStyleTokens: ThemeStyleTokens = {
  ...modernLightStyleTokens,
  radiusXs: '3px',
  radiusSm: '6px',
  radiusMd: '10px',
  radiusLg: '14px',
  shadowRaised: '0 1px 3px rgba(74, 58, 39, 0.08)',
  shadowFloating: '0 10px 28px rgba(74, 58, 39, 0.12)',
  shadowDialog: '0 18px 48px rgba(74, 58, 39, 0.18)',
  spaceSm: '10px',
  spaceMd: '14px',
  spaceLg: '18px',
  spaceXl: '26px',
  controlHeightSm: '30px',
  controlHeightMd: '36px',
  controlHeightLg: '40px',
};

const paperDarkStyleTokens: ThemeStyleTokens = {
  ...paperLightStyleTokens,
  shadowRaised: '0 1px 3px rgba(0, 0, 0, 0.18)',
  shadowFloating: '0 12px 32px rgba(0, 0, 0, 0.32)',
  shadowDialog: '0 20px 52px rgba(0, 0, 0, 0.42)',
};

const classicLightStyleTokens: ThemeStyleTokens = {
  ...modernLightStyleTokens,
  radiusMd: '6px',
  radiusLg: '8px',
  shadowRaised: '0 1px 0 rgba(31, 35, 40, 0.06)',
  shadowFloating: '0 3px 12px rgba(31, 35, 40, 0.12)',
  shadowDialog: '0 8px 24px rgba(31, 35, 40, 0.16)',
  controlHeightMd: '32px',
  controlHeightLg: '36px',
};

const classicDarkStyleTokens: ThemeStyleTokens = {
  ...classicLightStyleTokens,
  shadowRaised: '0 1px 0 rgba(0, 0, 0, 0.18)',
  shadowFloating: '0 3px 12px rgba(0, 0, 0, 0.3)',
  shadowDialog: '0 8px 24px rgba(0, 0, 0, 0.4)',
};

function createVariant(
  tokens: ThemeColorTokens,
  styleTokens: ThemeStyleTokens,
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
    styleTokens,
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
    styleProfile: 'modern',
    variants: {
      light: createVariant(defaultLightTokens, modernLightStyleTokens, 'github-light', 'default'),
      dark: createVariant(defaultDarkTokens, modernDarkStyleTokens, 'github-dark', 'dark'),
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
    styleProfile: 'paper',
    variants: {
      light: createVariant(
        amberLightTokens,
        paperLightStyleTokens,
        'gruvbox-light-medium',
        'base',
      ),
      dark: createVariant(
        amberDarkTokens,
        paperDarkStyleTokens,
        'gruvbox-dark-medium',
        'base',
      ),
    },
  },
  {
    schemaVersion: 1,
    id: CLASSIC_GRAY_THEME_ID,
    version: '1.0.0',
    author: 'Nomo',
    localizedNames: {
      'zh-CN': '经典灰',
      'zh-TW': '經典灰',
      'en-US': 'Classic Gray',
      'ja-JP': 'クラシックグレー',
    },
    styleProfile: 'classic',
    variants: {
      light: createVariant(
        classicGrayLightTokens,
        classicLightStyleTokens,
        'github-light',
        'base',
      ),
      dark: createVariant(
        classicGrayDarkTokens,
        classicDarkStyleTokens,
        'github-dark',
        'base',
      ),
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
  if (!SUPPORTED_STYLE_PROFILES.has(theme.styleProfile)) {
    throw new Error(`不支持的主题样式档案：${theme.id}/${theme.styleProfile}`);
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
  const styleTokenKeys = Object.keys(variant.styleTokens);
  const requiredStyleKeys = new Set<string>(THEME_STYLE_TOKEN_NAMES);
  const missingStyleTokens = THEME_STYLE_TOKEN_NAMES.filter(
    (name) => !styleTokenKeys.includes(name),
  );
  const unknownStyleTokens = styleTokenKeys.filter((name) => !requiredStyleKeys.has(name));
  if (missingStyleTokens.length > 0 || unknownStyleTokens.length > 0) {
    throw new Error(
      `主题样式令牌不完整：${themeId}/${scheme}; missing=${missingStyleTokens.join(',')}; unknown=${unknownStyleTokens.join(',')}`,
    );
  }
  for (const [name, value] of Object.entries(variant.styleTokens)) {
    if (!isSafeStyleToken(name as keyof ThemeStyleTokens, value)) {
      throw new Error(`主题样式令牌值非法：${themeId}/${scheme}/${name}`);
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
    !/[;{}\r\n]/.test(value) &&
    !/url\s*\(|@import|!important/i.test(value)
  );
}

function isSafeStyleToken(name: keyof ThemeStyleTokens, value: unknown): value is string {
  if (!isSafeThemeValue(value)) {
    return false;
  }
  if (STYLE_LENGTH_TOKEN_NAMES.has(name)) {
    return SAFE_CSS_LENGTH_PATTERN.test(value);
  }
  return true;
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
