import type { FileTreeNode } from '../types';
import { checkPathsExist } from '../../lib/desktop/tauriStorage';
import { getFolderName } from '../utils/pathLabels';
import {
  loadFolderChildren,
  loadFolderTree,
  pickFolderPath,
  startFolderIndexing,
  type FolderIndexBatch,
  type FolderIndexFinished,
} from './documentFiles';
import {
  applyIndexedDirectories,
  collectTreePaths,
  expandAncestors as expandFolderAncestors,
  findTreeNode,
  markFolderLoading,
  normalizeFolderEntries,
  pruneExpandedFolders,
  removeTreePaths,
  toggleExpandedFolder,
  updateFolderChildren,
} from './folderTree';

interface FolderExplorerControllerOptions {
  getDesktopEnabled(): boolean;
  getFolderTree(): FileTreeNode[];
  setFolderTree(value: FileTreeNode[]): void;
  getExpandedFolders(): Set<string>;
  setExpandedFolders(value: Set<string>): void;
  getRootFolderExpanded(): boolean;
  setRootFolderExpanded(value: boolean): void;
  getCurrentFolderPath(): string;
  setCurrentFolderPath(value: string): void;
  setStatusMessage(value: string): void;
}

export function createFolderExplorerController(options: FolderExplorerControllerOptions) {
  async function expandAncestors(filePath: string, rootPath: string) {
    options.setExpandedFolders(
      expandFolderAncestors(options.getExpandedFolders(), filePath, rootPath),
    );
    await loadAncestorFolders(filePath, rootPath);
  }

  function toggleFolderCollapse(folderPath: string) {
    const currentExpanded = options.getExpandedFolders();
    const willExpand = !currentExpanded.has(folderPath);
    options.setExpandedFolders(toggleExpandedFolder(currentExpanded, folderPath));

    if (willExpand) {
      const node = findTreeNode(options.getFolderTree(), folderPath);
      if (node?.is_dir && !node.children_loaded && !node.loading) {
        loadFolderChildrenIntoTree(folderPath).catch((error) => {
          options.setStatusMessage(`载入子文件夹失败：${error}`);
        });
      }
    }
  }

  function toggleRootFolder() {
    options.setRootFolderExpanded(!options.getRootFolderExpanded());
  }

  async function loadFolder(folderPath: string) {
    options.setCurrentFolderPath(folderPath);
    options.setRootFolderExpanded(true);
    options.setExpandedFolders(new Set());
    const result = await loadFolderTree(folderPath);

    if ('error' in result) {
      options.setStatusMessage(result.error);
      options.setCurrentFolderPath('');
      options.setFolderTree(normalizeFolderEntries(result.tree));
      return;
    }

    options.setFolderTree(normalizeFolderEntries(result));
    startFolderIndexing(folderPath).catch(() => undefined);
    options.setStatusMessage(`已载入工作区：${getFolderName(folderPath)}，后台索引中`);
  }

  async function syncLoadedFolders() {
    const rootPath = options.getCurrentFolderPath();
    if (!options.getDesktopEnabled() || !rootPath) {
      return;
    }

    const knownPaths = [rootPath, ...collectTreePaths(options.getFolderTree())];
    const exists = await checkPathsExist(knownPaths).catch(() => knownPaths.map(() => true));
    const missingPaths = knownPaths.filter((_path, index) => !exists[index]);

    if (missingPaths.some((path) => samePath(path, rootPath))) {
      clearMissingRoot(rootPath);
      return;
    }

    const foldersToReload = getLoadedFolderPathsForRefresh(
      rootPath,
      options.getExpandedFolders(),
      missingPaths,
    );
    if (missingPaths.length > 0) {
      removeMissingPaths(missingPaths, false);
    }

    for (const folderPath of foldersToReload) {
      const result = await loadFolderChildren(folderPath, rootPath);
      if ('error' in result) {
        if (samePath(folderPath, rootPath)) {
          clearMissingRoot(rootPath);
          return;
        }
        removeMissingPaths([folderPath], false);
        continue;
      }

      if (samePath(folderPath, rootPath)) {
        options.setFolderTree(normalizeFolderEntries(result));
      } else if (findTreeNode(options.getFolderTree(), folderPath)?.is_dir) {
        options.setFolderTree(updateFolderChildren(options.getFolderTree(), folderPath, result));
      }
    }

    if (missingPaths.length > 0) {
      options.setStatusMessage(`已同步外部删除：${missingPaths.length} 项`);
    }
  }

  function removeMissingPaths(paths: string[], showMessage = true) {
    const rootPath = options.getCurrentFolderPath();
    if (rootPath && paths.some((path) => samePath(path, rootPath))) {
      clearMissingRoot(rootPath);
      return;
    }

    const missingPaths = paths.filter((path) => !rootPath || !samePath(path, rootPath));
    if (missingPaths.length === 0) {
      return;
    }

    options.setFolderTree(removeTreePaths(options.getFolderTree(), missingPaths));
    options.setExpandedFolders(pruneExpandedFolders(options.getExpandedFolders(), missingPaths));
    if (showMessage) {
      options.setStatusMessage(`文件不存在，已从资源管理器移除：${getFolderName(missingPaths[0])}`);
    }
  }

  function clearMissingRoot(rootPath: string) {
    options.setCurrentFolderPath('');
    options.setRootFolderExpanded(true);
    options.setExpandedFolders(new Set());
    options.setFolderTree([]);
    options.setStatusMessage(`工作区不存在或已被移动：${rootPath}`);
  }

  async function loadFolderChildrenIntoTree(folderPath: string) {
    const rootPath = options.getCurrentFolderPath();
    if (!rootPath) return;

    options.setFolderTree(markFolderLoading(options.getFolderTree(), folderPath, true));
    const result = await loadFolderChildren(folderPath, rootPath);

    if ('error' in result) {
      options.setFolderTree(markFolderLoading(options.getFolderTree(), folderPath, false));
      options.setStatusMessage(result.error);
      return;
    }

    options.setFolderTree(updateFolderChildren(options.getFolderTree(), folderPath, result));
  }

  async function loadAncestorFolders(filePath: string, rootPath: string) {
    const ancestors = getAncestorFolderPaths(filePath, rootPath);
    for (const folderPath of ancestors) {
      const node = findTreeNode(options.getFolderTree(), folderPath);
      if (node?.is_dir && !node.children_loaded && !node.loading) {
        await loadFolderChildrenIntoTree(folderPath);
      }
    }
  }

  function applyIndexBatch(payload: FolderIndexBatch) {
    if (!samePath(payload.root_path, options.getCurrentFolderPath())) {
      return;
    }
    options.setFolderTree(applyIndexedDirectories(options.getFolderTree(), payload.directories));
    options.setStatusMessage(
      `后台索引中：${payload.scanned_dirs} 个文件夹，${payload.scanned_files} 个文档`,
    );
  }

  function finishIndexing(payload: FolderIndexFinished) {
    if (!samePath(payload.root_path, options.getCurrentFolderPath())) {
      return;
    }
    options.setStatusMessage(
      `文件夹索引完成：${payload.scanned_dirs} 个文件夹，${payload.scanned_files} 个文档`,
    );
  }

  async function openFolderDialog() {
    if (!options.getDesktopEnabled()) {
      return;
    }

    const { folderPath, error } = await pickFolderPath();
    if (error) {
      options.setStatusMessage(error);
    }
    if (folderPath) {
      await loadFolder(folderPath);
    }
  }

  return {
    expandAncestors,
    applyIndexBatch,
    finishIndexing,
    toggleFolderCollapse,
    toggleRootFolder,
    loadFolder,
    removeMissingPaths,
    syncLoadedFolders,
    openFolderDialog,
  };
}

function getLoadedFolderPathsForRefresh(
  rootPath: string,
  expandedFolders: Set<string>,
  removedPaths: string[],
): string[] {
  return [rootPath].concat(
    Array.from(expandedFolders)
      .filter((folderPath) => !samePath(folderPath, rootPath))
      .filter(
        (folderPath) =>
          !removedPaths.some((removedPath) => pathMatchesOrDescendsFrom(folderPath, removedPath)),
      )
      .sort((left, right) => pathDepth(left) - pathDepth(right)),
  );
}

function getAncestorFolderPaths(filePath: string, rootPath: string) {
  const normalizedFile = normalizePath(filePath);
  const normalizedRoot = normalizePath(rootPath);
  if (!normalizedFile.startsWith(normalizedRoot)) {
    return [];
  }

  const relative = normalizedFile.slice(normalizedRoot.length);
  const parts = relative.split('/').filter(Boolean);
  const ancestors: string[] = [];
  let currentPath = normalizedRoot;
  for (let i = 0; i < parts.length - 1; i++) {
    currentPath = currentPath + '/' + parts[i];
    ancestors.push(toPlatformPath(currentPath, rootPath));
  }
  return ancestors;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/\/$/, '');
}

function toPlatformPath(path: string, referencePath: string) {
  return referencePath.includes('\\') ? path.replace(/\//g, '\\') : path;
}

function samePath(left: string, right: string) {
  return normalizePath(left).toLowerCase() === normalizePath(right).toLowerCase();
}

function pathMatchesOrDescendsFrom(path: string, ancestorPath: string) {
  const normalizedPath = normalizePath(path).toLowerCase();
  const normalizedAncestor = normalizePath(ancestorPath).toLowerCase();
  return (
    normalizedPath === normalizedAncestor || normalizedPath.startsWith(`${normalizedAncestor}/`)
  );
}

function pathDepth(path: string) {
  return normalizePath(path).split('/').filter(Boolean).length;
}
