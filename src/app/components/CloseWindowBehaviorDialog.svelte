<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Check, Info, Minus, X } from '@lucide/svelte';
  import { motionIn } from '../actions/motion';

  type CloseWindowAction = 'close-window' | 'close-to-tray';

  export let open: boolean;
  export let title: string;
  export let message: string;
  export let closeWindowLabel: string;
  export let closeToTrayLabel: string;
  export let rememberLabel: string;
  export let remember = false;

  export let onRememberChange: (remember: boolean) => void;
  export let onChoose: (behavior: CloseWindowAction) => void;
  export let onCancel: () => void;

  function handleKeydown(event: KeyboardEvent) {
    if (!open) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }

  function handleRememberChange(event: Event) {
    onRememberChange((event.currentTarget as HTMLInputElement).checked);
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="close-choice-backdrop" transition:fade={{ duration: 120 }} on:click={onCancel}>
    <div
      class="close-choice-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-choice-title"
      tabindex="-1"
      use:motionIn={{ kind: 'popover', y: 0, scale: 0.98 }}
      on:click|stopPropagation
    >
      <div class="close-choice-header">
        <span class="close-choice-icon" aria-hidden="true">
          <Info size={18} />
        </span>
        <div>
          <h2 id="close-choice-title">{title}</h2>
          <p>{message}</p>
        </div>
      </div>

      <div class="close-choice-actions">
        <button type="button" class="choice-button" on:click={() => onChoose('close-window')}>
          <X size={15} />
          <span>{closeWindowLabel}</span>
        </button>
        <button
          type="button"
          class="choice-button primary"
          on:click={() => onChoose('close-to-tray')}
        >
          <Minus size={15} />
          <span>{closeToTrayLabel}</span>
        </button>
      </div>

      <label class="remember-choice">
        <input type="checkbox" checked={remember} on:change={handleRememberChange} />
        <span class="remember-box" aria-hidden="true">
          {#if remember}
            <Check size={12} />
          {/if}
        </span>
        <span>{rememberLabel}</span>
      </label>
    </div>
  </div>
{/if}

<style>
  .close-choice-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.34);
    backdrop-filter: blur(2px);
  }

  .close-choice-dialog {
    width: 392px;
    max-width: calc(100% - 32px);
    padding: 18px;
    color: var(--md-editor-fg);
    background: var(--md-editor-bg);
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-md);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.22);
  }

  .close-choice-header {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }

  .close-choice-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--md-editor-radius-sm);
    color: var(--md-editor-accent-strong);
    background: color-mix(in srgb, var(--md-editor-accent) 12%, transparent);
  }

  h2 {
    margin: 1px 0 4px;
    color: var(--md-editor-heading-fg);
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
  }

  p {
    margin: 0;
    color: var(--md-editor-muted-fg);
    font-size: 12.5px;
    line-height: 1.5;
  }

  .close-choice-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 18px;
  }

  .choice-button {
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

  .choice-button span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .choice-button:hover {
    border-color: color-mix(in srgb, var(--md-editor-fg) 18%, var(--md-editor-border));
    background: color-mix(in srgb, var(--md-editor-fg) 6%, var(--md-editor-surface));
  }

  .choice-button.primary {
    border-color: color-mix(in srgb, var(--md-editor-accent) 42%, var(--md-editor-border));
    color: var(--md-editor-accent-strong);
    background: color-mix(in srgb, var(--md-editor-accent) 10%, var(--md-editor-surface));
  }

  .remember-choice {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    color: var(--md-editor-muted-fg);
    font-size: 12.5px;
    cursor: pointer;
    user-select: none;
  }

  .remember-choice input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .remember-box {
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid var(--md-editor-border);
    border-radius: 4px;
    color: var(--md-editor-bg);
    background: var(--md-editor-bg);
    transition:
      background-color 140ms ease,
      border-color 140ms ease;
  }

  .remember-choice input:checked + .remember-box {
    border-color: var(--md-editor-accent);
    background: var(--md-editor-accent);
  }

  .choice-button:focus-visible,
  .remember-choice input:focus-visible + .remember-box {
    outline: 2px solid var(--md-editor-accent);
    outline-offset: 2px;
  }

  @media (max-width: 460px) {
    .close-choice-actions {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
