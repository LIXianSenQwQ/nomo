import { describe, expect, it } from 'vitest';
import { detectAppPlatform, getPlatformCapabilities } from './platform';

describe('platform', () => {
  it('detects desktop platforms from the browser user agent', () => {
    expect(detectAppPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macos');
    expect(detectAppPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows');
    expect(detectAppPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux');
  });

  it('keeps Windows on custom chrome and macOS on native chrome', () => {
    expect(getPlatformCapabilities('windows')).toMatchObject({
      usesCustomWindowsTitlebar: true,
      usesNativeWindowControls: false,
      windowDecorations: false,
    });

    expect(getPlatformCapabilities('macos')).toMatchObject({
      usesCustomWindowsTitlebar: false,
      usesNativeWindowControls: true,
      windowDecorations: true,
    });
  });
});
