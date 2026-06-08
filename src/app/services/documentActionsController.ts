import type { NativeDocument, RecentEntry } from '../../lib/desktop/tauriStorage';
import type { EditorCore } from '../../lib/editor-core';
import { calculateDocumentStats } from '../../lib/outline/outlineService';
import type { Tab } from '../types';
import { getDirectoryLabel } from '../utils/pathLabels';
import {
  exportMarkdownInBrowser,
  findDroppedMarkdownPath,
  getExternalFileWarning,
  loadRecentEntries,
  openMarkdownFromDialog,
  readMarkdownFromPath,
  rememberNativeDocument,
  saveNativeMarkdownFile,
} from './documentFiles';
import { normalizeMarkdownForSave } from '../../lib/markdown/normalize';
import { createBlankTab, getNativeDocumentTargetTab, getOrCreateReusableTab } from './tabs';

interface DocumentActionsOptions {
  recoveryKey: string;
  getLargeDocumentLimit(): number;
  getAutoSaveDelayMs(): number;
  getCreateSnapshotBeforeSave(): boolean;
  getDesktopEnabled(): boolean;
  getDirty(): boolean;
  getAutoSaveEnabled(): boolean;
  getNativePath(): string | null;
  setMarkdown(value: string): void;
  setNativePath(value: string | null): void;
  getFileName(): string;
  setFileName(value: string): void;
  getFilePath(): string;
  setFilePath(value: string): void;
  getLastKnownModifiedAt(): number;
  setLastKnownModifiedAt(value: number): void;
  setDirty(value: boolean): void;
  setLargeDocumentMode(value: boolean): void;
  setReadonlyDocumentMode(value: boolean): void;
  getCurrentFolderPath(): string;
  getFileInput(): HTMLInputElement;
  getEditor(): EditorCore;
  getTabs(): Tab[];
  setTabs(value: Tab[]): void;
  getActiveTabId(): string;
  setActiveTabId(value: string): void;
  setStatusMessage(value: string): void;
  setRecentFiles(value: Awaited<ReturnType<typeof loadRecentEntries>>): void;
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
    targetTab.largeDocumentMode = text.length > options.getLargeDocumentLimit();
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
        options.getCreateSnapshotBeforeSave() ? options.getNativePath() : null,
      );
      if (error) {
        options.setStatusMessage(error);
      }
      if (document) {
        localStorage.removeItem(options.recoveryKey);
        await applySavedNativeDocument(document, markdownToSave, '已通过 Tauri 保存 Markdown 文件');
      }
      return;
    }

    const markdownToSave = normalizeMarkdownForSave(options.getEditor().getMarkdown());
    exportMarkdownInBrowser(markdownToSave, options.getFileName());
    options.setStatusMessage('已导出 Markdown 文件');
    options.setMarkdown(markdownToSave);
    options.setDirty(false);
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
      document.markdown.length > options.getLargeDocumentLimit() ||
      document.sizeBytes > options.getLargeDocumentLimit();
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

  async function applySavedNativeDocument(
    document: NativeDocument,
    markdownToSave: string,
    message: string,
  ) {
    const isLargeDocument =
      document.markdown.length > options.getLargeDocumentLimit() ||
      document.sizeBytes > options.getLargeDocumentLimit();
    const existingTab = options.getTabs().find((tab) => tab.nativePath === document.path);

    options.saveActiveTabState();

    const nativeDocumentTarget = getNativeDocumentTargetTab(
      options.getTabs(),
      options.getActiveTabId(),
      existingTab,
      true,
    );
    options.setTabs(nativeDocumentTarget.tabs);
    options.setActiveTabId(nativeDocumentTarget.activeTabId);
    const targetTab = nativeDocumentTarget.targetTab;

    targetTab.fileName = document.fileName;
    targetTab.filePath = document.path;
    targetTab.nativePath = document.path;
    targetTab.markdown = markdownToSave;
    targetTab.dirty = false;
    targetTab.lastKnownModifiedAt = document.modifiedAt;
    targetTab.largeDocumentMode = isLargeDocument;
    targetTab.readonlyDocumentMode = isLargeDocument || document.readonly;
    targetTab.externalFileWarning = document.readonly
      ? '当前文件是只读文件，建议使用另存为保存修改'
      : '';

    options.setFileName(targetTab.fileName);
    options.setFilePath(targetTab.filePath);
    options.setNativePath(targetTab.nativePath);
    options.setMarkdown(markdownToSave);
    options.setDirty(false);
    options.setLastKnownModifiedAt(targetTab.lastKnownModifiedAt);
    options.setLargeDocumentMode(targetTab.largeDocumentMode);
    options.setReadonlyDocumentMode(targetTab.readonlyDocumentMode);
    options.setExternalFileWarning(targetTab.externalFileWarning);
    options.setTabs([...options.getTabs()]);

    options.setStatusMessage(message);
    await rememberNativeDocument(document, calculateDocumentStats(markdownToSave).words);
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
        options.setActiveTabId('');
      }
    }
  }

  async function refreshRecentFiles() {
    options.setRecentFiles(await loadRecentEntries(options.getDesktopEnabled()));
  }

  let saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  function debouncedAutoSave(currentMarkdown: string) {
    if (!options.getAutoSaveEnabled()) return;

    const tabId = options.getActiveTabId();
    const path = options.getNativePath();
    const fileName = options.getFileName();

    if (!tabId || !path) return;

    if (saveTimers[tabId] !== undefined) {
      clearTimeout(saveTimers[tabId]);
    }

    saveTimers[tabId] = setTimeout(async () => {
      delete saveTimers[tabId];
      if (!options.getAutoSaveEnabled()) return;
      if (!options.getDesktopEnabled()) return;

      const markdownToSave = normalizeMarkdownForSave(currentMarkdown);

      const { document, error } = await saveNativeMarkdownFile(
        path,
        markdownToSave,
        fileName,
        null,
      );

      if (error) {
        if (options.getActiveTabId() === tabId) {
          options.setStatusMessage(`自动保存失败: ${error}`);
        }
        return;
      }

      if (document) {
        if (options.getActiveTabId() === tabId) {
          options.setStatusMessage('已保存');
        }

        const tabs = options.getTabs();
        const savedTab = tabs.find((tab) => tab.id === tabId);
        if (savedTab) {
          savedTab.dirty = false;
          savedTab.lastKnownModifiedAt = document.modifiedAt;

          if (options.getActiveTabId() === tabId) {
            options.setDirty(false);
            options.setLastKnownModifiedAt(document.modifiedAt);
          }
          options.setTabs([...tabs]);
        }

        // H1 Sync
        const match = markdownToSave.match(/^#\s+(.+)$/m);
        const h1 = match ? match[1].trim() : null;
        if (h1) {
          let finalName = h1.replace(/[<>:"/\\|?*]/g, '');
          if (finalName && !finalName.toLowerCase().endsWith('.md')) {
            finalName += '.md';
          }
          if (finalName && finalName !== fileName) {
            const { dirname, join } = await import('@tauri-apps/api/path');
            const parentDir = await dirname(path);
            let targetPath = await join(parentDir, finalName);

            const { statMarkdownFile, renameFile } = await import('../../lib/desktop/tauriStorage');
            let suffix = 1;
            let currentName = finalName;
            while (true) {
              const stat = await statMarkdownFile(targetPath).catch(() => null);
              if (!stat || !stat.exists) break;
              if (stat.path === path) break; // It's the same file (e.g. case change on Windows)
              const base = finalName.replace(/\.md$/i, '');
              currentName = `${base} (${suffix}).md`;
              targetPath = await join(parentDir, currentName);
              suffix++;
            }

            if (targetPath !== path) {
              await renameFile(path, targetPath).catch(() => null);

              if (savedTab) {
                savedTab.nativePath = targetPath;
                savedTab.filePath = targetPath;
                savedTab.fileName = currentName;

                const stat = await statMarkdownFile(targetPath).catch(() => null);
                if (stat && stat.exists) {
                  savedTab.lastKnownModifiedAt = stat.modifiedAt;
                  if (options.getActiveTabId() === tabId) {
                    options.setLastKnownModifiedAt(stat.modifiedAt);
                  }
                }

                if (options.getActiveTabId() === tabId) {
                  options.setFileName(currentName);
                  options.setFilePath(targetPath);
                  options.setNativePath(targetPath);
                }

                options.setTabs([...options.getTabs()]);
              }
              if (options.getCurrentFolderPath()) {
                options.loadFolder(options.getCurrentFolderPath());
              }
            }
          }
        }
      }
    }, options.getAutoSaveDelayMs());
  }

  function cancelPendingAutoSaves() {
    for (const timer of Object.values(saveTimers)) {
      clearTimeout(timer);
    }
    saveTimers = {};
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
    debouncedAutoSave,
    cancelPendingAutoSaves,
  };
}
