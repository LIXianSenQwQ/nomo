import { LogicalPosition } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getPlatformCapabilities } from './platform';

function getNewWindowChromeOptions() {
  const platformCapabilities = getPlatformCapabilities();

  if (platformCapabilities.isMac) {
    return {
      decorations: true,
      titleBarStyle: 'overlay' as const,
      trafficLightPosition: new LogicalPosition(16, 14),
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
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('minimize_window');
  } catch (error) {
    console.error('Failed to minimize window:', error);
  }
}

export async function maximizeAppWindow(desktopEnabled: boolean) {
  if (!desktopEnabled) {
    return;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('maximize_window');
  } catch (error) {
    console.error('Failed to maximize window:', error);
  }
}

export async function closeAppWindow(desktopEnabled: boolean, closeToTrayEnabled = false) {
  if (!desktopEnabled) {
    return;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke(closeToTrayEnabled ? 'hide_window_to_tray' : 'close_window');
  } catch (error) {
    console.error('Failed to close window:', error);
  }
}

export async function exitApp(desktopEnabled: boolean) {
  if (!desktopEnabled) {
    return;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('exit_app');
  } catch (error) {
    console.error('Failed to exit app:', error);
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
  try {
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
    return windowId;
  } catch (error) {
    console.error('Failed to create new window:', error);
    return undefined;
  }
}

export async function openSettingsWindow(desktopEnabled: boolean) {
  if (!desktopEnabled) {
    return;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_settings_window');
  } catch (error) {
    console.error('Failed to open settings window:', error);
  }
}

export async function setDesktopIconTheme(desktopEnabled: boolean, theme: 'light' | 'dark') {
  if (!desktopEnabled) {
    return;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_desktop_icon_theme', { theme });
  } catch (error) {
    console.error('Failed to sync desktop icon theme:', error);
  }
}

export async function refreshInterfaceLanguageChrome(desktopEnabled: boolean) {
  if (!desktopEnabled) {
    return;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('refresh_interface_language_chrome');
  } catch (error) {
    console.error('Failed to refresh interface language chrome:', error);
  }
}

export async function getDesktopSystemTheme(
  desktopEnabled: boolean,
): Promise<'light' | 'dark' | undefined> {
  if (!desktopEnabled) {
    return undefined;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const theme = await invoke<'light' | 'dark'>('get_desktop_system_theme');
    return theme === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.error('读取系统主题失败:', error);
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
}
