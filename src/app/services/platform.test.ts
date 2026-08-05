import { describe, expect, it } from 'vitest';
import { detectAppPlatform, getPlatformCapabilities } from './platform';

describe('platform', () => {
  it('detects desktop platforms from the browser user agent', () => {
    expect(detectAppPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macos');
    expect(detectAppPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows');
    expect(detectAppPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux');
  });

  it('uses native decorations while keeping the Nomo menu in the Windows overlay', () => {
    expect(getPlatformCapabilities('windows')).toMatchObject({
      windowChromeMode: 'windows-native-overlay',
      usesNativeWindowControls: true,
      usesWindowsNativeOverlay: true,
      showsInAppWindowMenu: true,
      windowDecorations: true,
    });

    expect(getPlatformCapabilities('macos')).toMatchObject({
      windowChromeMode: 'native',
      usesNativeWindowControls: true,
      usesWindowsNativeOverlay: false,
      showsInAppWindowMenu: false,
      windowDecorations: true,
    });
  });
});
