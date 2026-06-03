import type { NativeDocument } from '../../lib/desktop/tauriStorage';
import type { EditorCore } from '../../lib/editor-core';
import { calculateDocumentStats } from '../../lib/outline/outlineService';
import type { Tab } from '../types';
import { getDirectoryLabel } from '../utils/pathLabels';
import {
  exportMarkdownInBrowser,
  findDroppedMarkdownPath,
  getExternalFileWarning,
  loadRecentDocuments,
  openMarkdownFromDialog,
  readMarkdownFromPath,
  rememberNativeDocument,
  saveNativeMarkdownFile,
} from './documentFiles';
import { normalizeMarkdownForSave } from '../../lib/markdown/normalize';
import { createBlankTab, getNativeDocumentTargetTab, getOrCreateReusableTab } from './tabs';

interface DocumentActionsOptions {
  largeDocumentLimit: number;
  recoveryKey: string;
  getDesktopEnabled(): boolean;
  getDirty(): boolean;
  getNativePath(): string | null;
  getFileName(): string;
  getLastKnownModifiedAt(): number;
  getCurrentFolderPath(): string;
  getFileInput(): HTMLInputElement;
  getEditor(): EditorCore;
  getTabs(): Tab[];
  setTabs(value: Tab[]): void;
  getActiveTabId(): string;
  setActiveTabId(value: string): void;
  setStatusMessage(value: string): void;
  setRecentFiles(value: Awaited<ReturnType<typeof loadRecentDocuments>>): void;
  setExternalFileWarning(value: string): void;
  saveActiveTabState(): void;
  loadTabState(tab: Tab): void;
  switchTab(tabId: string): void;
  writeRecoveryDraft(reason: string): void;
  updateWindowTitle(): void;
  loadFolder(folderPath: string): Promise<void>;
  expandAncestors(filePath: string, rootPath: string): void;
}

export function createDocumentActionsController(options: DocumentActionsOptions) {
  async function openDroppedMarkdown(paths: string[]) {
    const target = findDroppedMarkdownPath(paths);
    if (!target) {
      options.setStatusMessage('拖放文件未包含 Markdown / 文本文件');
      return;
    }
    if (options.getDirty()) {
      options.writeRecoveryDraft('drag-open-blocked');
      options.setStatusMessage('当前文档有未保存修改，已保留恢复副本；请先保存后再拖放打开');
      return;
    }

    const { document, error } = await readMarkdownFromPath(target, '拖放打开失败');
    if (error) {
      options.setStatusMessage(error);
    }
    if (document) {
      await applyNativeDocument(document, '已通过拖放打开 Markdown 文件');
    }
  }

  async function openFileDialog() {
    if (options.getDirty()) {
      options.writeRecoveryDraft('open-dialog');
    }
    if (options.getDesktopEnabled()) {
      const { document, error } = await openMarkdownFromDialog();
      if (error) {
        options.setStatusMessage(error);
      }
      if (document) {
        await applyNativeDocument(document, '已通过 Tauri 打开 Markdown 文件');
      }
      return;
    }

    options.getFileInput().click();
  }

  async function openMarkdownFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    options.saveActiveTabState();

    const browserFileTarget = getOrCreateReusableTab(options.getTabs(), options.getActiveTabId());
    options.setTabs(browserFileTarget.tabs);
    options.setActiveTabId(browserFileTarget.activeTabId);
    const targetTab = browserFileTarget.targetTab;

    targetTab.fileName = file.name;
    targetTab.filePath = `本地浏览器文件：${file.name}`;
    targetTab.nativePath = null;
    targetTab.markdown = text;
    targetTab.dirty = false;
    targetTab.lastKnownModifiedAt = 0;
    targetTab.largeDocumentMode = text.length > options.largeDocumentLimit;
    targetTab.readonlyDocumentMode = targetTab.largeDocumentMode;
    targetTab.externalFileWarning = '';

    options.setTabs([...options.getTabs()]);
    options.loadTabState(targetTab);

    options.setStatusMessage('已打开 Markdown 文件');
    input.value = '';
  }

  async function saveMarkdownFile(saveAs = false) {
    const activeTab = options.getTabs().find((tab) => tab.id === options.getActiveTabId());
    if (activeTab?.largeDocumentMode && !saveAs) {
      options.setStatusMessage('大文件处于只读源码模式，请使用另存为或缩小文件后再继续编辑');
      return;
    }

    if (options.getDesktopEnabled()) {
      const path = saveAs ? null : options.getNativePath();
      const markdownToSave = normalizeMarkdownForSave(options.getEditor().getMarkdown());
      options.writeRecoveryDraft(saveAs ? 'before-save-as' : 'before-save');
      const { document, error } = await saveNativeMarkdownFile(
        path,
        markdownToSave,
        options.getFileName(),
        options.getNativePath(),
      );
      if (error) {
        options.setStatusMessage(error);
      }
      if (document) {
        localStorage.removeItem(options.recoveryKey);
        await applyNativeDocument(document, '已通过 Tauri 保存 Markdown 文件', true);
      }
      return;
    }

    const markdownToSave = normalizeMarkdownForSave(options.getEditor().getMarkdown());
    exportMarkdownInBrowser(markdownToSave, options.getFileName());
    options.setStatusMessage('已导出 Markdown 文件');
    options.getEditor().setMarkdown(markdownToSave, { reason: 'save-file' });
  }

  async function openRecentFile(path: string) {
    if (!options.getDesktopEnabled()) {
      return;
    }

    const { document, error } = await readMarkdownFromPath(path, '打开最近文件失败');
    if (error) {
      options.setStatusMessage(error);
    }

    if (document) {
      await applyNativeDocument(document, '已打开最近文件');
    }
  }

  async function applyNativeDocument(document: NativeDocument, message: string, saved = false) {
    const isLargeDocument =
      document.markdown.length > options.largeDocumentLimit ||
      document.sizeBytes > options.largeDocumentLimit;
    const existingTab = options.getTabs().find((tab) => tab.nativePath === document.path);
    if (existingTab && !saved) {
      options.switchTab(existingTab.id);
      options.setStatusMessage('已切换到已打开的标签页');
      return;
    }

    options.saveActiveTabState();

    const nativeDocumentTarget = getNativeDocumentTargetTab(
      options.getTabs(),
      options.getActiveTabId(),
      existingTab,
      saved,
    );
    options.setTabs(nativeDocumentTarget.tabs);
    options.setActiveTabId(nativeDocumentTarget.activeTabId);
    const targetTab = nativeDocumentTarget.targetTab;

    targetTab.fileName = document.fileName;
    targetTab.filePath = document.path;
    targetTab.nativePath = document.path;
    targetTab.markdown = document.markdown;
    targetTab.dirty = false;
    targetTab.lastKnownModifiedAt = document.modifiedAt;
    targetTab.largeDocumentMode = isLargeDocument;
    targetTab.readonlyDocumentMode = isLargeDocument || document.readonly;
    targetTab.externalFileWarning = document.readonly
      ? '当前文件是只读文件，建议使用另存为保存修改'
      : '';

    options.setActiveTabId(targetTab.id);
    options.setTabs([...options.getTabs()]);
    options.loadTabState(targetTab);

    options.setStatusMessage(message);
    await rememberNativeDocument(document, calculateDocumentStats(document.markdown).words);
    await refreshRecentFiles();
    if (isLargeDocument) {
      options.setStatusMessage('大文件已用只读源码模式打开，避免语义解析阻塞界面');
    }

    const parentDir = getDirectoryLabel(document.path);
    if (parentDir && parentDir !== '当前文件夹') {
      if (!options.getCurrentFolderPath()) {
        options.loadFolder(parentDir).catch(() => undefined);
      } else {
        options.expandAncestors(document.path, options.getCurrentFolderPath());
      }
    }
  }

  function createNewFile() {
    if (options.getDirty()) {
      options.writeRecoveryDraft('new-file-blocked');
      options.setStatusMessage('当前文档有未保存修改，已保留恢复副本并新建文档');
    }

    options.saveActiveTabState();

    const newTab = createBlankTab();
    options.setTabs([...options.getTabs(), newTab]);
    options.setActiveTabId(newTab.id);
    options.loadTabState(newTab);
    options.updateWindowTitle();
  }

  function closeTab(tabId: string, event?: Event) {
    event?.stopPropagation();
    const tabToClose = options.getTabs().find((tab) => tab.id === tabId);
    if (!tabToClose) return;

    if (tabToClose.dirty) {
      const confirmClose = confirm(
        `文件 "${tabToClose.fileName}" 已修改，是否确认关闭？您的修改可能会丢失。`,
      );
      if (!confirmClose) return;
    }

    const index = options.getTabs().findIndex((tab) => tab.id === tabId);
    const nextTabs = options.getTabs().filter((tab) => tab.id !== tabId);
    options.setTabs(nextTabs);

    if (options.getActiveTabId() === tabId) {
      if (nextTabs.length > 0) {
        const newActiveIndex = Math.min(index, nextTabs.length - 1);
        options.setActiveTabId(nextTabs[newActiveIndex].id);
        options.loadTabState(nextTabs[newActiveIndex]);
      } else {
        createNewFile();
      }
    }
  }

  async function refreshRecentFiles() {
    options.setRecentFiles(await loadRecentDocuments(options.getDesktopEnabled()));
  }

  async function checkExternalFileChange() {
    const warning = await getExternalFileWarning(
      options.getDesktopEnabled(),
      options.getNativePath(),
      options.getLastKnownModifiedAt(),
      options.getDirty(),
    );
    if (warning) {
      options.setExternalFileWarning(warning);
    }
  }

  return {
    openDroppedMarkdown,
    openFileDialog,
    openMarkdownFile,
    saveMarkdownFile,
    openRecentFile,
    applyNativeDocument,
    createNewFile,
    closeTab,
    refreshRecentFiles,
    checkExternalFileChange,
  };
}
