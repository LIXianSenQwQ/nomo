import { LogicalPosition } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { createPerfTimer, logError, logInfo } from '../../lib/services/logger';
import { getPlatformCapabilities } from './platform';

function getNewWindowChromeOptions() {
  const platformCapabilities = getPlatformCapabilities();

  if (platformCapabilities.isMac) {
    return {
      decorations: true,
      titleBarStyle: 'overlay' as const,
      trafficLightPosition: new LogicalPosition(16, 24),
      hiddenTitle: true,
    };
  }

  return {
    decorations: platformCapabilities.windowDecorations,
  };
}

export async function minimizeAppWindow(desktopEnabled: boolean) {
  if (!desktopEnabled) {
    return;
  }

  try {
    logInfo('DesktopWindow', '最小化窗口');
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('minimize_window');
  } catch (error) {
    logError('DesktopWindow', 'Failed to minimize window', { error: formatError(error) });
  }
}

export async function maximizeAppWindow(desktopEnabled: boolean) {
  if (!desktopEnabled) {
    return;
  }

  try {
    logInfo('DesktopWindow', '切换窗口最大化');
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('maximize_window');
  } catch (error) {
    logError('DesktopWindow', 'Failed to maximize window', { error: formatError(error) });
  }
}

export async function closeAppWindow(desktopEnabled: boolean, closeToTrayEnabled = false) {
  if (!desktopEnabled) {
    return;
  }

  try {
    logInfo('DesktopWindow', closeToTrayEnabled ? '隐藏窗口到托盘' : '关闭窗口');
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke(closeToTrayEnabled ? 'hide_window_to_tray' : 'close_window');
  } catch (error) {
    logError('DesktopWindow', 'Failed to close window', { error: formatError(error) });
  }
}

export async function exitApp(desktopEnabled: boolean) {
  if (!desktopEnabled) {
    return;
  }

  try {
    logInfo('DesktopWindow', '退出应用');
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('exit_app');
  } catch (error) {
    logError('DesktopWindow', 'Failed to exit app', { error: formatError(error) });
  }
}

export async function createAppWindow(
  desktopEnabled: boolean,
  pendingFolder?: string,
): Promise<string | undefined> {
  if (!desktopEnabled) {
    return undefined;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const timer = createPerfTimer('DesktopWindow', '创建新窗口');
  try {
    logInfo('DesktopWindow', '开始创建新窗口', { pendingFolder });
    const windowId = await invoke<string>('create_new_window', { pendingFolder });
    const appWindow = new WebviewWindow(windowId, {
      url: '/',
      title: 'Nomo',
      width: 1180,
      height: 760,
      minWidth: 920,
      minHeight: 640,
      center: true,
      visible: true,
      ...getNewWindowChromeOptions(),
      resizable: true,
      maximizable: true,
      minimizable: true,
      closable: true,
    });

    await new Promise<void>((resolve, reject) => {
      appWindow
        .once('tauri://created', () => {
          resolve();
        })
        .catch(reject);
      appWindow
        .once<string>('tauri://error', (event) => {
          reject(event.payload);
        })
        .catch(reject);
    });
    timer.end({ windowId });
    logInfo('DesktopWindow', '新窗口创建完成', { windowId });
    return windowId;
  } catch (error) {
    timer.end({ failed: true });
    logError('DesktopWindow', 'Failed to create new window', { error: formatError(error) });
    return undefined;
  }
}

export async function openSettingsWindow(desktopEnabled: boolean) {
  if (!desktopEnabled) {
    return;
  }

  try {
    const timer = createPerfTimer('DesktopWindow', '打开设置窗口');
    logInfo('DesktopWindow', '打开设置窗口');
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_settings_window');
    timer.end();
  } catch (error) {
    logError('DesktopWindow', 'Failed to open settings window', { error: formatError(error) });
  }
}

export async function setDesktopIconTheme(desktopEnabled: boolean, theme: 'light' | 'dark') {
  if (!desktopEnabled) {
    return;
  }

  try {
    logInfo('DesktopWindow', '同步桌面图标主题', { theme });
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_desktop_icon_theme', { theme });
  } catch (error) {
    logError('DesktopWindow', 'Failed to sync desktop icon theme', { error: formatError(error) });
  }
}

export async function refreshInterfaceLanguageChrome(desktopEnabled: boolean) {
  if (!desktopEnabled) {
    return;
  }

  try {
    logInfo('DesktopWindow', '刷新界面语言 chrome');
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('refresh_interface_language_chrome');
  } catch (error) {
    logError('DesktopWindow', 'Failed to refresh interface language chrome', {
      error: formatError(error),
    });
  }
}

export async function getDesktopSystemTheme(
  desktopEnabled: boolean,
): Promise<'light' | 'dark' | undefined> {
  if (!desktopEnabled) {
    return undefined;
  }

  try {
    const timer = createPerfTimer('DesktopWindow', '读取系统主题');
    const { invoke } = await import('@tauri-apps/api/core');
    const theme = await invoke<'light' | 'dark'>('get_desktop_system_theme');
    timer.end({ theme });
    return theme === 'dark' ? 'dark' : 'light';
  } catch (error) {
    logError('DesktopWindow', '读取系统主题失败', { error: formatError(error) });
    return undefined;
  }
}

export async function updateAppWindowTitle(
  desktopEnabled: boolean,
  fileName: string,
  dirty: boolean,
) {
  if (!desktopEnabled) {
    return;
  }

  const win = getCurrentWindow();
  const title = `${fileName}${dirty ? ' *' : ''} - Nomo`;
  await win.setTitle(title).catch(() => undefined);
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('report_window_title', { title }).catch(() => undefined);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
