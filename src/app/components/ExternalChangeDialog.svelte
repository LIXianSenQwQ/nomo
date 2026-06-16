<script lang="ts">
  import { fade } from 'svelte/transition';
  import { AlertTriangle, Download, Upload, X } from '@lucide/svelte';
  import { motionIn } from '../actions/motion';
  import { t } from '../i18n';
  import type { ExternalFileChangeState } from '../types';

  export let open: boolean;
  export let change: ExternalFileChangeState | null = null;

  export let onReload: () => void;
  export let onOverwrite: () => void;
  export let onDismiss: () => void;

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onDismiss();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open && change}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="backdrop" transition:fade={{ duration: 120 }} on:click={onDismiss}>
    <div
      class="dialog"
      role="alertdialog"
      aria-modal="true"
      tabindex="-1"
      use:motionIn={{ kind: 'popover', y: 0, scale: 0.98 }}
      on:click|stopPropagation
    >
      <div class="header">
        <span class="icon" aria-hidden="true">
          <AlertTriangle size={18} />
        </span>
        <div>
          <h2 class="title">{t.externalFileChanged()}</h2>
          <p class="description">{change.message}</p>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn reload" on:click={onReload}>
          <Download size={15} />
          {t.reloadExternalShort()}
        </button>
        <button type="button" class="btn overwrite" on:click={onOverwrite}>
          <Upload size={15} />
          {t.overwriteExternalShort()}
        </button>
        <button type="button" class="btn cancel" on:click={onDismiss}>
          <X size={15} />
          {t.ignoreExternalChange()}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.34);
    backdrop-filter: blur(2px);
  }

  .dialog {
    width: 460px;
    max-width: calc(100% - 32px);
    padding: 18px;
    color: var(--md-editor-fg);
    background: var(--md-editor-bg);
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-md);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.22);
  }

  .header {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--md-editor-radius-sm);
    color: var(--md-editor-warning, #d97706);
    background: color-mix(in srgb, var(--md-editor-warning, #d97706) 12%, transparent);
  }

  .title {
    margin: 1px 0 4px;
    color: var(--md-editor-heading-fg);
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
  }

  .description {
    margin: 0;
    color: var(--md-editor-muted-fg);
    font-size: 12.5px;
    line-height: 1.5;
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 18px;
  }

  .btn {
    min-width: 0;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 10px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-sm);
    color: var(--md-editor-fg);
    background: var(--md-editor-surface);
    font: inherit;
    font-size: 12.5px;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color 140ms ease,
      border-color 140ms ease,
      color 140ms ease;
  }

  .btn:hover {
    border-color: color-mix(in srgb, var(--md-editor-fg) 18%, var(--md-editor-border));
    background: color-mix(in srgb, var(--md-editor-fg) 6%, var(--md-editor-surface));
  }

  .btn.cancel {
    background: transparent;
  }

  .btn.cancel:hover {
    background: color-mix(in srgb, var(--md-editor-fg) 5%, transparent);
  }

  .btn.reload {
    border-color: color-mix(in srgb, var(--md-editor-accent) 42%, var(--md-editor-border));
    color: var(--md-editor-accent-strong, var(--md-editor-accent));
    background: color-mix(in srgb, var(--md-editor-accent) 10%, var(--md-editor-surface));
  }

  .btn.reload:hover {
    border-color: var(--md-editor-accent);
    background: color-mix(in srgb, var(--md-editor-accent) 16%, var(--md-editor-surface));
  }

  .btn.overwrite {
    background: var(--md-editor-danger);
    border-color: var(--md-editor-danger);
    color: #fff;
  }

  .btn.overwrite:hover {
    opacity: 0.88;
  }

  .btn:focus-visible {
    outline: 2px solid var(--md-editor-accent);
    outline-offset: 2px;
  }

  @media (max-width: 500px) {
    .actions {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
