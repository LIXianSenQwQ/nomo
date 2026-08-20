import { describe, expect, it } from 'vitest';
import {
  detectAppPlatform,
  formatShortcutLabel,
  getPlatformCapabilities,
  HOMEBREW_SETUP_COMMAND,
} from './platform';

describe('platform', () => {
  it('detects desktop platforms from the browser user agent', () => {
    expect(detectAppPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macos');
    expect(detectAppPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows');
    expect(detectAppPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux');
  });

  it('uses a custom titlebar on Windows while keeping native chrome elsewhere', () => {
    expect(getPlatformCapabilities('windows')).toMatchObject({
      windowChromeMode: 'windows-custom',
      usesCustomWindowsTitlebar: true,
      showsInAppWindowMenu: true,
      windowDecorations: false,
    });

    expect(getPlatformCapabilities('macos')).toMatchObject({
      windowChromeMode: 'native',
      usesCustomWindowsTitlebar: false,
      showsInAppWindowMenu: false,
      windowDecorations: true,
    });
  });

  it('formats stored Ctrl accelerators as macOS menu glyphs', () => {
    expect(formatShortcutLabel('Ctrl+X', 'macos')).toBe('⌘\u202FX');
    expect(formatShortcutLabel('Ctrl+Shift+V', 'macos')).toBe('⇧\u202F⌘\u202FV');
    expect(formatShortcutLabel('Ctrl+Shift+Z', 'macos')).toBe('⇧\u202F⌘\u202FZ');
    expect(formatShortcutLabel('Ctrl+X', 'windows')).toBe('Ctrl+X');
    expect(formatShortcutLabel('Ctrl+Shift+V', 'windows')).toBe('Ctrl+Shift+V');
  });

  it('keeps a tap-and-install Homebrew command for macOS updates', () => {
    expect(HOMEBREW_SETUP_COMMAND).toContain('brew tap nomo-md/nomo');
    expect(HOMEBREW_SETUP_COMMAND).toContain('brew install --cask nomo');
  });
});
