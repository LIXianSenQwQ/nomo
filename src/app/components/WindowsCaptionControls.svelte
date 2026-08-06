<script lang="ts">
  import { ArrowDownLeft } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { t } from '../i18n';
  import { logError } from '../../lib/services/logger';

  export let variant: 'full' | 'return' = 'full';
  export let onClose: () => void | Promise<void>;

  const MAXIMIZED_STATE_SYNC_DELAY_MS = 80;

  let appWindow: import('@tauri-apps/api/window').Window | null = null;
  let unlistenResized: (() => void) | null = null;
  let maximizedStateSyncTimer: number | null = null;
  let maximizedStateRequestId = 0;
  let windowReady = false;
  let isMaximized = false;
  let windowActionPending = false;
  let closePending = false;
  let disposed = false;

  onMount(() => {
    disposed = false;
    if (variant === 'full') {
      void initializeWindowState();
    }

    return () => {
      disposed = true;
      maximizedStateRequestId += 1;
      windowReady = false;
      appWindow = null;
      if (maximizedStateSyncTimer !== null) {
        window.clearTimeout(maximizedStateSyncTimer);
        maximizedStateSyncTimer = null;
      }
      unlistenResized?.();
      unlistenResized = null;
    };
  });

  async function initializeWindowState() {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      if (disposed) return;

      const currentWindow = getCurrentWindow();
      appWindow = currentWindow;
      let unlisten: (() => void) | null = null;
      try {
        unlisten = await currentWindow.onResized(syncMaximizedState);
      } catch (error) {
        reportWindowActionError('监听窗口尺寸变化', error);
      }
      if (disposed) {
        unlisten?.();
        return;
      }
      unlistenResized = unlisten;
      await syncMaximizedState();
      if (!disposed && appWindow === currentWindow) {
        windowReady = true;
      }
    } catch (error) {
      reportWindowActionError('初始化自绘窗口按钮', error);
    }
  }

  function scheduleMaximizedStateSync() {
    if (disposed || variant !== 'full') return;
    if (maximizedStateSyncTimer !== null) {
      window.clearTimeout(maximizedStateSyncTimer);
    }
    maximizedStateSyncTimer = window.setTimeout(() => {
      maximizedStateSyncTimer = null;
      void syncMaximizedState();
    }, MAXIMIZED_STATE_SYNC_DELAY_MS);
  }

  async function syncMaximizedState(resizedEvent?: unknown) {
    // Tauri resize 回调会传入事件；直接调用不带参数，用于立即读取最新状态。
    if (resizedEvent !== undefined) {
      scheduleMaximizedStateSync();
      return;
    }
    const currentWindow = appWindow;
    if (!currentWindow || disposed) return;
    const requestId = ++maximizedStateRequestId;

    try {
      const maximized = await currentWindow.isMaximized();
      if (!disposed && appWindow === currentWindow && requestId === maximizedStateRequestId) {
        isMaximized = maximized;
      }
    } catch (error) {
      reportWindowActionError('读取窗口最大化状态', error);
    }
  }

  async function minimizeWindow() {
    const currentWindow = appWindow;
    if (!currentWindow || windowActionPending) return;

    windowActionPending = true;
    try {
      await currentWindow.minimize();
    } catch (error) {
      reportWindowActionError('最小化窗口', error);
    } finally {
      if (!disposed) windowActionPending = false;
    }
  }

  async function toggleMaximizeWindow(event: MouseEvent) {
    if (event.detail > 1) return;
    const currentWindow = appWindow;
    if (!currentWindow || windowActionPending) return;

    windowActionPending = true;
    try {
      await currentWindow.toggleMaximize();
      await syncMaximizedState();
    } catch (error) {
      reportWindowActionError('切换窗口最大化状态', error);
    } finally {
      if (!disposed) windowActionPending = false;
    }
  }

  async function requestClose() {
    if (closePending) return;

    closePending = true;
    try {
      await onClose();
    } catch (error) {
      reportWindowActionError(variant === 'return' ? '返回主窗口' : '关闭窗口', error);
    } finally {
      if (!disposed) closePending = false;
    }
  }

  function reportWindowActionError(action: string, error: unknown) {
    if (disposed) return;
    logError('WindowControls', `${action}失败`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
</script>

<div
  class="windows-caption-controls"
  class:return-only={variant === 'return'}
  role="group"
  aria-label={t.windowControls()}
>
  {#if variant === 'full'}
    <button
      type="button"
      class="caption-control"
      title={t.minimizeWindow()}
      aria-label={t.minimizeWindow()}
      disabled={!windowReady || windowActionPending}
      on:mousedown|stopPropagation
      on:dblclick|stopPropagation
      on:click={minimizeWindow}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4.5 10.5h11" />
      </svg>
    </button>
    <button
      type="button"
      class="caption-control"
      title={isMaximized ? t.restoreWindow() : t.maximizeWindow()}
      aria-label={isMaximized ? t.restoreWindow() : t.maximizeWindow()}
      disabled={!windowReady || windowActionPending}
      on:mousedown|stopPropagation
      on:dblclick|stopPropagation
      on:click={toggleMaximizeWindow}
    >
      {#if isMaximized}
        <svg class="restore-icon" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M6.5 5.5h8v8h-8z" />
          <path d="M5 12V4h8" />
        </svg>
      {:else}
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="5" y="5" width="10" height="10" />
        </svg>
      {/if}
    </button>
    <button
      type="button"
      class="caption-control close-control"
      title={t.close()}
      aria-label={t.close()}
      disabled={closePending}
      on:mousedown|stopPropagation
      on:dblclick|stopPropagation
      on:click={requestClose}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="m5 5 10 10M15 5 5 15" />
      </svg>
    </button>
  {:else}
    <button
      type="button"
      class="caption-control return-control"
      title={t.markdownMiniReturn()}
      aria-label={t.markdownMiniReturn()}
      disabled={closePending}
      on:mousedown|stopPropagation
      on:dblclick|stopPropagation
      on:click={requestClose}
    >
      <ArrowDownLeft size={15} aria-hidden="true" />
    </button>
  {/if}
</div>

<style>
  .windows-caption-controls {
    display: flex;
    align-self: stretch;
    flex: 0 0 auto;
    height: 100%;
    margin-left: 0;
    color: var(--md-titlebar-fg);
    user-select: none;
  }

  .caption-control {
    width: 46px;
    min-width: 46px;
    height: 100%;
    min-height: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: default;
    transition:
      background-color 100ms ease,
      color 100ms ease;
  }

  .caption-control:hover:not(:disabled) {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }

  .caption-control:active:not(:disabled) {
    background: color-mix(in srgb, currentColor 18%, transparent);
  }

  .caption-control:focus-visible {
    outline: 2px solid var(--md-editor-accent);
    outline-offset: -2px;
  }

  .caption-control:disabled {
    opacity: 0.45;
  }

  .caption-control svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.25;
    stroke-linecap: square;
    stroke-linejoin: miter;
    pointer-events: none;
  }

  .caption-control .restore-icon {
    stroke-linejoin: round;
  }

  .close-control:hover:not(:disabled) {
    background: #c42b1c;
    color: #fff;
  }

  .close-control:active:not(:disabled) {
    background: #a3261b;
    color: #fff;
  }

  .return-only,
  .return-control {
    height: 100%;
  }

  .return-control {
    width: 34px;
    min-width: 34px;
    border-radius: var(--md-editor-radius-md);
    color: var(--md-editor-accent-strong);
  }

  .return-control :global(svg) {
    width: 15px;
    height: 15px;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
