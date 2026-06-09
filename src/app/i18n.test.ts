import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EFFECTIVE_INTERFACE_LOCALE,
  applyInterfaceLanguagePreference,
  getInterfaceLocale,
  resolveInterfaceLocale,
} from './i18n';

describe('interface language i18n', () => {
  it('resolves explicit interface language preferences', () => {
    expect(resolveInterfaceLocale('zh-CN', ['en-US'])).toBe('zh-CN');
    expect(resolveInterfaceLocale('zh-TW', ['zh-CN'])).toBe('zh-TW');
    expect(resolveInterfaceLocale('en-US', ['zh-CN'])).toBe('en-US');
  });

  it('maps system language candidates to supported locales', () => {
    expect(resolveInterfaceLocale('system', ['zh-CN'])).toBe('zh-CN');
    expect(resolveInterfaceLocale('system', ['zh-Hans-CN'])).toBe('zh-CN');
    expect(resolveInterfaceLocale('system', ['zh-SG'])).toBe('zh-CN');
    expect(resolveInterfaceLocale('system', ['zh-TW'])).toBe('zh-TW');
    expect(resolveInterfaceLocale('system', ['zh-Hant-TW'])).toBe('zh-TW');
    expect(resolveInterfaceLocale('system', ['zh-HK'])).toBe('zh-TW');
    expect(resolveInterfaceLocale('system', ['en-US'])).toBe('en-US');
    expect(resolveInterfaceLocale('system', ['fr-FR'])).toBe('en-US');
    expect(resolveInterfaceLocale('system', ['ja'])).toBe('en-US');
    expect(resolveInterfaceLocale('system', [])).toBe(DEFAULT_EFFECTIVE_INTERFACE_LOCALE);
  });

  it('applies the effective locale to the Paraglide runtime and document lang', () => {
    const locale = applyInterfaceLanguagePreference('system', ['zh-Hant-HK']);

    expect(locale).toBe('zh-TW');
    expect(getInterfaceLocale()).toBe('zh-TW');
    expect(document.documentElement.lang).toBe('zh-TW');
  });
});
