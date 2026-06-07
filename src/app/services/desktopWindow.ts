import { getCurrentWindow } from '@tauri-apps/api/window';

export async function minimizeAppWindow(desktopEnabled: boolean) {
  if (!desktopEnabled) {
    return;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('minimize_window');
  } catch (error) {
    console.error('最小化窗口失败:', error);
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
    console.error('最大化窗口失败:', error);
  }
}

export async function closeAppWindow(desktopEnabled: boolean) {
  if (!desktopEnabled) {
    return;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('close_window');
  } catch (error) {
    console.error('关闭窗口失败:', error);
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
      title: 'NewMd',
      width: 1180,
      height: 760,
      minWidth: 920,
      minHeight: 640,
      center: true,
      visible: true,
      decorations: false,
      resizable: true,
      maximizable: true,
      minimizable: true,
      closable: true,
    });

    await new Promise<void>((resolve, reject) => {
      appWindow.once('tauri://created', () => {
        resolve();
      }).catch(reject);
      appWindow.once<string>('tauri://error', (event) => {
        reject(event.payload);
      }).catch(reject);
    });
    return windowId;
  } catch (error) {
    console.error('创建新窗口失败:', error);
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
  const title = `${fileName}${dirty ? ' *' : ''} - NewMd`;
  await win.setTitle(title).catch(() => undefined);
}
