import { createFolder, renameFile } from '../../lib/desktop/tauriStorage';
import type { FileTreeNode } from '../types';
import { getFolderName } from '../utils/pathLabels';
import { loadFolderTree, pickFolderPath } from './documentFiles';
import {
  expandAncestors as expandFolderAncestors,
  toggleExpandedFolder,
} from './folderTree';

interface FolderExplorerControllerOptions {
  getDesktopEnabled(): boolean;
  getFolderTree(): FileTreeNode[];
  setFolderTree(value: FileTreeNode[]): void;
  getExpandedFolders(): Set<string>;
  setExpandedFolders(value: Set<string>): void;
  getRootFolderExpanded(): boolean;
  setRootFolderExpanded(value: boolean): void;
  setCurrentFolderPath(value: string): void;
  setStatusMessage(value: string): void;
}

export function createFolderExplorerController(options: FolderExplorerControllerOptions) {
  function expandAncestors(filePath: string, rootPath: string) {
    options.setExpandedFolders(
      expandFolderAncestors(options.getExpandedFolders(), filePath, rootPath),
    );
  }

  function toggleFolderCollapse(folderPath: string) {
    options.setExpandedFolders(toggleExpandedFolder(options.getExpandedFolders(), folderPath));
  }

  function toggleRootFolder() {
    options.setRootFolderExpanded(!options.getRootFolderExpanded());
  }

  async function loadFolder(folderPath: string) {
    options.setCurrentFolderPath(folderPath);
    options.setRootFolderExpanded(true);
    const result = await loadFolderTree(folderPath);

    if ('error' in result) {
      options.setStatusMessage(result.error);
      options.setFolderTree(result.tree);
    } else {
      options.setFolderTree(result);
    }

    options.setStatusMessage(`已载入文件夹：${getFolderName(folderPath)}`);
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
    toggleFolderCollapse,
    toggleRootFolder,
    loadFolder,
    openFolderDialog,
  };
}
