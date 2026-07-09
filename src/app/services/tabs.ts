import { createEmptyExternalFileChange, type ExternalFileChangeState, type Tab } from '../types';
import { t } from '../i18n';

export interface ActiveTabState {
  fileName: string;
  filePath: string;
  nativePath: string | null;
  markdown: string;
  savedMarkdown: string;
  dirty: boolean;
  lastKnownModifiedAt: number;
  largeDocumentMode: boolean;
  readonlyDocumentMode: boolean;
  diskReadonly: boolean;
  externalFileChange: ExternalFileChangeState;
  version: number;
}

export function createBlankTab(fileName = 'untitled.md', filePath = t.untitledMarkdown()): Tab {
  return {
    id: createTabId(),
    fileName,
    filePath,
    nativePath: null,
    draftId: null,
    markdown: '',
    savedMarkdown: '',
    dirty: false,
    lastKnownModifiedAt: 0,
    largeDocumentMode: false,
    readonlyDocumentMode: false,
    diskReadonly: false,
    externalFileChange: createEmptyExternalFileChange(),
    version: 0,
  };
}

export function getOrCreateReusableTab(tabs: Tab[], activeTabId: string) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  if (isReusableUntitledTab(activeTab)) {
    return { tabs, activeTabId, targetTab: activeTab };
  }

  const newTab = createBlankTab('', '');
  return { tabs: [...tabs, newTab], activeTabId: newTab.id, targetTab: newTab };
}

export function getNativeDocumentTargetTab(
  tabs: Tab[],
  activeTabId: string,
  existingTab: Tab | undefined,
  saved: boolean,
) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  if (isReusableUntitledTab(activeTab)) {
    return { tabs, activeTabId, targetTab: activeTab };
  }
  if (saved) {
    if (existingTab) {
      return { tabs, activeTabId, targetTab: existingTab };
    }
    const activeTabForSave = tabs.find((tab) => tab.id === activeTabId);
    // 保存或另存为成功后，当前保存源标签页绑定到返回的磁盘路径，避免重复创建标签页。
    if (activeTabForSave) {
      return { tabs, activeTabId, targetTab: activeTabForSave };
    }
  }

  const newTab = createBlankTab('', '');
  return { tabs: [...tabs, newTab], activeTabId: newTab.id, targetTab: newTab };
}

export function isReusableUntitledTab(tab: Tab | undefined): tab is Tab {
  return Boolean(
    tab &&
    tab.fileName === 'untitled.md' &&
    !tab.dirty &&
    tab.markdown.trim() === '' &&
    !tab.nativePath,
  );
}

export function writeActiveTabState(tabs: Tab[], activeTabId: string, state: ActiveTabState) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  if (!activeTab) {
    return tabs;
  }

  Object.assign(activeTab, state);
  return [...tabs];
}

function createTabId() {
  return 'tab-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
}
