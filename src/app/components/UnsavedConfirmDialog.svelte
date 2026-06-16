<script lang="ts">
  import { fade } from 'svelte/transition';
  import { X, AlertTriangle, Save } from '@lucide/svelte';
  import { motionIn } from '../actions/motion';
  import { t } from '../i18n';

  export let open: boolean;
  export let title: string = '';
  export let message: string = '';
  export let confirmLabel: string = t.discardChanges();
  export let cancelLabel: string = t.cancel();
  /** 传入 saveLabel 时显示"保存"按钮（三按钮模式） */
  export let saveLabel: string = '';

  export let onConfirm: () => void;
  export let onCancel: () => void;
  export let onSave: (() => void) | null = null;

  $: hasSave = saveLabel.length > 0;

  function handleKeydown(event: KeyboardEvent) {
    if (!open) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="backdrop" transition:fade={{ duration: 120 }} on:click={onCancel}>
    <div
      class="dialog"
      role="alertdialog"
      aria-modal="true"
      tabindex="-1"
      use:motionIn={{ kind: 'popover', y: 0, scale: 0.98 }}
      on:click|stopPropagation
    >
      <!-- 头部：图标 + 标题 + 描述（与 CloseWindowBehaviorDialog 结构一致） -->
      <div class="header">
        <span class="icon" aria-hidden="true">
          <AlertTriangle size={18} />
        </span>
        <div>
          <h2 class="title">{title}</h2>
          <p class="description">{message}</p>
        </div>
      </div>

      <!-- 按钮区 -->
      <div class="actions" class:has-save={hasSave}>
        {#if hasSave}
          <button type="button" class="btn save" on:click={onSave!}>
            <Save size={15} />
            {saveLabel}
          </button>
        {/if}
        <button type="button" class="btn discard" on:click={onConfirm}>
          <AlertTriangle size={15} />
          {confirmLabel}
        </button>
        <button type="button" class="btn cancel" on:click={onCancel}>
          <X size={15} />
          {cancelLabel}
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
    width: 392px;
    max-width: calc(100% - 32px);
    padding: 18px;
    color: var(--md-editor-fg);
    background: var(--md-editor-bg);
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-md);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.22);
  }

  /* ---- 头部 (对齐 CloseWindowBehaviorDialog) ---- */
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

  /* ---- 按钮区 (对齐 CloseWindowBehaviorDialog 的 choice-button) ---- */
  .actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 18px;
  }

  /* 三按钮模式：一行三列 */
  .actions.has-save {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .btn {
    min-width: 0;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 12px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-sm);
    color: var(--md-editor-fg);
    background: var(--md-editor-surface);
    font: inherit;
    font-size: 12.5px;
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

  .btn.discard {
    background: var(--md-editor-warning, #d97706);
    border-color: var(--md-editor-warning, #d97706);
    color: #fff;
  }

  .btn.discard:hover {
    opacity: 0.88;
  }

  .btn.save {
    border-color: color-mix(in srgb, var(--md-editor-accent) 42%, var(--md-editor-border));
    color: var(--md-editor-accent-strong, var(--md-editor-accent));
    background: color-mix(in srgb, var(--md-editor-accent) 10%, var(--md-editor-surface));
  }

  .btn.save:hover {
    border-color: var(--md-editor-accent);
    background: color-mix(in srgb, var(--md-editor-accent) 16%, var(--md-editor-surface));
  }

  .btn:focus-visible {
    outline: 2px solid var(--md-editor-accent);
    outline-offset: 2px;
  }

  @media (max-width: 460px) {
    .actions,
    .actions.has-save {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
