import type { Tab } from '../types';

export interface ActiveTabState {
  fileName: string;
  filePath: string;
  nativePath: string | null;
  markdown: string;
  dirty: boolean;
  lastKnownModifiedAt: number;
  largeDocumentMode: boolean;
  readonlyDocumentMode: boolean;
  externalFileWarning: string;
  version: number;
}

export function createDefaultTab(markdown: string): Tab {
  return {
    id: 'default',
    fileName: '阶段3样例.md',
    filePath: 'D:\\Demo\\NewMd\\阶段3样例.md',
    nativePath: null,
    markdown,
    dirty: false,
    lastKnownModifiedAt: 0,
    largeDocumentMode: false,
    readonlyDocumentMode: false,
    externalFileWarning: '',
    version: 0,
  };
}

export function createBlankTab(fileName = 'untitled.md', filePath = '无标题.md'): Tab {
  return {
    id: createTabId(),
    fileName,
    filePath,
    nativePath: null,
    markdown: '',
    dirty: false,
    lastKnownModifiedAt: 0,
    largeDocumentMode: false,
    readonlyDocumentMode: false,
    externalFileWarning: '',
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
  if (existingTab && saved) {
    return { tabs, activeTabId, targetTab: existingTab };
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
