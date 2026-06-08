<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Trash2, X, AlertTriangle } from '@lucide/svelte';
  import { motionIn } from '../actions/motion';
  import { t } from '../i18n';

  export let open: boolean;
  export let title: string = t.confirmDelete();
  export let message: string = '';
  export let detail: string = '';
  export let confirmLabel: string = t.delete();
  export let danger: boolean = true;

  export let onConfirm: () => void;
  export let onCancel: () => void;

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onConfirm();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="confirm-backdrop" transition:fade={{ duration: 120 }} on:click={onCancel}>
    <div
      class="confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      tabindex="-1"
      use:motionIn={{ kind: 'popover', y: 0, scale: 0.98 }}
      on:click|stopPropagation
      on:keydown={handleKeydown}
    >
      <div class="confirm-header" class:danger>
        <span class="confirm-icon">
          {#if danger}
            <AlertTriangle size={20} />
          {:else}
            <Trash2 size={18} />
          {/if}
        </span>
        <span class="confirm-title">{title}</span>
      </div>

      <div class="confirm-body">
        <p class="confirm-message">{message}</p>
        {#if detail}
          <p class="confirm-detail">{detail}</p>
        {/if}
      </div>

      <div class="confirm-actions">
        <button type="button" class="confirm-btn cancel" on:click={onCancel}>
          <X size={14} />
          {t.cancel()}
        </button>
        <button type="button" class="confirm-btn" class:danger on:click={onConfirm}>
          <Trash2 size={14} />
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .confirm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .confirm-dialog {
    width: 380px;
    max-width: calc(100% - 32px);
    padding: 0;
    background: var(--md-editor-bg);
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-md);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.22);
    color: var(--md-editor-fg);
    overflow: hidden;
  }

  .confirm-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--md-editor-border);
  }

  .confirm-header.danger {
    border-bottom-color: color-mix(in srgb, var(--md-editor-danger) 25%, var(--md-editor-border));
  }

  .confirm-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--md-editor-radius-sm);
    background: color-mix(in srgb, var(--md-editor-danger) 10%, transparent);
    color: var(--md-editor-danger);
    flex-shrink: 0;
  }

  .confirm-title {
    font-size: 14.5px;
    font-weight: 600;
    color: var(--md-editor-heading-fg);
  }

  .confirm-body {
    padding: 16px 20px;
  }

  .confirm-message {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--md-editor-fg);
  }

  .confirm-detail {
    margin: 8px 0 0;
    padding: 8px 10px;
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-surface);
    border: 1px solid var(--md-editor-border);
    font-size: 12px;
    font-family: var(--md-editor-font-mono);
    color: var(--md-editor-muted-fg);
    word-break: break-all;
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 12px 20px 16px;
    border-top: 1px solid var(--md-editor-border);
  }

  .confirm-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 14px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-surface);
    color: var(--md-editor-fg);
    font-size: 12.5px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .confirm-btn:hover {
    background: color-mix(in srgb, var(--md-editor-fg) 6%, var(--md-editor-surface));
    border-color: color-mix(in srgb, var(--md-editor-fg) 20%, var(--md-editor-border));
  }

  .confirm-btn.danger {
    background: var(--md-editor-danger);
    border-color: var(--md-editor-danger);
    color: #fff;
  }

  .confirm-btn.danger:hover {
    opacity: 0.88;
  }

  .confirm-btn.cancel {
    background: transparent;
  }

  .confirm-btn.cancel:hover {
    background: color-mix(in srgb, var(--md-editor-fg) 5%, transparent);
  }

  .confirm-btn:focus-visible {
    outline: 2px solid var(--md-editor-accent);
    outline-offset: 2px;
  }
</style>
