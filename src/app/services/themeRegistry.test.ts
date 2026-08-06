import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../../lib/theme/types';
import { ThemeRegistry, themeRegistry, validateThemeDefinition } from './themeRegistry';

function cloneDefaultTheme() {
  return JSON.parse(JSON.stringify(themeRegistry.getTheme('nomo-default'))) as ThemeDefinition;
}

describe('ThemeRegistry', () => {
  it('registers built-in themes with complete light and dark variants', () => {
    expect(themeRegistry.listThemes().map((theme) => theme.id)).toEqual([
      'nomo-default',
      'nomo-amber-paper',
      'nomo-classic-gray',
      'nomo-github',
    ]);
    for (const theme of themeRegistry.listThemes()) {
      expect(() => validateThemeDefinition(theme)).not.toThrow();
      expect(['modern', 'paper', 'classic']).toContain(theme.styleProfile);
      expect(theme.variants.light.tokens).toBeDefined();
      expect(theme.variants.dark.tokens).toBeDefined();
      expect(theme.variants.light.styleTokens).toBeDefined();
      expect(theme.variants.dark.styleTokens).toBeDefined();
    }
  });

  it('keeps normal text and accent text at WCAG AA contrast', () => {
    for (const theme of themeRegistry.listThemes()) {
      for (const variant of Object.values(theme.variants)) {
        expect(
          contrastRatio(variant.tokens.foreground, variant.tokens.background),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(variant.tokens.mutedForeground, variant.tokens.background),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(variant.tokens.onAccent, variant.tokens.accentFill),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('rejects duplicate theme identifiers', () => {
    const registry = new ThemeRegistry();
    const theme = cloneDefaultTheme();
    registry.registerTheme(theme);

    expect(() => registry.registerTheme(theme)).toThrow(/重复/);
  });

  it('rejects missing and unknown color tokens', () => {
    const missing = cloneDefaultTheme();
    delete (missing.variants.light.tokens as Partial<typeof missing.variants.light.tokens>)
      .foreground;
    expect(() => validateThemeDefinition(missing)).toThrow(/missing=foreground/);

    const unknown = cloneDefaultTheme();
    (unknown.variants.light.tokens as Record<string, string>).unexpected = '#fff';
    expect(() => validateThemeDefinition(unknown)).toThrow(/unknown=unexpected/);
  });

  it('rejects incomplete, unsafe, and unsupported style definitions', () => {
    const missing = cloneDefaultTheme();
    delete (missing.variants.light.styleTokens as Partial<
      typeof missing.variants.light.styleTokens
    >).radiusSm;
    expect(() => validateThemeDefinition(missing)).toThrow(/missing=radiusSm/);

    const unsafe = cloneDefaultTheme();
    unsafe.variants.dark.styleTokens.shadowDialog = '0 0 1px red; color: red';
    expect(() => validateThemeDefinition(unsafe)).toThrow(/样式令牌值非法/);

    const unsupported = cloneDefaultTheme();
    unsupported.styleProfile = 'custom' as typeof unsupported.styleProfile;
    expect(() => validateThemeDefinition(unsupported)).toThrow(/样式档案/);
  });

  it('rejects unsupported Shiki and Mermaid configurations', () => {
    const invalidShiki = cloneDefaultTheme();
    invalidShiki.variants.light.shikiTheme = 'unknown-theme';
    expect(() => validateThemeDefinition(invalidShiki)).toThrow(/Shiki/);

    const invalidMermaid = cloneDefaultTheme();
    invalidMermaid.variants.dark.mermaid = {
      theme: 'default',
      themeVariables: { primaryColor: '#fff' },
    };
    expect(() => validateThemeDefinition(invalidMermaid)).toThrow(/themeVariables/);
  });
});

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function relativeLuminance(color: string) {
  const channels = color
    .slice(1)
    .match(/../g)
    ?.map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  if (!channels || channels.length !== 3) {
    throw new Error(`测试仅支持十六进制颜色：${color}`);
  }
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
