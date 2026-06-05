/** Callout（提示块）类型定义 */

/** 5 种固定 callout 类型 */
export type CalloutType = 'note' | 'tip' | 'important' | 'warning' | 'caution';

/** callout 类型配置：图标名、中文标题、颜色变量后缀 */
export interface CalloutTypeConfig {
  type: CalloutType;
  icon: string;       // Lucide 图标名
  label: string;      // 中文标题
  colorSuffix: string; // CSS 变量后缀，如 --md-editor-callout-note-border
}

/** 5 种类型的静态配置表 */
export const CALLOUT_TYPES: CalloutTypeConfig[] = [
  { type: 'note',      icon: 'Info',           label: '提醒', colorSuffix: 'note' },
  { type: 'tip',       icon: 'Lightbulb',      label: '建议', colorSuffix: 'tip' },
  { type: 'important', icon: 'Star',           label: '重要', colorSuffix: 'important' },
  { type: 'warning',   icon: 'AlertTriangle',  label: '警告', colorSuffix: 'warning' },
  { type: 'caution',   icon: 'OctagonAlert',   label: '风险', colorSuffix: 'caution' },
];

/** 根据 type 字符串查找配置 */
export function getCalloutConfig(type: string): CalloutTypeConfig {
  return CALLOUT_TYPES.find((c) => c.type === type) ?? CALLOUT_TYPES[0];
}
