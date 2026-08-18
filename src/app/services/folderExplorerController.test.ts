import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkPathsExist } from '../../lib/desktop/tauriStorage';
import type { FileTreeNode } from '../types';
import { loadFolderChildren, loadFolderTree } from './documentFiles';
import { createFolderExplorerController } from './folderExplorerController';

vi.mock('../../lib/desktop/tauriStorage', () => ({
  checkPathsExist: vi.fn(),
}));

vi.mock('./documentFiles', () => ({
  loadFolderChildren: vi.fn(),
  loadFolderTree: vi.fn(),
  pickFolderPath: vi.fn(),
}));

describe('folderExplorerController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('载入工作区时只读取根目录，不启动递归索引', async () => {
    const state = createControllerState('D:\\Demo\\Workspace');
    vi.mocked(loadFolderTree).mockResolvedValue([
      file('readme.md', `${state.rootPath}\\readme.md`),
    ]);

    await state.controller.loadFolder(state.rootPath);

    expect(loadFolderTree).toHaveBeenCalledOnce();
    expect(loadFolderTree).toHaveBeenCalledWith(state.rootPath);
    expect(loadFolderChildren).not.toHaveBeenCalled();
    expect(state.folderTree).toHaveLength(1);
    expect(state.statusMessage).not.toMatch(/索引|index/i);
  });

  it('合并仍在执行的目录刷新，完成后允许下一次刷新', async () => {
    const state = createControllerState('D:\\Demo\\Workspace');
    let resolveExists!: (value: boolean[]) => void;
    vi.mocked(checkPathsExist).mockImplementationOnce(
      () => new Promise((resolve) => (resolveExists = resolve)),
    );
    vi.mocked(loadFolderChildren).mockResolvedValue([]);

    const first = state.controller.syncLoadedFolders();
    const overlapping = state.controller.syncLoadedFolders();

    expect(overlapping).toBe(first);
    expect(checkPathsExist).toHaveBeenCalledOnce();
    resolveExists([true]);
    await first;

    vi.mocked(checkPathsExist).mockResolvedValue([true]);
    await state.controller.syncLoadedFolders();
    expect(checkPathsExist).toHaveBeenCalledTimes(2);
  });

  it('刷新发现工作区根目录消失时清空工作区', async () => {
    const state = createControllerState('D:\\Demo\\Workspace', [
      file('readme.md', 'D:\\Demo\\Workspace\\readme.md'),
    ]);
    vi.mocked(checkPathsExist).mockResolvedValue([false, true]);

    await state.controller.syncLoadedFolders();

    expect(state.currentFolderPath).toBe('');
    expect(state.folderTree).toEqual([]);
    expect(state.expandedFolders.size).toBe(0);
    expect(loadFolderChildren).not.toHaveBeenCalled();
  });

  it('刷新已展开文件夹时只提交最终文件树，避免 UI 暴露中间空树', async () => {
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
    const normalizedRootPath = rootPath.replace(/\\/g, '/');
    const normalizedDocsPath = docsPath.replace(/\\/g, '/');
    const normalizedNotesPath = notesPath.replace(/\\/g, '/');
    expect(folderTree).toEqual([
      folder({
        name: 'docs',
        path: normalizedDocsPath,
        has_children: true,
        children_loaded: true,
        children: [
          folder({
            name: 'notes',
            path: normalizedNotesPath,
            has_children: true,
            children_loaded: true,
            children: [file('nested.md', `${normalizedNotesPath}/nested.md`)],
          }),
          file('fresh.md', `${normalizedDocsPath}/fresh.md`),
        ],
      }),
      file('readme.md', `${normalizedRootPath}/readme.md`),
    ]);
  });
});

function createControllerState(rootPath: string, initialTree: FileTreeNode[] = []) {
  let folderTree = initialTree;
  let expandedFolders = new Set<string>();
  let currentFolderPath = rootPath;
  let rootFolderExpanded = true;
  let statusMessage = '';

  const controller = createFolderExplorerController({
    getDesktopEnabled: () => true,
    getFolderTree: () => folderTree,
    setFolderTree: (value) => (folderTree = value),
    getExpandedFolders: () => expandedFolders,
    setExpandedFolders: (value) => (expandedFolders = value),
    getRootFolderExpanded: () => rootFolderExpanded,
    setRootFolderExpanded: (value) => (rootFolderExpanded = value),
    getCurrentFolderPath: () => currentFolderPath,
    setCurrentFolderPath: (value) => (currentFolderPath = value),
    setStatusMessage: (value) => (statusMessage = value),
  });

  return {
    controller,
    rootPath,
    get folderTree() {
      return folderTree;
    },
    get expandedFolders() {
      return expandedFolders;
    },
    get currentFolderPath() {
      return currentFolderPath;
    },
    get statusMessage() {
      return statusMessage;
    },
  };
}

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
