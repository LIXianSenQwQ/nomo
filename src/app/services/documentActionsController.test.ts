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
    diskReadonly: false,
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
  let largeDocumentMode = tabs[0]?.largeDocumentMode ?? false;
  let readonlyDocumentMode = tabs[0]?.readonlyDocumentMode ?? false;
  let diskReadonly = tabs[0]?.diskReadonly ?? false;
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
      setLargeDocumentMode: (value: boolean) => {
        largeDocumentMode = value;
      },
      setReadonlyDocumentMode: (value: boolean) => {
        readonlyDocumentMode = value;
      },
      setDiskReadonly: (value: boolean) => {
        diskReadonly = value;
      },
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
      loadTabState: (tab: Tab) => {
        activeTabId = tab.id;
        nativePath = tab.nativePath;
        fileName = tab.fileName;
        filePath = tab.filePath;
        savedMarkdown = tab.savedMarkdown;
        lastKnownModifiedAt = tab.lastKnownModifiedAt;
        largeDocumentMode = tab.largeDocumentMode;
        readonlyDocumentMode = tab.readonlyDocumentMode;
        diskReadonly = tab.diskReadonly;
        dirty = tab.dirty;
      },
      switchTab: vi.fn(),
      writeRecoveryDraft: vi.fn(),
      updateWindowTitle: vi.fn(),
      loadFolder: vi.fn().mockResolvedValue(undefined),
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
      largeDocumentMode,
      readonlyDocumentMode,
      diskReadonly,
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

  it('打开小型只读磁盘文件时保持编辑器可编辑并记录磁盘只读', async () => {
    const tab = createTab({
      dirty: false,
      nativePath: null,
      fileName: 'untitled.md',
      filePath: '未命名 Markdown',
    });
    const { options, getState } = createOptions([tab]);
    const document: NativeDocument = {
      path: 'C:/docs/readonly.md',
      fileName: 'readonly.md',
      markdown: '# Readonly\n\ncontent',
      modifiedAt: 2,
      sizeBytes: 20,
      readonly: true,
    };

    const controller = createDocumentActionsController(options as any);
    await controller.applyNativeDocument(document, 'opened');

    const activeTab = getState().tabs.find((tab) => tab.id === getState().activeTabId);
    expect(activeTab).toMatchObject({
      nativePath: 'C:/docs/readonly.md',
      diskReadonly: true,
      largeDocumentMode: false,
      readonlyDocumentMode: false,
    });
    expect(getState().diskReadonly).toBe(true);
    expect(getState().readonlyDocumentMode).toBe(false);
  });

  it('普通保存只读源文件时走另存为，不写回原路径', async () => {
    const tab = createTab({ diskReadonly: true });
    const { options, getState } = createOptions([tab]);
    const document: NativeDocument = {
      path: 'C:/docs/new.md',
      fileName: 'new.md',
      markdown: '# New Title\n\nchanged\n\n',
      modifiedAt: 2,
      sizeBytes: 23,
      readonly: false,
    };
    vi.mocked(saveNativeMarkdownFile).mockResolvedValue({ document, error: '' });

    const controller = createDocumentActionsController(options as any);
    const saved = await controller.saveMarkdownFile(false);

    expect(saved).toBe(true);
    expect(saveNativeMarkdownFile).toHaveBeenCalledWith(
      null,
      '# New Title\n\nchanged\n\n',
      'New Title.md',
      null,
    );
    expect(getState().nativePath).toBe('C:/docs/new.md');
    expect(getState().fileName).toBe('new.md');
    expect(getState().dirty).toBe(false);
    expect(getState().diskReadonly).toBe(false);
    expect(getState().tabs[0].diskReadonly).toBe(false);
  });

  it('只读源文件另存为取消后保留 dirty、原路径和 diskReadonly', async () => {
    const tab = createTab({ diskReadonly: true });
    const { options, getState } = createOptions([tab]);
    vi.mocked(saveNativeMarkdownFile).mockResolvedValue({ document: null, error: '' });

    const controller = createDocumentActionsController(options as any);
    const saved = await controller.saveMarkdownFile(false);

    expect(saved).toBe(false);
    expect(saveNativeMarkdownFile).toHaveBeenCalledWith(
      null,
      '# New Title\n\nchanged\n\n',
      'New Title.md',
      null,
    );
    expect(getState().nativePath).toBe('C:/docs/old.md');
    expect(getState().fileName).toBe('old.md');
    expect(getState().dirty).toBe(true);
    expect(getState().diskReadonly).toBe(true);
    expect(getState().tabs[0].diskReadonly).toBe(true);
  });

  it('自动保存只读源文件时不写磁盘且保持 dirty', async () => {
    vi.useFakeTimers();
    const tab = createTab({ diskReadonly: true });
    const { options, getState } = createOptions([tab]);

    const controller = createDocumentActionsController(options as any);
    controller.debouncedAutoSave('# New Title\n\nchanged');
    await vi.advanceTimersByTimeAsync(50);

    expect(saveNativeMarkdownFile).not.toHaveBeenCalled();
    expect(getState().dirty).toBe(true);
    expect(getState().tabs[0].dirty).toBe(true);
    expect(getState().statusMessage).toBe(
      'Auto-save is paused because the source file is read-only. Use Save as to keep the current content.',
    );
  });
});
