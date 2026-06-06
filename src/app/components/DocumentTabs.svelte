<script lang="ts">
  import { FileText, Plus, X } from '@lucide/svelte';
  import { onMount, tick } from 'svelte';
  import type { Tab } from '../types';

  export let tabs: Tab[];
  export let activeTabId: string;
  export let switchTab: (tabId: string) => void;
  export let closeTab: (tabId: string, event?: Event) => void;
  export let createNewFile: () => void;

  const addButtonWidth = 32;
  let tabsContainer: HTMLDivElement;
  let showAddButton = true;
  let resizeObserver: ResizeObserver | null = null;
  let measureQueued = false;

  function queueMeasureTabs() {
    if (measureQueued) return;
    measureQueued = true;

    requestAnimationFrame(() => {
      measureQueued = false;
      updateAddButtonVisibility();
    });
  }

  function updateAddButtonVisibility() {
    if (!tabsContainer) return;

    const tabsWidth = Array.from(tabsContainer.querySelectorAll<HTMLElement>('.doc-tab')).reduce(
      (total, tab) => total + tab.getBoundingClientRect().width,
      0,
    );
    showAddButton = tabsWidth + addButtonWidth <= tabsContainer.clientWidth + 1;
  }

  $: {
    tabs;
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

<header class="topbar" aria-label="文档标签">
  <div class="tabs-container" bind:this={tabsContainer}>
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        class="doc-tab"
        class:active={activeTabId === tab.id}
        title={tab.filePath}
        on:click={() => switchTab(tab.id)}
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
    {#if showAddButton}
      <button type="button" class="tab-add" title="新建文件" aria-label="新建文件" on:click={createNewFile}>
        <Plus size={16} />
      </button>
    {/if}
  </div>
</header>
