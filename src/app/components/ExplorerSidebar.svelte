<script lang="ts">
  import {
    FileText,
    FolderOpen,
    FolderPlus,
    FilePlus,
    RefreshCw,
    ChevronsUp,
  } from '@lucide/svelte';
  import { slide } from 'svelte/transition';
  import type { FileTreeNode } from '../types';
  import type { ContextMenuItem } from '../../lib/editor-core/plugins/contextMenu';
  import { createEventDispatcher } from 'svelte';
  import { clickOutside } from '../actions/clickOutside';
  import { motionIn, pulseOnChange, transitionDuration } from '../actions/motion';
  import { buildVisibleExplorerRows, type ExplorerTreeRow } from '../services/explorerRows';
  import { canExpandFolderNode } from '../services/folderTree';
  import ContextMenu from './ContextMenu.svelte';

  export let currentFolderPath: string;
  export let rootFolderExpanded: boolean;
  export let folderTree: FileTreeNode[];
  export let expandedFolders: Set<string>;
  export let nativePath: string | null;
  export let dirty: boolean;
  export let fileName: string;
  export let filePath: string;
  export let isResizing: boolean;
  export let getFolderName: (path: string) => string;
  export let getDirectoryLabel: (path: string) => string;
  export let toggleRootFolder: () => void;
  export let toggleFolderCollapse: (path: string) => void;
  export let openRecentEntry: (path: string, entryType: 'file' | 'folder') => void;
  export let openPreviewFile: (path: string) => void;
  export let previewNativePath: string | null;
  export let startResize: (event: MouseEvent) => void;

  const dispatch = createEventDispatcher<{
    createNode: { parentPath: string; type: 'folder' | 'file'; name: string };
    renameNode: { path: string; newName: string };
    refreshFolder: void;
    collapseAll: void;
    deleteNode: { path: string; isDir: boolean };
  }>();

  let creatingParentPath: string | null = null;
  let creatingType: 'folder' | 'file' | null = null;
  let creatingValue = '';
  let creatingInputRef: HTMLInputElement | null = null;

  // 资源管理器右键菜单状态
  let explorerContextMenuOpen = false;
  let explorerContextMenuX = 0;
  let explorerContextMenuY = 0;
  let explorerContextMenuItems: ContextMenuItem[] = [];

  let renamingPath: string | null = null;
  let renamingValue = '';
  let renamingInputRef: HTMLInputElement | null = null;

  // 正在创建中的文件夹路径（用于空文件夹创建时临时显示箭头）
  let pendingCreatePaths: Set<string> = new Set();

  // 文件树双击检测状态（单击预览 / 双击固定）
  let pendingClickTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingClickPath: string | null = null;

  const TREE_ROW_HEIGHT = 26;
  const TREE_OVERSCAN = 8;
  let fileTreeScrollTop = 0;
  let fileTreeViewportHeight = 0;
  let flattenedRows: ExplorerTreeRow[] = [];
  let virtualRows: ExplorerTreeRow[] = [];
  let virtualTreeHeight = 0;

  $: flattenedRows = buildVisibleExplorerRows(
    folderTree,
    expandedFolders,
    creatingParentPath,
    TREE_ROW_HEIGHT,
  );
  $: virtualTreeHeight = flattenedRows.length * TREE_ROW_HEIGHT;
  $: {
    const start = Math.max(0, Math.floor(fileTreeScrollTop / TREE_ROW_HEIGHT) - TREE_OVERSCAN);
    const visibleCount =
      Math.ceil(Math.max(fileTreeViewportHeight, TREE_ROW_HEIGHT) / TREE_ROW_HEIGHT) +
      TREE_OVERSCAN * 2;
    virtualRows = flattenedRows.slice(start, start + visibleCount);
  }

  function handleFileTreeScroll(event: Event) {
    fileTreeScrollTop = (event.currentTarget as HTMLElement).scrollTop;
  }

  function folderCanExpand(node: FileTreeNode) {
    return canExpandFolderNode(node, pendingCreatePaths.has(node.path));
  }

  function handleFileClick(path: string) {
    // 取消任何待处理的单击（跨文件单击直接替换）
    if (pendingClickTimer) {
      clearTimeout(pendingClickTimer);
      pendingClickTimer = null;
      pendingClickPath = null;
    }

    pendingClickPath = path;
    pendingClickTimer = setTimeout(() => {
      pendingClickTimer = null;
      pendingClickPath = null;
      openPreviewFile(path);
    }, 250);
  }

  function handleFileDblClick(path: string) {
    if (pendingClickTimer && pendingClickPath === path) {
      clearTimeout(pendingClickTimer);
      pendingClickTimer = null;
      pendingClickPath = null;
    }
    openRecentEntry(path, 'file');
  }

  function startCreating(parentPath: string, type: 'folder' | 'file', event?: MouseEvent) {
    event?.stopPropagation();
    creatingParentPath = parentPath;
    creatingType = type;
    creatingValue = '';
    pendingCreatePaths = pendingCreatePaths.add(parentPath);
    // Expand parent if it's collapsed
    if (parentPath === currentFolderPath) {
      if (!rootFolderExpanded) toggleRootFolder();
    } else {
      if (!expandedFolders.has(parentPath)) toggleFolderCollapse(parentPath);
    }
    setTimeout(() => {
      if (creatingInputRef) creatingInputRef.focus();
    }, 0);
  }

  function commitCreating() {
    if (!creatingType || !creatingParentPath) return;
    const value = creatingValue.trim();
    if (!value) {
      // 未输入内容时取消创建
      cancelCreating();
      return;
    }
    dispatch('createNode', {
      parentPath: creatingParentPath,
      type: creatingType,
      name: value,
    });
    pendingCreatePaths.delete(creatingParentPath);
    pendingCreatePaths = pendingCreatePaths;
    creatingParentPath = null;
    creatingType = null;
  }

  function cancelCreating() {
    if (creatingParentPath) {
      pendingCreatePaths.delete(creatingParentPath);
      pendingCreatePaths = pendingCreatePaths;
    }
    creatingParentPath = null;
    creatingType = null;
  }

  function handleCreatingKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (creatingValue.trim()) {
        commitCreating();
      } else {
        cancelCreating();
      }
    } else if (event.key === 'Escape') {
      cancelCreating();
    }
  }

  function startRenaming(path: string, currentName: string, event?: MouseEvent) {
    event?.stopPropagation();
    renamingPath = path;
    renamingValue = currentName;
    setTimeout(() => {
      if (renamingInputRef) {
        renamingInputRef.focus();
        renamingInputRef.select();
      }
    }, 0);
  }

  function handleFolderDoubleClick(node: FileTreeNode, event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.chevron-icon')) {
      event.stopPropagation();
      return;
    }
    startRenaming(node.path, node.name, event);
  }

  function commitRenaming() {
    if (!renamingPath) return;
    const value = renamingValue.trim();
    if (value) {
      dispatch('renameNode', { path: renamingPath, newName: value });
    }
    renamingPath = null;
  }

  function cancelRenaming() {
    renamingPath = null;
  }

  function handleRenamingKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      commitRenaming();
    } else if (event.key === 'Escape') {
      cancelRenaming();
    }
  }

  // 判断文件夹是否包含当前活跃文件（用于状态反馈高亮）
  function isFolderActive(folderPath: string): boolean {
    const activePath = nativePath || previewNativePath || '';
    if (!activePath) return false;
    if (activePath === folderPath) return false; // 文件高亮由 .active 处理
    const sep = activePath.includes('\\') ? '\\' : '/';
    return activePath.startsWith(folderPath + sep);
  }

  // 在系统文件管理器中定位文件/文件夹
  async function revealPathInFolder(path: string) {
    try {
      const { revealInExplorer } = await import('../../lib/desktop/tauriStorage');
      await revealInExplorer(path);
    } catch {
      // 非桌面环境或调用失败，静默忽略
    }
  }

  // 步骤1：构建文件右键菜单项
  function buildFileContextMenuItems(node: FileTreeNode): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    items.push({
      label: '打开',
      action: () => openPreviewFile(node.path),
    });
    items.push({
      label: '在新标签页打开',
      action: () => openRecentEntry(node.path, 'file'),
    });

    items.push({ label: '', action: () => {}, separator: true });
    items.push({
      label: '重命名',
      action: () => startRenaming(node.path, node.name),
    });

    items.push({ label: '', action: () => {}, separator: true });
    items.push({
      label: '复制路径',
      action: () => {
        navigator.clipboard.writeText(node.path).catch(() => {});
      },
    });
    items.push({
      label: '在文件夹中显示',
      action: () => revealPathInFolder(node.path),
    });

    items.push({ label: '', action: () => {}, separator: true });
    items.push({
      label: '删除',
      danger: true,
      action: () => {
        dispatch('deleteNode', { path: node.path, isDir: false });
      },
    });

    return items;
  }

  // 步骤2：构建文件夹右键菜单项
  function buildFolderContextMenuItems(node: FileTreeNode): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    items.push({
      label: '新建文件',
      action: () => startCreating(node.path, 'file'),
    });
    items.push({
      label: '新建文件夹',
      action: () => startCreating(node.path, 'folder'),
    });

    items.push({ label: '', action: () => {}, separator: true });
    items.push({
      label: '重命名',
      action: () => startRenaming(node.path, node.name),
    });

    items.push({ label: '', action: () => {}, separator: true });
    items.push({
      label: '复制路径',
      action: () => {
        navigator.clipboard.writeText(node.path).catch(() => {});
      },
    });
    items.push({
      label: '在文件夹中显示',
      action: () => revealPathInFolder(node.path),
    });

    items.push({ label: '', action: () => {}, separator: true });
    items.push({
      label: '刷新',
      action: () => dispatch('refreshFolder'),
    });
    items.push({
      label: '删除',
      danger: true,
      action: () => {
        dispatch('deleteNode', { path: node.path, isDir: true });
      },
    });

    return items;
  }

  // 步骤3：处理文件右键事件
  function handleFileContextMenu(node: FileTreeNode, event: MouseEvent) {
    event.preventDefault();
    explorerContextMenuX = event.clientX;
    explorerContextMenuY = event.clientY;
    explorerContextMenuItems = buildFileContextMenuItems(node);
    explorerContextMenuOpen = true;
  }

  // 步骤4：处理文件夹右键事件
  function handleFolderContextMenu(node: FileTreeNode, event: MouseEvent) {
    event.preventDefault();
    explorerContextMenuX = event.clientX;
    explorerContextMenuY = event.clientY;
    explorerContextMenuItems = buildFolderContextMenuItems(node);
    explorerContextMenuOpen = true;
  }

  // 步骤5：关闭资源管理器右键菜单
  function closeExplorerContextMenu() {
    explorerContextMenuOpen = false;
    explorerContextMenuItems = [];
  }
</script>

<aside class="rail" aria-label="资源管理器">
  <header class="explorer-header">
    <span>资源管理器</span>
    <div class="header-actions">
      <button
        type="button"
        class="action-btn"
        title="刷新"
        on:click={() => dispatch('refreshFolder')}
      >
        <RefreshCw size={13} />
      </button>
      <button
        type="button"
        class="action-btn"
        title="折叠全部"
        on:click={() => dispatch('collapseAll')}
      >
        <ChevronsUp size={13} />
      </button>
    </div>
  </header>

  <section
    class="file-tree"
    aria-label="文件夹结构"
    bind:clientHeight={fileTreeViewportHeight}
    on:scroll={handleFileTreeScroll}
  >
    <div class="tree-root">
      {#if currentFolderPath}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div
          role="button"
          tabindex="0"
          class="tree-folder-root-title"
          class:collapsed={!rootFolderExpanded}
          class:active={isFolderActive(currentFolderPath)}
          title={currentFolderPath}
          on:click={toggleRootFolder}
          on:contextmenu|preventDefault={(event) => {
            // 根文件夹右键菜单：不包含重命名和删除
            const items: ContextMenuItem[] = [];
            items.push({
              label: '新建文件',
              action: () => startCreating(currentFolderPath, 'file'),
            });
            items.push({
              label: '新建文件夹',
              action: () => startCreating(currentFolderPath, 'folder'),
            });
            items.push({ label: '', action: () => {}, separator: true });
            items.push({
              label: '复制路径',
              action: () => {
                navigator.clipboard.writeText(currentFolderPath).catch(() => {});
              },
            });
            items.push({
              label: '在文件夹中显示',
              action: () => revealPathInFolder(currentFolderPath),
            });
            items.push({ label: '', action: () => {}, separator: true });
            items.push({
              label: '刷新',
              action: () => dispatch('refreshFolder'),
            });
            explorerContextMenuX = event.clientX;
            explorerContextMenuY = event.clientY;
            explorerContextMenuItems = items;
            explorerContextMenuOpen = true;
          }}
        >
          <span class="chevron-icon">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
              ><path
                d="M3 4.5l3 3 3-3"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg
            >
          </span>
          <FolderOpen size={14} />
          <span class="node-name">{getFolderName(currentFolderPath)}</span>
          <div class="folder-actions">
            <button
              type="button"
              class="action-btn"
              title="新建文件"
              on:click={(e) => startCreating(currentFolderPath, 'file', e)}
            >
              <FilePlus size={12} />
            </button>
            <button
              type="button"
              class="action-btn"
              title="新建文件夹"
              on:click={(e) => startCreating(currentFolderPath, 'folder', e)}
            >
              <FolderPlus size={12} />
            </button>
          </div>
        </div>

        {#if creatingParentPath === currentFolderPath}
          <div
            class="tree-creating"
            style="padding-left: 34px"
            use:motionIn={{ kind: 'row', y: -4 }}
            transition:slide={{ duration: transitionDuration('row') }}
          >
            {#if creatingType === 'folder'}
              <FolderOpen size={13} />
            {:else}
              <FileText size={13} />
            {/if}
            <input
              bind:this={creatingInputRef}
              bind:value={creatingValue}
              on:blur={commitCreating}
              on:keydown={handleCreatingKeydown}
              class="rename-input"
              placeholder={creatingType === 'folder' ? '新建文件夹' : '无标题.md'}
            />
          </div>
        {/if}

        {#if rootFolderExpanded}
          <div
            class="recent-tree recursive-tree-container virtual-tree-viewport"
            style="height: {virtualTreeHeight}px"
          >
            {#each virtualRows as row (row.key)}
              <div class="tree-virtual-row" style="transform: translateY({row.top}px)">
                {#if row.type === 'folder'}
                  {@const node = row.node}
                  {@const isExpanded = expandedFolders.has(node.path)}
                  {@const hasChildren = folderCanExpand(node)}
                  <div
                    class="tree-folder-wrapper"
                    class:expanded={isExpanded && hasChildren}
                    style="--tree-depth: {row.depth}"
                  >
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <div
                      role="button"
                      tabindex="0"
                      class="tree-folder nested-dir"
                      class:collapsed={!isExpanded}
                      class:active={isFolderActive(node.path)}
                      class:empty={!hasChildren}
                      style="padding-left: {12 + row.depth * 12}px"
                      title={node.path}
                      on:click={() => hasChildren && toggleFolderCollapse(node.path)}
                      on:dblclick={(event) => handleFolderDoubleClick(node, event)}
                      on:contextmenu|preventDefault={(event) =>
                        handleFolderContextMenu(node, event)}
                    >
                      {#if hasChildren}
                        <span class="chevron-icon">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            ><path
                              d="M3 4.5l3 3 3-3"
                              stroke-width="1.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            /></svg
                          >
                        </span>
                      {:else}
                        <span class="chevron-placeholder"></span>
                      {/if}
                      {#if node.loading}
                        <span class="tree-loading-icon" aria-hidden="true"
                          ><RefreshCw size={13} /></span
                        >
                      {:else}
                        <FolderOpen size={13} />
                      {/if}
                      {#if renamingPath === node.path}
                        <input
                          bind:this={renamingInputRef}
                          bind:value={renamingValue}
                          on:blur={cancelRenaming}
                          on:keydown={handleRenamingKeydown}
                          class="rename-input"
                          use:clickOutside={cancelRenaming}
                          use:motionIn={{ kind: 'micro', y: -2 }}
                          on:click|stopPropagation
                        />
                      {:else}
                        <span class="node-name">{node.name}</span>
                        <div class="folder-actions">
                          <button
                            type="button"
                            class="action-btn"
                            title="新建文件"
                            on:click={(e) => startCreating(node.path, 'file', e)}
                          >
                            <FilePlus size={12} />
                          </button>
                          <button
                            type="button"
                            class="action-btn"
                            title="新建文件夹"
                            on:click={(e) => startCreating(node.path, 'folder', e)}
                          >
                            <FolderPlus size={12} />
                          </button>
                        </div>
                      {/if}
                    </div>
                  </div>
                {:else if row.type === 'creating'}
                  <div
                    class="tree-creating"
                    style="padding-left: {34 + row.depth * 12}px"
                    use:motionIn={{ kind: 'row', y: -4 }}
                  >
                    {#if creatingType === 'folder'}
                      <FolderOpen size={13} />
                    {:else}
                      <FileText size={13} />
                    {/if}
                    <input
                      bind:this={creatingInputRef}
                      bind:value={creatingValue}
                      on:blur={commitCreating}
                      on:keydown={handleCreatingKeydown}
                      class="rename-input"
                      placeholder={creatingType === 'folder' ? '新建文件夹' : '无标题.md'}
                    />
                  </div>
                {:else}
                  {@const node = row.node}
                  <button
                    type="button"
                    class="tree-file"
                    class:active={nativePath === node.path}
                    class:preview={previewNativePath === node.path}
                    style="padding-left: {34 + row.depth * 12}px"
                    title={node.path}
                    use:pulseOnChange={nativePath === node.path || previewNativePath === node.path}
                    on:click={() => handleFileClick(node.path)}
                    on:dblclick={() => handleFileDblClick(node.path)}
                    on:contextmenu|preventDefault={(event) => handleFileContextMenu(node, event)}
                  >
                    <FileText size={13} />
                    <span>{node.name}</span>
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div
          role="button"
          tabindex="0"
          class="tree-folder-root-title"
          class:collapsed={!rootFolderExpanded}
          title={getDirectoryLabel(filePath)}
          on:click={toggleRootFolder}
        >
          <span class="chevron-icon">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
              ><path
                d="M3 4.5l3 3 3-3"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg
            >
          </span>
          <FolderOpen size={14} />
          <span>{getFolderName(getDirectoryLabel(filePath))}</span>
        </div>

        {#if rootFolderExpanded}
          <button type="button" class="tree-file active" title={filePath} use:pulseOnChange={dirty}>
            <FileText size={13} />
            <span>{fileName}</span>
          </button>
        {/if}
      {/if}
    </div>
  </section>
  <button
    type="button"
    class="sidebar-resizer"
    class:active={isResizing}
    aria-label="调整侧边栏宽度"
    on:mousedown={startResize}
  ></button>
</aside>

{#if explorerContextMenuOpen}
  <ContextMenu
    x={explorerContextMenuX}
    y={explorerContextMenuY}
    items={explorerContextMenuItems}
    onClose={closeExplorerContextMenu}
  />
{/if}
