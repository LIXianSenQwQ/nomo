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

export async function createAppWindow(desktopEnabled: boolean) {
  if (!desktopEnabled) {
    return;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('create_new_window').catch(() => undefined);
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
