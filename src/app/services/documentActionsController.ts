import type { NativeDocument, RecentEntry } from '../../lib/desktop/tauriStorage';
import type { EditorCore } from '../../lib/editor-core';
import { calculateDocumentStats } from '../../lib/outline/outlineService';
import { createEmptyExternalFileChange, type ExternalFileChangeState, type Tab } from '../types';
import { getDirectoryLabel } from '../utils/pathLabels';
import {
  exportMarkdownInBrowser,
  findDroppedMarkdownPath,
  getExternalFileChange,
  loadRecentEntries,
  openMarkdownFromDialog,
  readMarkdownFromPath,
  rememberNativeDocument,
  saveNativeMarkdownFile,
} from './documentFiles';
import { normalizeMarkdownForSave } from '../../lib/markdown/normalize';
import { createBlankTab, getNativeDocumentTargetTab, getOrCreateReusableTab } from './tabs';
import { t } from '../i18n';

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
  getExternalFileChange(): ExternalFileChangeState;
  setExternalFileChange(value: ExternalFileChangeState): void;
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
  getPreviewTabId(): string | null;
  setPreviewTabId(value: string | null): void;
  setStatusMessage(value: string): void;
  setRecentFiles(value: Awaited<ReturnType<typeof loadRecentEntries>>): void;
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
      options.setStatusMessage(t.dragDropNoMarkdown());
      return;
    }
    if (options.getDirty()) {
      options.writeRecoveryDraft('drag-open-blocked');
      options.setStatusMessage(t.dragOpenBlockedUnsaved());
      return;
    }

    const { document, error } = await readMarkdownFromPath(target, t.dragOpenFailed());
    if (error) {
      options.setStatusMessage(error);
    }
    if (document) {
      await applyNativeDocument(document, t.openedByDragDrop());
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
        await applyNativeDocument(document, t.openedByTauri());
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
    targetTab.filePath = t.localBrowserFile({ name: file.name });
    targetTab.nativePath = null;
    targetTab.markdown = text;
    targetTab.dirty = false;
    targetTab.lastKnownModifiedAt = 0;
    targetTab.largeDocumentMode = text.length > options.getLargeDocumentLimit();
    targetTab.readonlyDocumentMode = targetTab.largeDocumentMode;
    targetTab.externalFileChange = createEmptyExternalFileChange();

    options.setTabs([...options.getTabs()]);
    options.loadTabState(targetTab);

    options.setStatusMessage(t.markdownFileOpened());
    input.value = '';
  }

  async function saveMarkdownFile(saveAs = false) {
    const activeTab = options.getTabs().find((tab) => tab.id === options.getActiveTabId());
    if (activeTab?.largeDocumentMode && !saveAs) {
      options.setStatusMessage(t.largeDocumentReadonlySaveBlocked());
      return;
    }

    if (options.getDesktopEnabled()) {
      if (!saveAs && hasExternalFileChange()) {
        options.setStatusMessage(t.externalChangeChooseAction());
        return;
      }

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
        await applySavedNativeDocument(document, markdownToSave, t.savedByTauri());
      }
      return;
    }

    const markdownToSave = normalizeMarkdownForSave(options.getEditor().getMarkdown());
    exportMarkdownInBrowser(markdownToSave, options.getFileName());
    options.setStatusMessage(t.markdownExported());
    options.setMarkdown(markdownToSave);
    options.setDirty(false);
  }

  async function openRecentFile(path: string) {
    if (!options.getDesktopEnabled()) {
      return;
    }

    const { document, error } = await readMarkdownFromPath(path, t.openRecentFailed());
    if (error) {
      options.setStatusMessage(error);
    }

    if (document) {
      await applyNativeDocument(document, t.recentFileOpened());
    }
  }

  async function applyNativeDocument(document: NativeDocument, message: string, saved = false) {
    const isLargeDocument =
      document.markdown.length > options.getLargeDocumentLimit() ||
      document.sizeBytes > options.getLargeDocumentLimit();
    const existingTab = options.getTabs().find((tab) => tab.nativePath === document.path);
    if (existingTab && !saved) {
      // 预览标签再次通过“正式打开”路径打开时，升级为固定标签。
      if (existingTab.id === options.getPreviewTabId()) {
        options.setPreviewTabId(null);
      }
      options.switchTab(existingTab.id);
      options.setStatusMessage(t.switchedToOpenedTab());
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
    targetTab.externalFileChange = createEmptyExternalFileChange();

    options.setActiveTabId(targetTab.id);
    options.setTabs([...options.getTabs()]);
    options.loadTabState(targetTab);

    options.setStatusMessage(message);
    await rememberNativeDocument(document, calculateDocumentStats(document.markdown).words);
    await refreshRecentFiles();
    if (isLargeDocument) {
      options.setStatusMessage(t.largeDocumentReadonlyOpened());
    }

    await revealDocumentInExplorer(document.path);
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
    targetTab.externalFileChange = createEmptyExternalFileChange();

    options.setFileName(targetTab.fileName);
    options.setFilePath(targetTab.filePath);
    options.setNativePath(targetTab.nativePath);
    options.setMarkdown(markdownToSave);
    options.setDirty(false);
    options.setLastKnownModifiedAt(targetTab.lastKnownModifiedAt);
    options.setLargeDocumentMode(targetTab.largeDocumentMode);
    options.setReadonlyDocumentMode(targetTab.readonlyDocumentMode);
    options.setExternalFileChange(targetTab.externalFileChange);
    options.setTabs([...options.getTabs()]);

    options.setStatusMessage(message);
    await rememberNativeDocument(document, calculateDocumentStats(markdownToSave).words);
    await refreshRecentFiles();
    if (isLargeDocument) {
      options.setStatusMessage(t.largeDocumentReadonlyOpened());
    }

    await revealDocumentInExplorer(document.path);
  }

  async function revealDocumentInExplorer(documentPath: string) {
    const parentDir = getDirectoryLabel(documentPath);
    if (!parentDir || parentDir === t.currentFolder()) {
      return;
    }

    const currentFolderPath = options.getCurrentFolderPath();
    if (!currentFolderPath) {
      await options.loadFolder(parentDir).catch(() => undefined);
      return;
    }

    options.expandAncestors(documentPath, currentFolderPath);
  }

  function createNewFile() {
    if (options.getDirty()) {
      options.writeRecoveryDraft('new-file-blocked');
      options.setStatusMessage(t.newFileWithRecovery());
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
      const confirmClose = confirm(t.confirmCloseModifiedFile({ fileName: tabToClose.fileName }));
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

  async function reloadExternalFile() {
    const path = options.getNativePath();
    if (!options.getDesktopEnabled() || !path || !hasExternalFileChange()) {
      return;
    }

    const { document, error } = await readMarkdownFromPath(path, t.reloadExternalFailed());
    if (error) {
      options.setStatusMessage(error);
      return;
    }
    if (document) {
      await applyNativeDocument(document, t.reloadedExternalVersion(), true);
    }
  }

  async function overwriteExternalFile() {
    const path = options.getNativePath();
    if (!options.getDesktopEnabled() || !path) {
      return;
    }
    if (options.getExternalFileChange().type !== 'modified') {
      options.setStatusMessage(t.noExternalChangeToOverwrite());
      return;
    }

    const markdownToSave = normalizeMarkdownForSave(options.getEditor().getMarkdown());
    options.writeRecoveryDraft('before-overwrite-external');
    const { document, error } = await saveNativeMarkdownFile(
      path,
      markdownToSave,
      options.getFileName(),
      options.getCreateSnapshotBeforeSave() ? path : null,
    );
    if (error) {
      options.setStatusMessage(error);
    }
    if (document) {
      localStorage.removeItem(options.recoveryKey);
      await applySavedNativeDocument(document, markdownToSave, t.overwrittenExternalVersion());
    }
  }

  let saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  function debouncedAutoSave(currentMarkdown: string) {
    if (!options.getAutoSaveEnabled()) return;

    const tabId = options.getActiveTabId();
    const path = options.getNativePath();
    const fileName = options.getFileName();

    if (!tabId || !path) return;
    if (hasExternalFileChange()) {
      options.setStatusMessage(t.externalChangeAutoSavePaused());
      return;
    }

    if (saveTimers[tabId] !== undefined) {
      clearTimeout(saveTimers[tabId]);
    }

    saveTimers[tabId] = setTimeout(async () => {
      delete saveTimers[tabId];
      if (!options.getAutoSaveEnabled()) return;
      if (!options.getDesktopEnabled()) return;
      if (hasExternalFileChange()) {
        options.setStatusMessage(t.externalChangeAutoSavePaused());
        return;
      }

      const markdownToSave = normalizeMarkdownForSave(currentMarkdown);

      const { document, error } = await saveNativeMarkdownFile(
        path,
        markdownToSave,
        fileName,
        null,
      );

      if (error) {
        if (options.getActiveTabId() === tabId) {
          options.setStatusMessage(t.autoSaveFailed({ error }));
        }
        return;
      }

      if (document) {
        if (options.getActiveTabId() === tabId) {
          options.setStatusMessage(t.saved());
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
    const nextChange = await getExternalFileChange(
      options.getDesktopEnabled(),
      options.getNativePath(),
      options.getLastKnownModifiedAt(),
      options.getDirty(),
    );
    options.setExternalFileChange(nextChange);
    if (nextChange.type !== 'none') {
      cancelPendingAutoSaves();
      if (options.getDirty()) {
        options.setStatusMessage(t.externalChangeAutoSavePaused());
      }
    }
  }

  function hasExternalFileChange() {
    return options.getExternalFileChange().type !== 'none';
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
    reloadExternalFile,
    overwriteExternalFile,
    checkExternalFileChange,
    debouncedAutoSave,
    cancelPendingAutoSaves,
  };
}
