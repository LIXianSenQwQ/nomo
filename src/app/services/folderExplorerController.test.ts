import { describe, expect, it, vi } from 'vitest';
import { checkPathsExist } from '../../lib/desktop/tauriStorage';
import type { FileTreeNode } from '../types';
import { loadFolderChildren } from './documentFiles';
import { createFolderExplorerController } from './folderExplorerController';

vi.mock('../../lib/desktop/tauriStorage', () => ({
  checkPathsExist: vi.fn(),
}));

vi.mock('./documentFiles', () => ({
  loadFolderChildren: vi.fn(),
  loadFolderTree: vi.fn(),
  pickFolderPath: vi.fn(),
  startFolderIndexing: vi.fn(),
}));

describe('folderExplorerController', () => {
  it.skip('刷新已展开文件夹时只提交最终文件树，避免 UI 暴露中间空树', async () => {
    const rootPath = 'D:\\Demo\\Workspace';
    const docsPath = `${rootPath}\\docs`;
    const notesPath = `${docsPath}\\notes`;

    let folderTree: FileTreeNode[] = [
      folder({
        name: 'docs',
        path: docsPath,
        has_children: true,
        children_loaded: true,
        children: [
          folder({
            name: 'notes',
            path: notesPath,
            has_children: true,
            children_loaded: true,
            children: [file('old.md', `${notesPath}\\old.md`)],
          }),
        ],
      }),
    ];
    let expandedFolders = new Set([docsPath, notesPath]);

    const setFolderTree = vi.fn((value: FileTreeNode[]) => {
      folderTree = value;
    });
    const setExpandedFolders = vi.fn((value: Set<string>) => {
      expandedFolders = value;
    });
    const controller = createFolderExplorerController({
      getDesktopEnabled: () => true,
      getFolderTree: () => folderTree,
      setFolderTree,
      getExpandedFolders: () => expandedFolders,
      setExpandedFolders,
      getRootFolderExpanded: () => true,
      setRootFolderExpanded: vi.fn(),
      getCurrentFolderPath: () => rootPath,
      setCurrentFolderPath: vi.fn(),
      setStatusMessage: vi.fn(),
    });

    vi.mocked(checkPathsExist).mockImplementation(async (paths) => paths.map(() => true));
    vi.mocked(loadFolderChildren).mockImplementation(async (path) => {
      if (path === rootPath) {
        return [
          folder({
            name: 'docs',
            path: docsPath,
            has_children: true,
            children_loaded: false,
            children: [],
          }),
          file('readme.md', `${rootPath}\\readme.md`),
        ];
      }
      if (path === docsPath) {
        return [
          folder({
            name: 'notes',
            path: notesPath,
            has_children: true,
            children_loaded: false,
            children: [],
          }),
          file('fresh.md', `${docsPath}\\fresh.md`),
        ];
      }
      if (path === notesPath) {
        return [file('nested.md', `${notesPath}\\nested.md`)];
      }
      return [];
    });

    await controller.syncLoadedFolders();

    expect(setFolderTree).toHaveBeenCalledTimes(1);
    expect(setExpandedFolders).not.toHaveBeenCalled();
    expect(loadFolderChildren).toHaveBeenCalledWith(rootPath, rootPath);
    expect(loadFolderChildren).toHaveBeenCalledWith(docsPath, rootPath);
    expect(loadFolderChildren).toHaveBeenCalledWith(notesPath, rootPath);
    expect(folderTree).toEqual([
      folder({
        name: 'docs',
        path: docsPath,
        has_children: true,
        children_loaded: true,
        children: [
          folder({
            name: 'notes',
            path: notesPath,
            has_children: true,
            children_loaded: true,
            children: [file('nested.md', `${notesPath}\\nested.md`)],
          }),
          file('fresh.md', `${docsPath}\\fresh.md`),
        ],
      }),
      file('readme.md', `${rootPath}\\readme.md`),
    ]);
  });
});

function folder(overrides: Partial<FileTreeNode>): FileTreeNode {
  return {
    name: 'folder',
    path: 'D:\\Demo\\Workspace\\folder',
    is_dir: true,
    has_children: false,
    children_loaded: false,
    loading: false,
    children: [],
    ...overrides,
  };
}

function file(name: string, path: string): FileTreeNode {
  return {
    name,
    path,
    is_dir: false,
    has_children: false,
    children_loaded: true,
    loading: false,
    children: [],
  };
}
