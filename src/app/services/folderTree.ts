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

export function normalizeFolderEntries(entries: FileTreeNode[]): FileTreeNode[] {
  return entries.map((entry) => ({
    ...entry,
    children: entry.children ?? [],
    children_loaded: entry.is_dir ? (entry.children_loaded ?? false) : true,
    has_children: entry.is_dir ? (entry.has_children ?? entry.children?.length > 0) : false,
    loading: false,
  }));
}

export function canExpandFolderNode(node: FileTreeNode, hasPendingCreate = false) {
  return (
    node.is_dir &&
    (node.loading === true ||
      node.has_children === true ||
      (node.children?.length ?? 0) > 0 ||
      hasPendingCreate)
  );
}

export function findTreeNode(nodes: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.children?.length) {
      const child = findTreeNode(node.children, path);
      if (child) return child;
    }
  }
  return null;
}

export function collectTreePaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    paths.push(node.path);
    if (node.children?.length) {
      paths.push(...collectTreePaths(node.children));
    }
  }
  return paths;
}

export function removeTreePaths(nodes: FileTreeNode[], removedPaths: string[]): FileTreeNode[] {
  if (removedPaths.length === 0) {
    return nodes;
  }

  let changed = false;
  const nextNodes: FileTreeNode[] = [];

  for (const node of nodes) {
    if (removedPaths.some((removedPath) => pathMatchesOrDescendsFrom(node.path, removedPath))) {
      changed = true;
      continue;
    }

    const nextChildren = node.children?.length
      ? removeTreePaths(node.children, removedPaths)
      : (node.children ?? []);
    const childrenChanged = nextChildren !== node.children;
    changed = changed || childrenChanged;

    if (childrenChanged) {
      nextNodes.push({
        ...node,
        children: nextChildren,
        has_children: node.is_dir
          ? nextChildren.length > 0 || (node.children_loaded ? false : node.has_children)
          : false,
      });
    } else {
      nextNodes.push(node);
    }
  }

  return changed ? nextNodes : nodes;
}

export function pruneExpandedFolders(
  expandedFolders: Set<string>,
  removedPaths: string[],
): Set<string> {
  if (removedPaths.length === 0) {
    return expandedFolders;
  }

  const nextExpandedFolders = new Set<string>();
  for (const folderPath of expandedFolders) {
    if (!removedPaths.some((removedPath) => pathMatchesOrDescendsFrom(folderPath, removedPath))) {
      nextExpandedFolders.add(folderPath);
    }
  }
  return nextExpandedFolders.size === expandedFolders.size ? expandedFolders : nextExpandedFolders;
}

export function updateFolderChildren(
  nodes: FileTreeNode[],
  folderPath: string,
  children: FileTreeNode[],
): FileTreeNode[] {
  return updateTreeNode(nodes, folderPath, (node) => ({
    ...node,
    children: normalizeFolderEntries(children),
    children_loaded: true,
    has_children: children.length > 0,
    loading: false,
  }));
}

export function markFolderLoading(
  nodes: FileTreeNode[],
  folderPath: string,
  loading: boolean,
): FileTreeNode[] {
  return updateTreeNode(nodes, folderPath, (node) => ({
    ...node,
    loading,
  }));
}

export function applyIndexedDirectories(
  nodes: FileTreeNode[],
  directories: FileTreeNode[],
): FileTreeNode[] {
  const directoryMap = new Map(directories.map((entry) => [entry.path, entry]));
  if (directoryMap.size === 0) {
    return nodes;
  }

  return updateTreeNodes(nodes, (node) => {
    const indexed = directoryMap.get(node.path);
    if (!indexed) {
      return node;
    }
    return {
      ...node,
      has_children: indexed.has_children ?? node.has_children,
    };
  });
}

function updateTreeNode(
  nodes: FileTreeNode[],
  path: string,
  updater: (node: FileTreeNode) => FileTreeNode,
): FileTreeNode[] {
  return updateTreeNodes(nodes, (node) => (node.path === path ? updater(node) : node));
}

function updateTreeNodes(
  nodes: FileTreeNode[],
  updater: (node: FileTreeNode) => FileTreeNode,
): FileTreeNode[] {
  let changed = false;
  const nextNodes = nodes.map((node) => {
    const updatedNode = updater(node);
    const nextChildren = updatedNode.children?.length
      ? updateTreeNodes(updatedNode.children, updater)
      : (updatedNode.children ?? []);
    const nextNode =
      nextChildren === updatedNode.children
        ? updatedNode
        : { ...updatedNode, children: nextChildren };
    changed = changed || nextNode !== node;
    return nextNode;
  });

  return changed ? nextNodes : nodes;
}

function pathMatchesOrDescendsFrom(path: string, ancestorPath: string) {
  const normalizedPath = normalizeComparablePath(path);
  const normalizedAncestor = normalizeComparablePath(ancestorPath);
  return (
    normalizedPath === normalizedAncestor || normalizedPath.startsWith(`${normalizedAncestor}/`)
  );
}

function normalizeComparablePath(path: string) {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}
