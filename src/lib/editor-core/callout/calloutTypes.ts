/** Callout（提示块）类型定义 */

/** 5 种固定 callout 类型 */
export type CalloutType = 'note' | 'tip' | 'important' | 'warning' | 'caution';

export type EffectiveCalloutLocale = 'zh-CN' | 'zh-TW' | 'en-US';

/** callout 类型配置：图标名、默认标题、颜色变量后缀 */
export interface CalloutTypeConfig {
  type: CalloutType;
  icon: string;       // Lucide 图标名
  label: string;      // 默认标题
  colorSuffix: string; // CSS 变量后缀，如 --md-editor-callout-note-border
}

/** 5 种类型的静态配置表 */
export const CALLOUT_TYPES: CalloutTypeConfig[] = [
  { type: 'note',      icon: 'Info',           label: 'Note', colorSuffix: 'note' },
  { type: 'tip',       icon: 'Lightbulb',      label: 'Tip', colorSuffix: 'tip' },
  { type: 'important', icon: 'Star',           label: 'Important', colorSuffix: 'important' },
  { type: 'warning',   icon: 'AlertTriangle',  label: 'Warning', colorSuffix: 'warning' },
  { type: 'caution',   icon: 'OctagonAlert',   label: 'Caution', colorSuffix: 'caution' },
];

/** 根据 type 字符串查找配置 */
export function getCalloutConfig(type: string): CalloutTypeConfig {
  return CALLOUT_TYPES.find((c) => c.type === type) ?? CALLOUT_TYPES[0];
}

export function getCalloutLabel(
  type: string,
  locale: EffectiveCalloutLocale = getCurrentCalloutLocale(),
): string {
  const normalizedType = getCalloutConfig(type).type;
  return CALLOUT_LABELS[locale][normalizedType];
}

export function getCurrentCalloutLocale(): EffectiveCalloutLocale {
  const lang = document.documentElement.lang;
  if (lang === 'zh-TW') return 'zh-TW';
  if (lang === 'zh-CN') return 'zh-CN';
  return 'en-US';
}

const CALLOUT_LABELS: Record<EffectiveCalloutLocale, Record<CalloutType, string>> = {
  'zh-CN': {
    note: '提醒',
    tip: '建议',
    important: '重要',
    warning: '警告',
    caution: '风险',
  },
  'zh-TW': {
    note: '提醒',
    tip: '建議',
    important: '重要',
    warning: '警告',
    caution: '風險',
  },
  'en-US': {
    note: 'Note',
    tip: 'Tip',
    important: 'Important',
    warning: 'Warning',
    caution: 'Caution',
  },
};
