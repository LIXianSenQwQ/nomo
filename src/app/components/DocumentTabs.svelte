<script lang="ts">
  import { ChevronDown, FileText, Plus, X } from '@lucide/svelte';
  import { onMount, tick } from 'svelte';
  import type { Tab } from '../types';

  export let tabs: Tab[];
  export let activeTabId: string;
  export let previewTabId: string | null = null;
  export let switchTab: (tabId: string) => void;
  export let closeTab: (tabId: string, event?: Event) => void;
  export let pinPreviewTab: () => void;
  export let createNewFile: () => void;
  export let currentFolderPath: string = '';

  const dropdownButtonWidth = 28;

  // 将绝对路径转为相对于当前工作目录的路径，用于 tooltip 显示
  function getRelativeDisplayPath(filePath: string, basePath: string): string {
    if (!basePath || !filePath) return filePath;
    const normalizedFile = filePath.replace(/\\/g, '/');
    const normalizedBase = basePath.replace(/\\/g, '/').replace(/\/+$/, '');
    if (normalizedFile.startsWith(normalizedBase + '/')) {
      return normalizedFile.slice(normalizedBase.length + 1);
    }
    return filePath;
  }
  let tabsContainer: HTMLDivElement;
  let measureArea: HTMLDivElement;
  let dropdownBtnEl: HTMLButtonElement;
  let showAddButton = true;
  let overflowState = false; // 是否有标签溢出（由测量函数控制）
  let showDropdown = false; // 下拉菜单是否展开（由用户点击控制）
  let hiddenTabs: Tab[] = [];
  let visibleRange = { start: 0, end: 0 };
  let resizeObserver: ResizeObserver | null = null;
  let measureQueued = false;
  let dropdownMenuStyle = '';

  $: hiddenTabs = tabs.filter((_, i) => i < visibleRange.start || i >= visibleRange.end);

  function queueMeasureTabs() {
    if (measureQueued) return;
    measureQueued = true;

    requestAnimationFrame(() => {
      measureQueued = false;
      measureAndComputeVisible();
    });
  }

  // 测量所有标签宽度并计算可见范围
  // 策略：从右到左依次计算能放下的标签（优先显示新标签），如果激活标签不在范围内则平移窗口
  function measureAndComputeVisible() {
    if (!tabsContainer || !measureArea) return;

    const measured = measureArea.querySelectorAll<HTMLElement>('.doc-tab');
    const widths: number[] = [];
    measured.forEach((el) => widths.push(el.getBoundingClientRect().width));

    const available = tabsContainer.clientWidth;
    const reserveWidth = dropdownButtonWidth + 4;

    // 从右到左累加，优先显示右边的（最新的）标签
    let used = 0;
    let start = tabs.length;
    for (let i = tabs.length - 1; i >= 0; i--) {
      const w = widths[i] ?? 120;
      if (used + w > available - reserveWidth && start < tabs.length) break;
      used += w;
      start = i;
    }

    let end = tabs.length;
    // 如果激活标签不在可见范围内，平移窗口使其包含激活标签
    const activeIdx = tabs.findIndex((t) => t.id === activeTabId);
    if (activeIdx >= 0 && (activeIdx < start || activeIdx >= end)) {
      end = activeIdx + 1;
      used = 0;
      start = end;
      for (let i = end - 1; i >= 0; i--) {
        const w = widths[i] ?? 120;
        if (used + w > available - reserveWidth && start < end - 1) break;
        used += w;
        start = i;
      }
      // 在包含激活标签后，尽量向右扩展以充分利用空间
      used = 0;
      for (let i = start; i < end; i++) used += widths[i] ?? 120;
      while (end < tabs.length) {
        const nextW = widths[end] ?? 120;
        if (used + nextW > available - reserveWidth) break;
        used += nextW;
        end++;
      }
    }

    visibleRange = { start: Math.min(start, Math.max(0, end - 1)), end: Math.max(start + 1, end) };

    // 根据溢出状态更新按钮显示，不干预用户手动打开的下拉菜单
    const isOverflowing = !(visibleRange.start === 0 && visibleRange.end === tabs.length);
    if (isOverflowing) {
      showAddButton = false;
      overflowState = true;
    } else {
      showAddButton = true;
      overflowState = false;
      showDropdown = false;
    }
  }

  function updateDropdownPosition() {
    if (!dropdownBtnEl || !showDropdown) return;
    const rect = dropdownBtnEl.getBoundingClientRect();
    dropdownMenuStyle = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left - 172 + rect.width}px;z-index:9999;`;
  }

  function toggleDropdown(event: Event) {
    event.stopPropagation();
    showDropdown = !showDropdown;
    if (showDropdown) {
      void tick().then(updateDropdownPosition);
    }
  }

  function selectHiddenTab(tabId: string) {
    showDropdown = false;
    switchTab(tabId);
  }

  // 点击外部关闭下拉菜单
  function handleWindowClick(event: MouseEvent) {
    if (!showDropdown) return;
    const target = event.target as Node;
    // 通过 portal 渲染的下拉菜单不在原 DOM 位置，需要额外判断
    const menuEl = document.querySelector('.tab-dropdown-menu-portal');
    const btnEl = dropdownBtnEl;
    if (btnEl && (btnEl === target || btnEl.contains(target))) return;
    if (menuEl && (menuEl === target || menuEl.contains(target))) return;
    showDropdown = false;
  }

  $: {
    tabs;
    activeTabId;
    void tick().then(queueMeasureTabs);
  }

  onMount(() => {
    resizeObserver = new ResizeObserver(queueMeasureTabs);
    resizeObserver.observe(tabsContainer);
    queueMeasureTabs();

    return () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
    };
  });
</script>

<svelte:window on:click={handleWindowClick} />

<!-- 隐藏的测量区域：渲染所有标签以测量宽度 -->
<div class="tab-measure-area" bind:this={measureArea}>
  {#each tabs as tab (tab.id)}
    <button type="button" class="doc-tab" class:preview={previewTabId === tab.id} title={getRelativeDisplayPath(tab.filePath, currentFolderPath)}>
      <FileText size={13} />
      <span class="tab-title">{tab.fileName}</span>
      {#if tab.dirty}
        <span class="dirty-indicator"></span>
      {/if}
      <span class="close-tab-btn"><X size={12} /></span>
    </button>
  {/each}
</div>

<header class="topbar" aria-label="文档标签">
  <div class="tabs-container" bind:this={tabsContainer}>
    {#each tabs.slice(visibleRange.start, visibleRange.end) as tab (tab.id)}
      <button
        type="button"
        class="doc-tab"
        class:active={activeTabId === tab.id}
        class:preview={previewTabId === tab.id}
        title={getRelativeDisplayPath(tab.filePath, currentFolderPath)}
        on:click={() => switchTab(tab.id)}
        on:dblclick={() => {
          if (previewTabId === tab.id) pinPreviewTab();
        }}
      >
        <FileText size={13} />
        <span class="tab-title">{tab.fileName}</span>
        {#if tab.dirty}
          <span class="dirty-indicator" title="未保存修改"></span>
        {/if}
        <span
          class="close-tab-btn"
          role="button"
          tabindex="0"
          title="关闭标签页"
          on:click|stopPropagation={(event) => closeTab(tab.id, event)}
          on:keydown|stopPropagation={(event) => {
            if (event.key === 'Enter') closeTab(tab.id, event);
          }}
        >
          <X size={12} />
        </span>
      </button>
    {/each}
    {#if overflowState}
      <div class="tab-overflow-dropdown">
        <button
          type="button"
          class="tab-dropdown-btn"
          title="显示隐藏的标签页"
          aria-label="显示隐藏的标签页"
          bind:this={dropdownBtnEl}
          on:click={toggleDropdown}
        >
          <ChevronDown size={14} />
        </button>
      </div>
    {/if}
    {#if showAddButton}
      <button type="button" class="tab-add" title="新建文件" aria-label="新建文件" on:click={createNewFile}>
        <Plus size={16} />
      </button>
    {/if}
  </div>
</header>

<!-- Portal 下拉菜单：渲染到 body 避免被 overflow:hidden 裁剪 -->
{#if showDropdown && hiddenTabs.length > 0}
  <div class="tab-dropdown-menu tab-dropdown-menu-portal" style={dropdownMenuStyle} role="menu">
    {#each hiddenTabs as tab (tab.id)}
      <button
        type="button"
        class="tab-dropdown-item"
        class:active={activeTabId === tab.id}
        class:preview={previewTabId === tab.id}
        role="menuitem"
        title={getRelativeDisplayPath(tab.filePath, currentFolderPath)}
        on:click={() => selectHiddenTab(tab.id)}
      >
        <FileText size={13} />
        <span class="tab-dropdown-item-name">{tab.fileName}</span>
        {#if tab.dirty}
          <span class="dirty-indicator" title="未保存修改"></span>
        {/if}
      </button>
    {/each}
  </div>
{/if}
