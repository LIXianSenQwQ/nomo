import type { UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../../lib/desktop/tauriStorage';
import { logError } from '../../lib/services/logger';
import { getPlatformCapabilities } from './platform';

export interface WindowChromeMetrics {
  overlayEnabled: boolean;
  leftInset: number;
  rightInset: number;
  captionHeight: number;
}

const WINDOW_CHROME_CHANGED_EVENT = 'nomo://window-chrome-changed';
const PENDING_WINDOW_CHROME: WindowChromeMetrics = {
  overlayEnabled: true,
  leftInset: 0,
  rightInset: 150,
  captionHeight: 42,
};

/**
 * 同步 Windows 原生标题栏覆盖区尺寸；查询完成前保留原生按钮安全区。
 */
export function installWindowChromeState(): () => void {
  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    !isTauriRuntime() ||
    !getPlatformCapabilities().usesWindowsNativeOverlay
  ) {
    return () => undefined;
  }

  const root = document.documentElement;
  let disposed = false;
  let queryRevision = 0;
  let refreshFrame: number | null = null;
  const unlisteners: UnlistenFn[] = [];

  applyWindowChromeMetrics(root, PENDING_WINDOW_CHROME, 'windows-native-overlay-pending');

  const reportFailure = (operation: string, error: unknown) => {
    if (disposed) {
      return;
    }
    logError('WindowChrome', `Failed to ${operation}.`, {
      error: error instanceof Error ? error.message : String(error),
    });
  };

  void (async () => {
    try {
      const [{ invoke }, { getCurrentWindow }] = await Promise.all([
        import('@tauri-apps/api/core'),
        import('@tauri-apps/api/window'),
      ]);
      if (disposed) {
        return;
      }

      const appWindow = getCurrentWindow();

      const queryAndApplyMetrics = async () => {
        const currentQuery = ++queryRevision;
        try {
          const payload = await invoke<unknown>('get_window_chrome_metrics');
          if (disposed || currentQuery !== queryRevision) {
            return;
          }
          const metrics = normalizeWindowChromeMetrics(payload);
          if (!metrics) {
            reportFailure('apply native window chrome metrics', 'invalid payload');
            return;
          }
          applyWindowChromeMetrics(
            root,
            metrics,
            metrics.overlayEnabled ? 'windows-native-overlay' : 'windows-standard',
          );
        } catch (error) {
          if (!disposed && currentQuery === queryRevision) {
            reportFailure('query the native window chrome metrics', error);
          }
        }
      };

      const scheduleMetricsRefresh = () => {
        if (disposed) {
          return;
        }
        if (refreshFrame !== null) {
          return;
        }
        refreshFrame = window.requestAnimationFrame(() => {
          refreshFrame = null;
          void queryAndApplyMetrics();
        });
      };

      const registerListener = async (
        listener: Promise<UnlistenFn>,
        operation: string,
      ): Promise<void> => {
        try {
          const unlisten = await listener;
          if (disposed) {
            unlisten();
            return;
          }
          unlisteners.push(unlisten);
        } catch (error) {
          reportFailure(operation, error);
        }
      };

      const listenersReady = Promise.all([
        registerListener(
          appWindow.listen(WINDOW_CHROME_CHANGED_EVENT, scheduleMetricsRefresh),
          'listen for native window chrome changes',
        ),
        registerListener(
          appWindow.onResized(scheduleMetricsRefresh),
          'listen for native window resize changes',
        ),
        registerListener(
          appWindow.onScaleChanged(scheduleMetricsRefresh),
          'listen for native window scale changes',
        ),
      ]);

      await listenersReady;
      if (disposed) {
        return;
      }
      scheduleMetricsRefresh();
    } catch (error) {
      reportFailure('initialize the native window chrome state', error);
    }
  })();

  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    queryRevision += 1;
    if (refreshFrame !== null) {
      window.cancelAnimationFrame(refreshFrame);
      refreshFrame = null;
    }
    for (const unlisten of unlisteners.splice(0)) {
      unlisten();
    }
    delete root.dataset.windowChrome;
    root.style.removeProperty('--md-window-chrome-left-inset');
    root.style.removeProperty('--md-window-chrome-right-inset');
    root.style.removeProperty('--md-window-chrome-caption-height');
  };
}

function normalizeWindowChromeMetrics(value: unknown): WindowChromeMetrics | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<WindowChromeMetrics>;
  if (
    typeof candidate.overlayEnabled !== 'boolean' ||
    !isFiniteNumber(candidate.leftInset) ||
    !isFiniteNumber(candidate.rightInset) ||
    !isFiniteNumber(candidate.captionHeight)
  ) {
    return null;
  }

  const captionHeight = Math.max(0, candidate.captionHeight);
  if (candidate.overlayEnabled && captionHeight === 0) {
    return null;
  }
  return {
    overlayEnabled: candidate.overlayEnabled,
    leftInset: Math.max(0, candidate.leftInset),
    rightInset: Math.max(0, candidate.rightInset),
    captionHeight,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function applyWindowChromeMetrics(
  root: HTMLElement,
  metrics: WindowChromeMetrics,
  state: 'windows-native-overlay' | 'windows-native-overlay-pending' | 'windows-standard',
): void {
  root.dataset.windowChrome = state;
  root.style.setProperty('--md-window-chrome-left-inset', `${metrics.leftInset}px`);
  root.style.setProperty('--md-window-chrome-right-inset', `${metrics.rightInset}px`);
  root.style.setProperty('--md-window-chrome-caption-height', `${metrics.captionHeight}px`);
}
