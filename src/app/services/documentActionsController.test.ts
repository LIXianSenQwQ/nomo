import { describe, expect, it, vi, afterEach } from 'vitest';
import type { NativeDocument } from '../../lib/desktop/tauriStorage';
import type { Tab } from '../types';
import { createEmptyExternalFileChange } from '../types';
import { createDocumentActionsController } from './documentActionsController';
import { confirmAction } from './confirmAction';
import { saveNativeMarkdownFile } from './documentFiles';

vi.mock('./confirmAction', () => ({
  confirmAction: vi.fn(),
}));

vi.mock('./documentFiles', () => ({
  exportMarkdownInBrowser: vi.fn(),
  findDroppedMarkdownPath: vi.fn(),
  getExternalFileChange: vi.fn().mockResolvedValue({
    type: 'none',
    path: null,
    modifiedAt: 0,
    dirtyAtDetection: false,
    message: '',
  }),
  loadRecentEntries: vi.fn().mockResolvedValue([]),
  openMarkdownFromDialog: vi.fn(),
  readMarkdownFromPath: vi.fn(),
  rememberNativeDocument: vi.fn(),
  saveNativeMarkdownFile: vi.fn(),
}));

function createTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: 'tab-1',
    fileName: 'old.md',
    filePath: 'C:/docs/old.md',
    nativePath: 'C:/docs/old.md',
    draftId: null,
    markdown: '# Old\n\nchanged',
    savedMarkdown: '# Old',
    dirty: true,
    lastKnownModifiedAt: 1,
    largeDocumentMode: false,
    readonlyDocumentMode: false,
    externalFileChange: createEmptyExternalFileChange(),
    version: 1,
    ...overrides,
  };
}

function createOptions(initialTabs: Tab[]) {
  let tabs = initialTabs;
  let activeTabId = tabs[0]?.id ?? '';
  let statusMessage = '';
  let nativePath = tabs[0]?.nativePath ?? null;
  let fileName = tabs[0]?.fileName ?? 'old.md';
  let filePath = tabs[0]?.filePath ?? 'C:/docs/old.md';
  let savedMarkdown = tabs[0]?.savedMarkdown ?? '';
  let lastKnownModifiedAt = tabs[0]?.lastKnownModifiedAt ?? 0;
  let dirty = tabs[0]?.dirty ?? false;

  return {
    options: {
      recoveryKey: 'test-recovery',
      getLargeDocumentLimit: () => 100_000,
      getAutoSaveDelayMs: () => 50,
      getCreateSnapshotBeforeSave: () => false,
      getDesktopEnabled: () => true,
      getDirty: () => dirty,
      getAutoSaveEnabled: () => true,
      getNativePath: () => nativePath,
      setMarkdown: vi.fn(),
      setSavedMarkdown: (value: string) => {
        savedMarkdown = value;
      },
      setNativePath: (value: string | null) => {
        nativePath = value;
      },
      getFileName: () => fileName,
      setFileName: (value: string) => {
        fileName = value;
      },
      getFilePath: () => filePath,
      setFilePath: (value: string) => {
        filePath = value;
      },
      getLastKnownModifiedAt: () => lastKnownModifiedAt,
      setLastKnownModifiedAt: (value: number) => {
        lastKnownModifiedAt = value;
      },
      getExternalFileChange: () => createEmptyExternalFileChange(),
      setExternalFileChange: vi.fn(),
      setDirty: (value: boolean) => {
        dirty = value;
      },
      setLargeDocumentMode: vi.fn(),
      setReadonlyDocumentMode: vi.fn(),
      getCurrentFolderPath: () => '',
      getFileInput: () => document.createElement('input'),
      getEditor: () => ({
        getMarkdown: () => '# New Title\n\nchanged',
        setDirty: vi.fn(),
      }),
      getTabs: () => tabs,
      setTabs: (value: Tab[]) => {
        tabs = value;
      },
      getActiveTabId: () => activeTabId,
      setActiveTabId: (value: string) => {
        activeTabId = value;
      },
      getPreviewTabId: () => null,
      setPreviewTabId: vi.fn(),
      setStatusMessage: (value: string) => {
        statusMessage = value;
      },
      setRecentFiles: vi.fn(),
      saveActiveTabState: vi.fn(),
      loadTabState: vi.fn(),
      switchTab: vi.fn(),
      writeRecoveryDraft: vi.fn(),
      updateWindowTitle: vi.fn(),
      loadFolder: vi.fn(),
      expandAncestors: vi.fn(),
    },
    getState: () => ({
      tabs,
      activeTabId,
      fileName,
      filePath,
      nativePath,
      savedMarkdown,
      lastKnownModifiedAt,
      dirty,
      statusMessage,
    }),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('documentActionsController', () => {
  it('关闭脏标签时，如果保存失败则保留标签页', async () => {
    const tab = createTab();
    const { options, getState } = createOptions([tab]);
    vi.mocked(confirmAction).mockResolvedValue('save');
    vi.mocked(saveNativeMarkdownFile).mockResolvedValue({
      document: null,
      error: 'disk full',
    });

    const controller = createDocumentActionsController(options as any);
    await controller.closeTab(tab.id);

    expect(getState().tabs).toHaveLength(1);
    expect(getState().tabs[0].id).toBe(tab.id);
    expect(getState().statusMessage).toBe('disk full');
  });

  it('自动保存只写回当前路径，不根据 H1 隐式重命名文件', async () => {
    vi.useFakeTimers();
    const tab = createTab();
    const { options, getState } = createOptions([tab]);
    const document: NativeDocument = {
      path: 'C:/docs/old.md',
      fileName: 'old.md',
      markdown: '# New Title\n\nchanged',
      modifiedAt: 2,
      sizeBytes: 21,
      readonly: false,
    };
    vi.mocked(saveNativeMarkdownFile).mockResolvedValue({ document, error: '' });

    const controller = createDocumentActionsController(options as any);
    controller.debouncedAutoSave('# New Title\n\nchanged');
    await vi.advanceTimersByTimeAsync(50);

    expect(saveNativeMarkdownFile).toHaveBeenCalledWith(
      'C:/docs/old.md',
      '# New Title\n\nchanged\n\n',
      'old.md',
      null,
    );
    expect(getState().tabs[0].nativePath).toBe('C:/docs/old.md');
    expect(getState().tabs[0].fileName).toBe('old.md');
    expect(getState().nativePath).toBe('C:/docs/old.md');
    expect(getState().fileName).toBe('old.md');
  });
});
