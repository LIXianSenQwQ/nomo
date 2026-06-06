import { Plugin, PluginKey } from 'prosemirror-state';

export const calloutPluginKey = new PluginKey('callout');

/**
 * 创建 callout 插件。
 * 目前仅保留独立插件位，callout 的键盘行为由 calloutCommands 中的命令显式处理。
 */
export function createCalloutPlugin(): Plugin {
  return new Plugin({
    key: calloutPluginKey,
  });
}
