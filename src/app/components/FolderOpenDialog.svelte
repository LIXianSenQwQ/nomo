<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';

  export let open: boolean;
  export let folderPath: string;
  export let folderName: string;

  let rememberChoice = false;
  const dispatch = createEventDispatcher<{
    choose: { choice: 'current-window' | 'new-window'; remember: boolean };
    cancel: void;
  }>();

  function choose(choice: 'current-window' | 'new-window') {
    dispatch('choose', { choice, remember: rememberChoice });
    rememberChoice = false;
  }

  function cancel() {
    dispatch('cancel');
    rememberChoice = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  }

  $: if (open) {
    rememberChoice = false;
  }
</script>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="folder-dialog-backdrop" transition:fade={{ duration: 150 }} on:click={cancel}>
    <div
      class="folder-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="folder-dialog-title"
      tabindex="-1"
      on:click|stopPropagation
      on:keydown={handleKeydown}
    >
      <h3 id="folder-dialog-title">如何打开文件夹 “{folderName}”？</h3>
      <p class="folder-dialog-path">{folderPath}</p>

      <div class="folder-dialog-actions">
        <button type="button" class="folder-dialog-btn" on:click={() => choose('current-window')}>
          当前窗口打开
        </button>
        <button type="button" class="folder-dialog-btn primary" on:click={() => choose('new-window')}>
          新窗口打开
        </button>
        <button type="button" class="folder-dialog-btn" on:click={cancel}> 取消 </button>
      </div>

      <label class="folder-dialog-remember">
        <input type="checkbox" bind:checked={rememberChoice} />
        <span>不再询问，并记住我的选择</span>
      </label>
    </div>
  </div>
{/if}

<style>
  .folder-dialog-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(2px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .folder-dialog {
    width: 420px;
    max-width: calc(100% - 32px);
    padding: 24px;
    background: var(--md-editor-bg);
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-md);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
    color: var(--md-editor-fg);
  }

  .folder-dialog h3 {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 600;
  }

  .folder-dialog-path {
    margin: 0 0 20px;
    font-size: 12px;
    color: var(--md-editor-muted-fg);
    word-break: break-all;
    font-family: var(--md-editor-font-mono);
  }

  .folder-dialog-actions {
    display: flex;
    gap: 10px;
  }

  .folder-dialog-btn {
    flex: 1;
    height: 36px;
    padding: 0 12px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-surface);
    color: var(--md-editor-fg);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .folder-dialog-btn:hover {
    background: var(--md-editor-hover);
  }

  .folder-dialog-btn.primary {
    background: var(--md-editor-accent);
    border-color: var(--md-editor-accent);
    color: white;
  }

  .folder-dialog-btn.primary:hover {
    opacity: 0.9;
  }

  .folder-dialog-btn:focus-visible {
    outline: 2px solid var(--md-editor-accent);
    outline-offset: 2px;
  }

  .folder-dialog-remember {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    font-size: 12px;
    color: var(--md-editor-muted-fg);
    cursor: pointer;
    user-select: none;
  }

  .folder-dialog-remember input {
    accent-color: var(--md-editor-accent);
  }
</style>