import { writable } from 'svelte/store';
import { t } from '../i18n';

export interface ConfirmActionOptions {
  title?: string;
  /** 确认/放弃按钮文字 */
  okLabel?: string;
  /** 取消按钮文字 */
  cancelLabel?: string;
  /** 保存按钮文字——传入此值后对话框变为三按钮模式（保存/放弃/取消） */
  saveLabel?: string;
}

export interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** 保存按钮文字；空字符串表示不显示保存按钮（二按钮模式） */
  saveLabel: string;
}

/** 当前待确认的对话框状态 */
export const confirmDialogStore = writable<ConfirmDialogState>({
  open: false,
  title: '',
  message: '',
  confirmLabel: t.discardChanges(),
  cancelLabel: t.cancel(),
  saveLabel: '',
});

let currentResolver: ((value: boolean | 'save') => void) | null = null;

/**
 * 显示自定义 UI 确认对话框。
 * - 未传 saveLabel：二按钮模式，返回 Promise<boolean>
 * - 传入 saveLabel：三按钮模式，返回 Promise<boolean | 'save'>
 */
export async function confirmAction(
  message: string,
  options: ConfirmActionOptions = {},
): Promise<boolean | 'save'> {
  // 如果有上一个未关闭的对话框，先取消它
  if (currentResolver) {
    const prev = currentResolver;
    currentResolver = null;
    prev(false);
  }

  return new Promise<boolean | 'save'>((resolve) => {
    currentResolver = resolve;
    confirmDialogStore.set({
      open: true,
      title: options.title ?? 'Nomo',
      message,
      confirmLabel: options.okLabel ?? t.discardChanges(),
      cancelLabel: options.cancelLabel ?? t.cancel(),
      saveLabel: options.saveLabel ?? '',
    });
  });
}

/** 对话框组件调用此函数来提交用户选择 */
export function resolveConfirmDialog(result: boolean | 'save') {
  if (currentResolver) {
    const resolve = currentResolver;
    currentResolver = null;
    resolve(result);
  }
  confirmDialogStore.update((s) => ({ ...s, open: false }));
}

export function dismissConfirmDialog() {
  resolveConfirmDialog(false);
}
