<script lang="ts">
  import { FileText, FolderOpen } from '@lucide/svelte';
  import type { FileTreeNode } from '../types';

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
  export let startResize: (event: MouseEvent) => void;
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
            <button
              type="button"
              class="tree-folder nested-dir"
              class:collapsed={!isExpanded}
              style="padding-left: {12 + depth * 12}px"
              title={node.path}
              on:click={() => toggleFolderCollapse(node.path)}
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
              <span>{node.name}</span>
            </button>
            {#if isExpanded && node.children && node.children.length > 0}
              {@render renderTree(node.children, depth + 1)}
            {/if}
          </div>
        {:else}
          <button
            type="button"
            class="tree-file"
            class:active={nativePath === node.path}
            style="padding-left: {34 + depth * 12}px"
            title={node.path}
            on:click={() => openRecentFile(node.path)}
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
        <button
          type="button"
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
          <span>{getFolderName(currentFolderPath)}</span>
        </button>

        {#if rootFolderExpanded}
          <div class="recent-tree recursive-tree-container">
            {@render renderTree(folderTree, 1)}
          </div>
        {/if}
      {:else}
        <button
          type="button"
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
        </button>

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
