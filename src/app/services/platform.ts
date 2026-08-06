export type AppPlatform = 'macos' | 'windows' | 'linux' | 'unknown';
export type WindowChromeMode = 'native' | 'windows-custom';

export interface PlatformCapabilities {
  platform: AppPlatform;
  isMac: boolean;
  isWindows: boolean;
  windowChromeMode: WindowChromeMode;
  usesCustomWindowsTitlebar: boolean;
  showsInAppWindowMenu: boolean;
  windowDecorations: boolean;
}

export function detectAppPlatform(userAgent = globalThis.navigator?.userAgent ?? ''): AppPlatform {
  if (/\bMacintosh\b|\bMac OS\b|\bMac\b/i.test(userAgent)) {
    return 'macos';
  }
  if (/\bWindows\b|\bWin64\b|\bWin32\b/i.test(userAgent)) {
    return 'windows';
  }
  if (/\bLinux\b|\bX11\b/i.test(userAgent)) {
    return 'linux';
  }
  return 'unknown';
}

export function getPlatformCapabilities(
  platform: AppPlatform = detectAppPlatform(),
): PlatformCapabilities {
  const isWindows = platform === 'windows';
  const windowChromeMode: WindowChromeMode = isWindows ? 'windows-custom' : 'native';

  return {
    platform,
    isMac: platform === 'macos',
    isWindows,
    windowChromeMode,
    usesCustomWindowsTitlebar: isWindows,
    showsInAppWindowMenu: isWindows,
    windowDecorations: !isWindows,
  };
}
