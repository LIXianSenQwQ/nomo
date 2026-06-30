import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import { applyInterfaceLanguagePreference } from '../i18n';
import {
  confirmAction,
  confirmDialogStore,
  dismissConfirmDialog,
  resolveConfirmDialog,
} from './confirmAction';

describe('confirmAction', () => {
  afterEach(() => {
    dismissConfirmDialog();
    applyInterfaceLanguagePreference('en-US');
  });

  it('uses the current interface language for default action labels', async () => {
    applyInterfaceLanguagePreference('zh-CN');

    const result = confirmAction('确认关闭？');

    expect(get(confirmDialogStore)).toMatchObject({
      open: true,
      confirmLabel: '放弃修改',
      cancelLabel: '取消',
    });

    resolveConfirmDialog(true);
    await expect(result).resolves.toBe(true);
  });
});
