<script lang="ts">
  import { X } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';

  export let isOpen: boolean;
  export let currentWorkspaceDir: string;
  export let closeSettings: () => void;
  export let saveSettings: (newWorkspaceDir: string) => void;

  let selectedDir: string = currentWorkspaceDir;

  // Whenever the drawer opens, reset the selected path to the current one
  $: if (isOpen) {
    selectedDir = currentWorkspaceDir;
  }

  async function browseFolder() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        directory: true,
        multiple: false,
        defaultPath: selectedDir,
      });
      if (result && typeof result === 'string') {
        selectedDir = result;
      }
    } catch (err) {
      console.error('Failed to open folder dialog:', err);
    }
  }

  function handleSave() {
    saveSettings(selectedDir);
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="settings-backdrop" transition:fade={{ duration: 200 }} on:click={closeSettings}>
    <div
      class="settings-drawer"
      transition:slide={{ axis: 'x', duration: 300 }}
      on:click|stopPropagation
    >
      <header class="drawer-header">
        <button type="button" class="icon-btn exit-btn" on:click={closeSettings} title="关闭设置">
          <X size={18} />
        </button>
        <h2>偏好设置</h2>
      </header>

      <div class="drawer-body">
        <div class="setting-group">
          <label for="workspaceDir">工作区存储路径</label>
          <div class="path-picker">
            <input
              id="workspaceDir"
              type="text"
              class="path-input"
              value={selectedDir}
              readonly
            />
            <button type="button" class="browse-btn" on:click={browseFolder}>
              浏览...
            </button>
          </div>
          <p class="setting-desc">这是存放所有 Markdown 文件和分组的根目录。</p>
        </div>
      </div>

      <footer class="drawer-footer">
        <button type="button" class="save-btn" on:click={handleSave}>
          保存
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .settings-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
    z-index: 9999;
    display: flex;
    justify-content: flex-end;
  }

  .settings-drawer {
    width: 400px;
    max-width: 100%;
    height: 100%;
    background: var(--md-editor-bg);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--md-editor-border);
  }

  .drawer-header {
    display: flex;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--md-editor-border);
    gap: 12px;
  }

  .drawer-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--md-editor-fg);
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    border-radius: var(--md-editor-radius);
    color: var(--md-editor-muted-fg);
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: var(--md-editor-surface);
    color: var(--md-editor-fg);
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 16px;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setting-group label {
    font-size: 14px;
    font-weight: 500;
    color: var(--md-editor-fg);
  }

  .path-picker {
    display: flex;
    gap: 8px;
  }

  .path-input {
    flex: 1;
    min-width: 0;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-surface);
    color: var(--md-editor-fg);
    font-family: inherit;
    font-size: 13px;
    outline: none;
  }

  .browse-btn {
    height: 32px;
    padding: 0 16px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-bg);
    color: var(--md-editor-fg);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .browse-btn:hover {
    background: var(--md-editor-surface);
  }

  .setting-desc {
    margin: 0;
    font-size: 12px;
    color: var(--md-editor-muted-fg);
  }

  .drawer-footer {
    padding: 16px;
    border-top: 1px solid var(--md-editor-border);
    display: flex;
    justify-content: flex-end;
  }

  .save-btn {
    height: 36px;
    padding: 0 24px;
    border: none;
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-accent);
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .save-btn:hover {
    opacity: 0.9;
  }
</style>
