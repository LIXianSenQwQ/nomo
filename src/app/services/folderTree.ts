import type { FileTreeNode } from '../types';

export function expandAncestors(expandedFolders: Set<string>, filePath: string, rootPath: string) {
  const nextExpandedFolders = new Set(expandedFolders);

  if (!filePath || !rootPath) {
    return nextExpandedFolders;
  }

  const normalizedFile = filePath.replace(/\\/g, '/');
  const normalizedRoot = rootPath.replace(/\\/g, '/');
  if (!normalizedFile.startsWith(normalizedRoot)) {
    return nextExpandedFolders;
  }

  const relative = normalizedFile.slice(normalizedRoot.length);
  const parts = relative.split('/').filter(Boolean);
  let currentPath = normalizedRoot;
  for (let i = 0; i < parts.length - 1; i++) {
    currentPath = currentPath + '/' + parts[i];
    nextExpandedFolders.add(currentPath.replace(/\//g, '\\'));
  }

  return nextExpandedFolders;
}

export function toggleExpandedFolder(expandedFolders: Set<string>, folderPath: string) {
  const nextExpandedFolders = new Set(expandedFolders);
  if (nextExpandedFolders.has(folderPath)) {
    nextExpandedFolders.delete(folderPath);
  } else {
    nextExpandedFolders.add(folderPath);
  }
  return nextExpandedFolders;
}

export function getDefaultExpandedFolders(folderTree: FileTreeNode[]) {
  const expandedFolders = new Set<string>();
  for (const item of folderTree) {
    if (item.is_dir && item.path) {
      expandedFolders.add(item.path);
    }
  }
  return expandedFolders;
}
