import type { Tab } from '../types';
import { pathEqualsOrDescendsFrom } from '../utils/pathLabels';
import { getDocumentKindFromPath, isSegmentedTextTab } from './tabs';

export type OpenDocumentRenameBlock = 'segmented-session' | 'document-kind';

/**
 * 已打开的分段会话把路径、基线和 recovery key 绑定在 Rust；没有原子 rebind 前必须显式阻止重命名。
 * Markdown 可随目录移动，但打开期间不得跨扩展名族切换编辑器实现。
 */
export function getOpenDocumentRenameBlock(
  tabs: Tab[],
  sourcePath: string,
  targetPath: string,
): OpenDocumentRenameBlock | null {
  const affected = tabs.filter(
    (tab) => tab.nativePath && pathEqualsOrDescendsFrom(tab.nativePath, sourcePath),
  );
  if (affected.some(isSegmentedTextTab)) return 'segmented-session';

  for (const tab of affected) {
    const nextPath = replacePathPrefix(tab.nativePath!, sourcePath, targetPath);
    if (getDocumentKindFromPath(nextPath) !== tab.documentKind) return 'document-kind';
  }
  return null;
}

function replacePathPrefix(path: string, sourcePath: string, targetPath: string) {
  return `${targetPath}${path.slice(sourcePath.length)}`;
}
