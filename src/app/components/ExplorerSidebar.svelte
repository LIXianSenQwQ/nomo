<script lang="ts">
  import { FileText, FolderOpen, FolderPlus, FilePlus } from '@lucide/svelte';
  import type { FileTreeNode } from '../types';
  import { createEventDispatcher } from 'svelte';

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
  export let openRecentFile: (path: string) => void;
  export let openPreviewFile: (path: string) => void;
  export let previewNativePath: string | null;
  export let startResize: (event: MouseEvent) => void;

  const dispatch = createEventDispatcher();

  let creatingParentPath: string | null = null;
  let creatingType: 'folder' | 'file' | null = null;
  let creatingValue = '';
  let creatingInputRef: HTMLInputElement | null = null;

  let renamingPath: string | null = null;
  let renamingValue = '';
  let renamingInputRef: HTMLInputElement | null = null;

  // 文件树双击检测状态（单击预览 / 双击固定）
  let pendingClickTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingClickPath: string | null = null;

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
    openRecentFile(path);
  }

  function startCreating(parentPath: string, type: 'folder' | 'file', event: MouseEvent) {
    event.stopPropagation();
    creatingParentPath = parentPath;
    creatingType = type;
    creatingValue = '';
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
    dispatch('createNode', {
      parentPath: creatingParentPath,
      type: creatingType,
      name: value, // Can be empty, parent handles fallback
    });
    creatingParentPath = null;
    creatingType = null;
  }

  function cancelCreating() {
    creatingParentPath = null;
    creatingType = null;
  }

  function handleCreatingKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      commitCreating();
    } else if (event.key === 'Escape') {
      cancelCreating();
    }
  }

  function startRenaming(path: string, currentName: string, event: MouseEvent) {
    event.stopPropagation();
    renamingPath = path;
    renamingValue = currentName;
    setTimeout(() => {
      if (renamingInputRef) {
        renamingInputRef.focus();
        renamingInputRef.select();
      }
    }, 0);
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
</script>

<aside class="rail" aria-label="资源管理器">
  <header class="explorer-header">
    <span>资源管理器</span>
  </header>

  <section class="file-tree" aria-label="文件夹结构">
    {#snippet renderTree(nodes: FileTreeNode[], depth: number)}
      {#each nodes as node}
        {#if node.is_dir}
          {@const isExpanded = expandedFolders.has(node.path)}
          <div class="tree-folder-wrapper">
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div
              role="button"
              tabindex="0"
              class="tree-folder nested-dir"
              class:collapsed={!isExpanded}
              style="padding-left: {12 + depth * 12}px"
              title={node.path}
              on:click={() => toggleFolderCollapse(node.path)}
              on:dblclick={(e) => startRenaming(node.path, node.name, e)}
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
              <FolderOpen size={13} />
              {#if renamingPath === node.path}
                <input
                  bind:this={renamingInputRef}
                  bind:value={renamingValue}
                  on:blur={commitRenaming}
                  on:keydown={handleRenamingKeydown}
                  class="rename-input"
                  on:click|stopPropagation
                />
              {:else}
                <span class="node-name">{node.name}</span>
                <div class="folder-actions">
                  <button type="button" class="action-btn" title="新建文件" on:click={(e) => startCreating(node.path, 'file', e)}>
                    <FilePlus size={12} />
                  </button>
                  <button type="button" class="action-btn" title="新建文件夹" on:click={(e) => startCreating(node.path, 'folder', e)}>
                    <FolderPlus size={12} />
                  </button>
                </div>
              {/if}
            </div>
            {#if creatingParentPath === node.path}
              <div class="tree-creating" style="padding-left: {34 + depth * 12}px">
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
            {#if isExpanded && node.children && node.children.length > 0}
              {@render renderTree(node.children, depth + 1)}
            {/if}
          </div>
        {:else}
          <button
            type="button"
            class="tree-file"
            class:active={nativePath === node.path}
            class:preview={previewNativePath === node.path}
            style="padding-left: {34 + depth * 12}px"
            title={node.path}
            on:click={() => handleFileClick(node.path)}
            on:dblclick={() => handleFileDblClick(node.path)}
          >
            <FileText size={13} />
            <span>{node.name}</span>
            {#if nativePath === node.path}
              <small>{dirty ? '未保存' : '已同步'}</small>
            {/if}
          </button>
        {/if}
      {/each}
    {/snippet}

    <div class="tree-root">
      {#if currentFolderPath}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div
          role="button"
          tabindex="0"
          class="tree-folder-root-title"
          class:collapsed={!rootFolderExpanded}
          title={currentFolderPath}
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
          <span class="node-name">{getFolderName(currentFolderPath)}</span>
          <div class="folder-actions">
            <button type="button" class="action-btn" title="新建文件" on:click={(e) => startCreating(currentFolderPath, 'file', e)}>
              <FilePlus size={12} />
            </button>
            <button type="button" class="action-btn" title="新建文件夹" on:click={(e) => startCreating(currentFolderPath, 'folder', e)}>
              <FolderPlus size={12} />
            </button>
          </div>
        </div>

        {#if creatingParentPath === currentFolderPath}
          <div class="tree-creating" style="padding-left: 34px">
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
          <div class="recent-tree recursive-tree-container">
            {@render renderTree(folderTree, 1)}
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
          <button type="button" class="tree-file active" title={filePath}>
            <FileText size={13} />
            <span>{fileName}</span>
            <small>{dirty ? '未保存' : '已同步'}</small>
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
