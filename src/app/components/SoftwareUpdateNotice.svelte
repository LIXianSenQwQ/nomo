<script lang="ts">
  import { Download, X } from '@lucide/svelte';
  import { onDestroy, onMount } from 'svelte';
  import { t } from '../i18n';

  export let version: string;
  export let summary: string;
  export let onView: () => void;
  export let onLater: () => void;
  export let onDismiss: () => void;
  export let onAutoHide: () => void;

  let hideTimer: number | null = null;

  onMount(scheduleAutoHide);
  onDestroy(clearAutoHide);

  function scheduleAutoHide() {
    clearAutoHide();
    hideTimer = window.setTimeout(onAutoHide, 12_000);
  }

  function clearAutoHide() {
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  }
</script>

<aside
  class="software-update-notice"
  aria-live="polite"
  on:mouseenter={clearAutoHide}
  on:mouseleave={scheduleAutoHide}
  on:focusin={clearAutoHide}
  on:focusout={scheduleAutoHide}
>
  <div class="notice-accent"></div>
  <div class="notice-body">
    <div class="notice-icon" aria-hidden="true">
      <Download size={21} />
    </div>
    <div class="notice-copy">
      <div class="notice-kicker">
        <span>{t.updateCheck()}</span>
        <span class="version-chip">v{version}</span>
      </div>
      <h2>{t.softwareUpdateNoticeTitle()}</h2>
      <p>{summary}</p>
    </div>
    <button
      class="notice-close"
      type="button"
      title={t.softwareUpdateDismissVersion()}
      aria-label={t.softwareUpdateDismissVersion()}
      on:click={onDismiss}
    >
      <X size={15} />
    </button>
  </div>
  <div class="notice-actions">
    <button class="button quiet" type="button" on:click={onLater}>
      {t.softwareUpdateRemindLater()}
    </button>
    <button class="button primary" type="button" on:click={onView}>
      {t.softwareUpdateViewDetails()}
    </button>
  </div>
</aside>

<style>
  .software-update-notice {
    position: fixed;
    z-index: 120;
    right: 22px;
    bottom: 44px;
    width: min(390px, calc(100vw - 28px));
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--md-editor-border) 72%, var(--md-editor-accent) 28%);
    border-radius: 12px;
    background: var(--md-editor-surface);
    color: var(--md-editor-fg);
    box-shadow:
      0 22px 50px rgba(23, 34, 44, 0.14),
      0 4px 14px rgba(23, 34, 44, 0.08);
    animation: notice-in 220ms cubic-bezier(0.2, 0.85, 0.35, 1);
    -webkit-user-select: none;
    user-select: none;
  }

  .notice-accent {
    height: 3px;
    background: var(--md-editor-accent);
  }

  .notice-body {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto;
    gap: 12px;
    padding: 16px 16px 13px;
  }

  .notice-icon {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: var(--md-editor-sidebar-active);
    color: var(--md-editor-accent-strong);
  }

  .notice-copy {
    min-width: 0;
  }

  .notice-kicker {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    color: var(--md-editor-muted-fg);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .version-chip {
    padding: 2px 6px;
    border-radius: 999px;
    background: var(--md-editor-sidebar-active);
    color: var(--md-editor-accent-strong);
    font-family: var(--md-editor-font-mono);
    font-size: 10px;
    letter-spacing: 0;
  }

  h2 {
    margin: 0;
    color: var(--md-editor-heading-fg);
    font-size: 15px;
    font-weight: 700;
  }

  p {
    display: -webkit-box;
    overflow: hidden;
    margin: 6px 0 0;
    color: var(--md-editor-muted-fg);
    font-size: 12px;
    line-height: 1.55;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .notice-close {
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--md-editor-muted-fg);
    cursor: pointer;
  }

  .notice-close:hover {
    background: var(--md-editor-rail);
    color: var(--md-editor-fg);
  }

  .notice-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 16px 14px;
  }

  .button {
    min-height: 32px;
    padding: 0 13px;
    border: 1px solid var(--md-editor-border);
    border-radius: 7px;
    background: var(--md-editor-surface);
    color: var(--md-editor-fg);
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
  }

  .button:hover {
    border-color: color-mix(in srgb, var(--md-editor-border) 64%, var(--md-editor-fg));
    background: var(--md-editor-rail);
  }

  .button.quiet {
    border-color: transparent;
    background: transparent;
    color: var(--md-editor-muted-fg);
  }

  .button.primary {
    border-color: var(--md-editor-accent-fill);
    background: var(--md-editor-accent-fill);
    color: var(--md-editor-on-accent);
  }

  .button.primary:hover {
    border-color: var(--md-editor-accent-strong);
    background: color-mix(in srgb, var(--md-editor-accent-fill) 86%, #000000);
  }

  button:focus-visible {
    outline: 2px solid var(--md-editor-accent);
    outline-offset: 2px;
  }

  @keyframes notice-in {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 520px) {
    .software-update-notice {
      right: 14px;
      bottom: 38px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .software-update-notice {
      animation: none;
    }
  }
</style>
