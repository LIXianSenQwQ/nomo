import { cleanup, fireEvent, render } from '@testing-library/svelte/pure';
import { tick, type ComponentProps } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileTreeNode } from '../types';

vi.mock('./ContextMenu.svelte', async () => {
  const module = await import('./ContextMenu.test-mock.svelte');
  return { default: module.default };
});

import ExplorerSidebar from './ExplorerSidebar.svelte';

type ExplorerSidebarProps = ComponentProps<typeof ExplorerSidebar>;

describe('ExplorerSidebar', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserverMock {
        observe() {
          // 测试首启时布局尚未完成的状态，不主动回填 clientHeight。
        }
        unobserve() {
          // noop
        }
        disconnect() {
          // noop
        }
      },
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 0);
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      window.clearTimeout(handle);
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps top rows visible when startup auto-scroll runs before the tree viewport is measured', async () => {
    const rootPath = 'D:\\Workspace\\2026-06';
    const activePath = `${rootPath}\\file-24.md`;

    const { container } = render(ExplorerSidebar, {
      props: createProps({
        currentFolderPath: rootPath,
        folderTree: createFolderTree(rootPath, 'file'),
        nativePath: activePath,
        fileName: 'file-24.md',
        filePath: activePath,
      }),
    });

    await waitForExplorerAsyncWork();

    expect(container.textContent).toContain('6.1-6.3');
    expect(container.textContent).toContain('logs');
    expect(container.textContent).toContain('图标');
    expect(container.textContent).toContain('王龙伟交接文档');
    expect(container.textContent).toContain('file-00.md');
    expect(container.textContent).not.toContain('file-24.md');
  });

  it('resets virtual scroll state when switching to another explorer root', async () => {
    const firstRootPath = 'D:\\Workspace\\2026-06';
    const secondRootPath = 'D:\\Workspace\\2026-07';
    const { container, rerender } = render(ExplorerSidebar, {
      props: createProps({
        currentFolderPath: firstRootPath,
        folderTree: createFolderTree(firstRootPath, 'june'),
      }),
    });

    const fileTree = container.querySelector<HTMLElement>('.file-tree');
    expect(fileTree).not.toBeNull();

    fileTree!.scrollTop = 520;
    await fireEvent.scroll(fileTree!);
    await tick();

    expect(container.textContent).not.toContain('6.1-6.3');

    await rerender(
      createProps({
        currentFolderPath: secondRootPath,
        folderTree: createFolderTree(secondRootPath, 'july'),
      }),
    );
    await tick();

    expect(fileTree!.scrollTop).toBe(0);
    expect(container.textContent).toContain('6.1-6.3');
    expect(container.textContent).toContain('july-00.md');
    expect(container.textContent).not.toContain('july-24.md');
  });

  it('waits for an async TXT open before pinning the double-clicked preview tab', async () => {
    const rootPath = 'D:\\Workspace';
    const txtPath = `${rootPath}\\notes.txt`;
    let finishOpen: (() => void) | undefined;
    const openPreviewFile = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishOpen = resolve;
        }),
    );
    const pinPreviewFile = vi.fn();
    const { getByTitle } = render(ExplorerSidebar, {
      props: createProps({
        currentFolderPath: rootPath,
        folderTree: [fileNode('notes.txt', txtPath)],
        openPreviewFile,
        pinPreviewFile,
      }),
    });

    await fireEvent.dblClick(getByTitle(txtPath));
    expect(openPreviewFile).toHaveBeenCalledWith(txtPath);
    expect(pinPreviewFile).not.toHaveBeenCalled();

    finishOpen?.();
    await tick();
    expect(pinPreviewFile).toHaveBeenCalledOnce();
  });
});

function createProps(overrides: Partial<ExplorerSidebarProps> = {}): ExplorerSidebarProps {
  return {
    interfaceLocale: 'zh-CN',
    currentFolderPath: '',
    rootFolderExpanded: true,
    folderTree: [],
    expandedFolders: new Set<string>(),
    nativePath: null,
    dirty: false,
    fileName: '',
    filePath: '',
    isResizing: false,
    getFolderName: (path) => path.split(/[\\/]/).filter(Boolean).at(-1) ?? path,
    getDirectoryLabel: (path) => path.replace(/[\\/][^\\/]+$/, ''),
    toggleRootFolder: vi.fn(),
    toggleFolderCollapse: vi.fn(),
    openPreviewFile: vi.fn(),
    pinPreviewFile: vi.fn(),
    previewNativePath: null,
    startResize: vi.fn(),
    ...overrides,
  };
}

function createFolderTree(rootPath: string, filePrefix: string): FileTreeNode[] {
  const folders = ['6.1-6.3', 'logs', '图标', '王龙伟交接文档'].map((name) =>
    folderNode(name, `${rootPath}\\${name}`),
  );
  const files = Array.from({ length: 30 }, (_item, index) => {
    const name = `${filePrefix}-${String(index).padStart(2, '0')}.md`;
    return fileNode(name, `${rootPath}\\${name}`);
  });

  return [...folders, ...files];
}

function folderNode(name: string, path: string): FileTreeNode {
  return {
    name,
    path,
    is_dir: true,
    has_children: true,
    children_loaded: false,
    loading: false,
    children: [],
  };
}

function fileNode(name: string, path: string): FileTreeNode {
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

async function waitForExplorerAsyncWork() {
  await tick();
  await waitForTimer();
  await tick();
  await waitForTimer();
  await tick();
}

function waitForTimer() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}
