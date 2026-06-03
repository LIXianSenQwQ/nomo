<script lang="ts">
  import { FileText, X } from '@lucide/svelte';
  import type { Tab } from '../types';

  export let tabs: Tab[];
  export let activeTabId: string;
  export let switchTab: (tabId: string) => void;
  export let closeTab: (tabId: string, event?: Event) => void;
  export let createNewFile: () => void;
</script>

<header class="topbar" aria-label="文档标签">
  <div class="tabs-container">
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
  </div>
  <div class="tab-actions" aria-label="标签页操作">
    <button
      type="button"
      class="tab-add"
      title="新建文件"
      aria-label="新建文件"
      on:click={createNewFile}>+</button
    >
  </div>
</header>
