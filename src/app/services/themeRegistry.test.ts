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
      for (const [scheme, variant] of Object.entries(theme.variants)) {
        const { tokens } = variant;
        assertContrast(`${theme.id}/${scheme}/foreground`, tokens.foreground, tokens.background);
        assertContrast(
          `${theme.id}/${scheme}/document-foreground`,
          tokens.foreground,
          tokens.documentBackground,
        );
        assertContrast(
          `${theme.id}/${scheme}/muted-foreground`,
          tokens.mutedForeground,
          tokens.background,
        );
        assertContrast(`${theme.id}/${scheme}/accent-fill`, tokens.onAccent, tokens.accentFill);
        assertContrast(
          `${theme.id}/${scheme}/sidebar-active`,
          tokens.accentStrong,
          tokens.sidebarActive,
        );
      }
    }
  });

  it('keeps blockquote and callout text at WCAG AA contrast', () => {
    for (const theme of themeRegistry.listThemes()) {
      for (const [scheme, variant] of Object.entries(theme.variants)) {
        const { tokens } = variant;
        const backdrop = tokens.documentBackground;
        assertContrast(
          `${theme.id}/${scheme}/blockquote-modern`,
          tokens.blockquoteForeground,
          tokens.blockquoteBackground,
          backdrop,
        );
        assertContrast(
          `${theme.id}/${scheme}/blockquote-classic`,
          tokens.blockquoteForeground,
          tokens.blockquoteClassicBackground,
          backdrop,
        );

        const callouts = [
          [
            'note',
            tokens.calloutNoteForeground,
            tokens.calloutNoteBackground,
            tokens.calloutNoteClassicBackground,
          ],
          [
            'tip',
            tokens.calloutTipForeground,
            tokens.calloutTipBackground,
            tokens.calloutTipClassicBackground,
          ],
          [
            'important',
            tokens.calloutImportantForeground,
            tokens.calloutImportantBackground,
            tokens.calloutImportantClassicBackground,
          ],
          [
            'warning',
            tokens.calloutWarningForeground,
            tokens.calloutWarningBackground,
            tokens.calloutWarningClassicBackground,
          ],
          [
            'caution',
            tokens.calloutCautionForeground,
            tokens.calloutCautionBackground,
            tokens.calloutCautionClassicBackground,
          ],
        ] as const;

        for (const [name, foreground, modernBackground, classicBackground] of callouts) {
          assertContrast(
            `${theme.id}/${scheme}/callout-${name}-modern`,
            foreground,
            modernBackground,
            backdrop,
          );
          assertContrast(
            `${theme.id}/${scheme}/callout-${name}-classic`,
            foreground,
            classicBackground,
            backdrop,
          );
        }
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

function assertContrast(label: string, foreground: string, background: string, backdrop?: string) {
  expect(contrastRatio(foreground, background, backdrop), label).toBeGreaterThanOrEqual(4.5);
}

function contrastRatio(foreground: string, background: string, backdrop?: string) {
  const foregroundLuminance = relativeLuminance(resolveColor(foreground, backdrop));
  const backgroundLuminance = relativeLuminance(resolveColor(background, backdrop));
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function resolveColor(color: string, backdrop?: string): [number, number, number] {
  if (color === 'transparent') {
    if (!backdrop) {
      throw new Error('透明色需要提供背景色');
    }
    return parseHexColor(backdrop);
  }

  if (color.startsWith('#')) {
    return parseHexColor(color);
  }

  const rgba = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0|1|0?\.\d+)\s*\)$/);
  if (!rgba || !backdrop) {
    throw new Error(`测试不支持颜色格式：${color}`);
  }

  const background = parseHexColor(backdrop);
  const alpha = Number.parseFloat(rgba[4]);
  return [0, 1, 2].map((index) => {
    const foregroundChannel = Number.parseInt(rgba[index + 1], 10);
    return foregroundChannel * alpha + background[index] * (1 - alpha);
  }) as [number, number, number];
}

function parseHexColor(color: string): [number, number, number] {
  const channels = color
    .slice(1)
    .match(/../g)
    ?.map((value) => Number.parseInt(value, 16));
  if (!channels || channels.length !== 3 || channels.some(Number.isNaN)) {
    throw new Error(`测试仅支持六位十六进制颜色：${color}`);
  }
  return channels as [number, number, number];
}

function relativeLuminance(channels: [number, number, number]) {
  const [red, green, blue] = channels.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}
