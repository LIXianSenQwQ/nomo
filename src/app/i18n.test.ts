import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EFFECTIVE_INTERFACE_LOCALE,
  INTERFACE_LANGUAGE_OPTIONS,
  applyInterfaceLanguagePreference,
  getInterfaceLocale,
  resolveInterfaceLocale,
  t,
} from './i18n';

describe('interface language i18n', () => {
  it('resolves explicit interface language preferences', () => {
    expect(resolveInterfaceLocale('zh-CN', ['en-US'])).toBe('zh-CN');
    expect(resolveInterfaceLocale('zh-TW', ['zh-CN'])).toBe('zh-TW');
    expect(resolveInterfaceLocale('en-US', ['zh-CN'])).toBe('en-US');
    expect(resolveInterfaceLocale('ja-JP', ['en-US'])).toBe('ja-JP');
  });

  it('maps system language candidates to supported locales', () => {
    expect(resolveInterfaceLocale('system', ['zh-CN'])).toBe('zh-CN');
    expect(resolveInterfaceLocale('system', ['zh-Hans-CN'])).toBe('zh-CN');
    expect(resolveInterfaceLocale('system', ['zh-SG'])).toBe('zh-CN');
    expect(resolveInterfaceLocale('system', ['zh-TW'])).toBe('zh-TW');
    expect(resolveInterfaceLocale('system', ['zh-Hant-TW'])).toBe('zh-TW');
    expect(resolveInterfaceLocale('system', ['zh-HK'])).toBe('zh-TW');
    expect(resolveInterfaceLocale('system', ['en-US'])).toBe('en-US');
    expect(resolveInterfaceLocale('system', ['ja'])).toBe('ja-JP');
    expect(resolveInterfaceLocale('system', ['ja-JP'])).toBe('ja-JP');
    expect(resolveInterfaceLocale('system', ['ja_JP'])).toBe('ja-JP');
    expect(resolveInterfaceLocale('system', ['fr-FR'])).toBe('en-US');
    expect(resolveInterfaceLocale('system', [])).toBe(DEFAULT_EFFECTIVE_INTERFACE_LOCALE);
  });

  it('applies the effective locale to the Paraglide runtime and document lang', () => {
    const locale = applyInterfaceLanguagePreference('system', ['zh-Hant-HK']);

    expect(locale).toBe('zh-TW');
    expect(getInterfaceLocale()).toBe('zh-TW');
    expect(document.documentElement.lang).toBe('zh-TW');

    const japaneseLocale = applyInterfaceLanguagePreference('system', ['ja-JP']);
    expect(japaneseLocale).toBe('ja-JP');
    expect(getInterfaceLocale()).toBe('ja-JP');
    expect(document.documentElement.lang).toBe('ja-JP');
  });

  it('exposes Japanese in the interface language options', () => {
    expect(INTERFACE_LANGUAGE_OPTIONS).toContainEqual({
      value: 'ja-JP',
      labelKey: 'interfaceLanguageJaJp',
    });

    applyInterfaceLanguagePreference('ja-JP');
    expect(t.interfaceLanguageJaJp()).toBe('日本語');
  });

  it('provides software update messages for supported interface languages', () => {
    applyInterfaceLanguagePreference('zh-CN');
    expect(t.softwareUpdateRestartAndInstall()).toBe('重启并安装');
    expect(t.softwareUpdateIntegrityFailed()).toContain('校验失败');
    expect(t.unsavedChangesBeforeUpdate({ names: 'a.md' })).toContain('a.md');

    applyInterfaceLanguagePreference('zh-TW');
    expect(t.softwareUpdateRestartAndInstall()).toBe('重啟並安裝');
    expect(t.softwareUpdateIntegrityFailed()).toContain('校驗失敗');

    applyInterfaceLanguagePreference('en-US');
    expect(t.softwareUpdateRestartAndInstall()).toBe('Restart and install');
    expect(t.softwareUpdateIntegrityFailed()).toContain('verification failed');

    applyInterfaceLanguagePreference('ja-JP');
    expect(t.softwareUpdateRestartAndInstall()).toBe('再起動してインストール');
    expect(t.softwareUpdateIntegrityFailed()).toContain('検証に失敗');
    expect(t.imageImport()).toContain('画像');
    expect(t.insertTableSize({ rows: 2, columns: 3 })).toContain('2');
  });

  it('keeps generated message access safe through the translation proxy', () => {
    applyInterfaceLanguagePreference('zh-CN');
    const currentFolder = t.currentFolder;

    expect(currentFolder()).toBe('当前文件夹');
  });

  it('localizes file type labels used by explorer actions', () => {
    applyInterfaceLanguagePreference('zh-CN');
    expect(t.file()).toBe('文件');
    expect(t.folder()).toBe('文件夹');

    applyInterfaceLanguagePreference('zh-TW');
    expect(t.file()).toBe('檔案');
    expect(t.folder()).toBe('資料夾');

    applyInterfaceLanguagePreference('en-US');
    expect(t.file()).toBe('file');
    expect(t.folder()).toBe('folder');

    applyInterfaceLanguagePreference('ja-JP');
    expect(t.file()).toBe('ファイル');
    expect(t.folder()).toBe('フォルダー');
  });
});
