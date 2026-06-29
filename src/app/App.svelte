<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import {
    listenDesktopFileDrops,
    listenDesktopMenuCommands,
    listenDesktopOpenDocuments,
    listenDesktopOpenFolder,
    isTauriRuntime,
    listAppSettings,
    installSampleDocument,
    openExternalLink,
    updateAppSetting,
    updateAppSettings,
    readWorkspaceDraft,
    deleteWorkspaceDraft,
    rememberRecentEntry,
    checkPathsExist,
    deleteFile,
    revealInExplorer,
    type RecentEntry,
    type RecentEntryType,
    clearRecentEntries,
  } from '../lib/desktop/tauriStorage';
  import {
    createEditorCore,
    getImageLoader,
    setCodeBlockDiagramRenderer,
    setCodeBlockMathRenderer,
    setCodeBlockTokenizer,
    setImageLoader,
    type EditorChangeEvent,
    type EditorCommand,
    type EditorAnchorRect,
    type EditorImageDeletionEvent,
    type InlinePendingMarks,
    type EditorMode,
    type EditorSearchMatch,
  } from '../lib/editor-core';
  import {
    analyzeMarkdown,
    type DocumentStats,
    type OutlineItem,
  } from '../lib/outline/outlineService';
  import {
    extractFrontMatterBlock,
    removeFrontMatter,
    replaceFrontMatterContent,
    type FrontMatterBlock,
  } from '../lib/markdown/frontMatter';
  import AppShell from './components/AppShell.svelte';
  import FolderOpenDialog from './components/FolderOpenDialog.svelte';
  import {
    createEmptyExternalFileChange,
    normalizeExternalFileChange,
    type ExternalFileChangeState,
    type FileTreeNode,
    type PersistedWorkspaceState,
    type PersistedWorkspaceTab,
    type Tab,
  } from './types';
  import {
    getCompactPath,
    getDirectoryLabel,
    getFolderName,
    sameNativePath,
    pathEqualsOrDescendsFrom,
  } from './utils/pathLabels';
  import {
    executeDesktopCommand as executeDesktopAppCommand,
    handleGlobalShortcut as handleGlobalAppShortcut,
    type AppCommandHandlers,
  } from './services/appCommands';
  import {
    closeAppWindow as closeDesktopWindow,
    createAppWindow,
    exitApp as exitDesktopApp,
    getDesktopSystemTheme,
    maximizeAppWindow,
    minimizeAppWindow,
    openSettingsWindow,
    refreshInterfaceLanguageChrome,
    setDesktopIconTheme,
    updateAppWindowTitle,
  } from './services/desktopWindow';
  import { createImageInsertionHandlers } from './services/imageInsertion';
  import { createDesktopImageLoader } from './services/desktopImageLoader';
  import { isOutlineItemVisible as getOutlineItemVisible } from './services/outlineState';
  import { writeRecoveryDraft as writeRecoveryDraftToStorage } from './services/recoveryDraft';
  import { createBlankTab, writeActiveTabState } from './services/tabs';
  import {
    createPersistedWorkspaceState,
    createRuntimeTabFromPersisted,
    migrateWorkspaceSetting,
    persistWorkspaceDrafts,
    type WorkspaceDraftPersistenceCache,
  } from './services/workspacePersistence';
  import {
    listenFolderIndexBatches,
    listenFolderIndexFinished,
    readMarkdownFromPath,
    rememberNativeFolder,
    pickFolderPath,
  } from './services/documentFiles';
  import {
    closeActiveMenu,
    createSidebarResizeHandlers,
    getNextActiveMenu,
  } from './services/appUiState';
  import { createEditorSettingsController } from './services/editorSettingsController';
  import ContextMenu from './components/ContextMenu.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import UnsavedConfirmDialog from './components/UnsavedConfirmDialog.svelte';
  import ExternalChangeDialog from './components/ExternalChangeDialog.svelte';
  import CloseWindowBehaviorDialog from './components/CloseWindowBehaviorDialog.svelte';
  import type {
    ContextMenuOpenEvent,
    ContextMenuItem,
  } from '../lib/editor-core/plugins/contextMenu';
  import {
    DEFAULT_APP_PREFERENCES,
    SETTINGS_UPDATED_EVENT,
    applyBlockStyleSetting,
    applyCodeBlockLineNumberSetting,
    applyEditorLayoutSettings,
    applyThemeSetting,
    applyTypographySettings,
    applyZoomSetting,
    loadAppPreferences,
    normalizeAppPreferences,
    resolveThemePreference,
    type AppPreferences,
    type AppPreferencesPatch,
    type CloseWindowBehavior,
    type CodeBlockIndentPreference,
    type InterfaceLanguagePreference,
    type SettingsUpdatedPayload,
    type ShortcutPreferences,
    type ThemePreference,
  } from './services/settings';
  import { applyInterfaceLanguagePreference, t, type EffectiveInterfaceLocale } from './i18n';
  import { createFolderExplorerController } from './services/folderExplorerController';
  import { createDocumentActionsController } from './services/documentActionsController';
  import {
    FIRST_RUN_SAMPLE_DOCUMENT_OPEN_ERROR_KEY,
    FIRST_RUN_SAMPLE_DOCUMENT_OPENED_KEY,
    shouldMarkFirstRunSampleHandled,
    shouldOpenFirstRunSample,
    type FirstRunSampleState,
  } from './services/firstRunSample';
  import { createOutlineInteractionController } from './services/outlineInteractionController';
  import { createEditorInteractionController } from './services/editorInteractionController';
  import {
    confirmAction,
    confirmDialogStore,
    resolveConfirmDialog,
    dismissConfirmDialog,
    type ConfirmDialogState,
  } from './services/confirmAction';
  import {
    getSemanticScrollAnchor,
    getSourceScrollAnchor,
    restoreSemanticReadingPosition,
    restoreSourceReadingPosition,
    setScrollTop,
    type OutlineScrollAnchor,
  } from './services/outlineNavigation';
  import {
    flushReadingPositions,
    getReadingPosition,
    loadReadingPositions,
    saveReadingPositionToMemory,
    saveReadingPositionToMemoryOnly,
    type ReadingPositionMode,
  } from './services/readingPosition';
  import {
    findTextMatches,
    replaceAllTextMatches,
    replaceTextRange,
  } from './services/searchReplace';
  import { createKatexMathRenderer } from '../lib/services/katexMathRenderer';
  import { createMermaidDiagramRenderer } from '../lib/services/mermaidDiagramRenderer';
  import { createShikiCodeTokenizer } from '../lib/services/shikiCodeTokenizer';
  import {
    DEFAULT_IMAGE_HANDLING_SETTINGS,
    type ImageContext,
    type ImageHandlingSettings,
  } from '../lib/services/render';
  import { disableLogger, enableLogger, logInfo } from '../lib/services/logger';

  const RECOVERY_KEY = 'nomo-save-recovery';
  type WritingStatsMetric = 'lines' | 'words' | 'chars';
  type CloseWindowAction = Exclude<CloseWindowBehavior, 'ask-every-time'>;
  type CloseWindowChoiceResult = { behavior: CloseWindowAction; remember: boolean } | null;

  function logCloseDiagnostics(message: string, data?: Record<string, unknown>) {
    logInfo('CloseGuard', message, data);
    // eslint-disable-next-line no-console
    console.info('[CloseGuard]', message, data ?? '');
  }

  setCodeBlockTokenizer(createShikiCodeTokenizer());
  setCodeBlockDiagramRenderer(createMermaidDiagramRenderer());
  setCodeBlockMathRenderer(createKatexMathRenderer());
  setImageLoader(createDesktopImageLoader());

  let markdown = '',
    savedMarkdown = '',
    dirty = false,
    version = 0;
  let mode: EditorMode = DEFAULT_APP_PREFERENCES.editorMode;
  let themePreference: ThemePreference = DEFAULT_APP_PREFERENCES.theme;
  let theme: 'light' | 'dark' = resolveThemePreference(themePreference);
  let interfaceLanguage: InterfaceLanguagePreference = DEFAULT_APP_PREFERENCES.interfaceLanguage;
  let interfaceLocale: EffectiveInterfaceLocale =
    applyInterfaceLanguagePreference(interfaceLanguage);
  let fileName = '',
    filePath = '';
  let nativePath: string | null = null;
  let statusMessage = '';
  let desktopEnabled = false;
  let recentFiles: RecentEntry[] = [];
  let missingRecentPaths = new Set<string>();
  let outline: OutlineItem[] = [];
  let outlineVisible = DEFAULT_APP_PREFERENCES.outlineVisible,
    activeOutlineId = outline[0]?.id ?? '';
  let collapsedOutlineIds = new Set<string>();
  let visibleOutlineIds = new Set(outline.map((item) => item.id));
  let suppressOutlineScrollUntil = 0;
  let stats: DocumentStats = analyzeMarkdown('').stats;
  let writingStatsVisible = DEFAULT_APP_PREFERENCES.writingStatsVisible;
  let writingStatsMetric: WritingStatsMetric = DEFAULT_APP_PREFERENCES.writingStatsMetric;
  let readingTimeVisible = DEFAULT_APP_PREFERENCES.readingTimeVisible;
  let fontSize = DEFAULT_APP_PREFERENCES.fontSize,
    lineHeight = DEFAULT_APP_PREFERENCES.lineHeight,
    contentWidthPercent = DEFAULT_APP_PREFERENCES.contentWidthPercent,
    focusMode = DEFAULT_APP_PREFERENCES.sidebarHidden,
    blockStyle: 'classic' | 'modern' = DEFAULT_APP_PREFERENCES.blockStyle;
  let largeDocumentLimit = DEFAULT_APP_PREFERENCES.largeDocumentLimit;
  let autoSaveDelayMs = DEFAULT_APP_PREFERENCES.autoSaveDelayMs;
  let createSnapshotBeforeSave = DEFAULT_APP_PREFERENCES.createSnapshotBeforeSave;
  let defaultCodeBlockLanguage = DEFAULT_APP_PREFERENCES.defaultCodeBlockLanguage;
  let defaultDiagramType = DEFAULT_APP_PREFERENCES.defaultDiagramType;
  let zoomPercent = DEFAULT_APP_PREFERENCES.zoomPercent;
  let ctrlWheelZoomEnabled = DEFAULT_APP_PREFERENCES.ctrlWheelZoomEnabled;
  let outlineDefaultExpandLevel = DEFAULT_APP_PREFERENCES.outlineDefaultExpandLevel;
  let codeBlockLineNumbersVisible = DEFAULT_APP_PREFERENCES.codeBlockLineNumbersVisible;
  let codeBlockIndent: CodeBlockIndentPreference = DEFAULT_APP_PREFERENCES.codeBlockIndent;
  let inlineCodeRenderingEnabled = DEFAULT_APP_PREFERENCES.inlineCodeRenderingEnabled;
  let shortcutPreferences: ShortcutPreferences = { ...DEFAULT_APP_PREFERENCES.shortcutPreferences };
  let imageSettings: ImageHandlingSettings = { ...DEFAULT_IMAGE_HANDLING_SETTINGS };
  let folderOpenDefaultBehavior: 'current-window' | 'new-window' | 'ask-every-time' =
    DEFAULT_APP_PREFERENCES.folderOpenDefaultBehavior;
  let folderOpenDialogPath: string | null = null;
  let folderOpenDialogName = '';
  let editorHost: HTMLDivElement,
    fileInput: HTMLInputElement,
    sourceTextarea: HTMLTextAreaElement,
    semanticPane: HTMLElement,
    sourcePane: HTMLElement;
  let mountedEditorHost: HTMLDivElement | null = null;
  let pendingSourceScrollTop: number | null = null;
  let refreshEditorViewportLayout: () => void = () => undefined;
  let largeDocumentMode = false,
    readonlyDocumentMode = false,
    externalFileChange: ExternalFileChangeState = createEmptyExternalFileChange(),
    lastKnownModifiedAt = 0;
  let desktopUnlisteners: Array<() => void> = [];
  let criticalDesktopEventsReady = false;
  let pendingExternalOpenPaths: string[] = [];
  let currentFolderPath = '',
    folderTree: FileTreeNode[] = [];
  let startupFolderPath = '';
  let startupFolderLoadScheduled = false;
  let startupFolderLoadInProgress = false;
  let expandedFolders = new Set<string>();
  let tablePickerOpen = false;
  let linkPickerOpen = false;
  let linkText = '';
  let linkHref = '';
  let linkError = '';
  let linkCanRemove = false;
  let linkDraftTitle: string | null = null;
  let linkPickerPositionStyle = '';
  let linkOpening = false;
  let linkOpeningTimer: number | null = null;
  let linkOpeningToken = 0;
  let toastMessage = '';
  let toastTimer: number | null = null;
  let pendingInlineMarks: InlinePendingMarks = createEmptyPendingInlineMarks();
  let frontMatterEditing = false;
  let frontMatterFocusRequest = 0;
  let scrollDebounceTimer: number | null = null;
  let readingPositionRestoreToken = 0;
  let skipNextReadingPositionRestore = false;
  let skipReadingPositionRestoreUntil = 0;
  let frontMatterFocusTarget: 'default' | 'title-value' = 'default';
  let frontMatter: FrontMatterBlock | null = extractFrontMatterBlock(markdown);
  let searchPanelOpen = false;
  let searchReplaceVisible = false;
  let searchQuery = '';
  let searchReplacement = '';
  let searchCaseSensitive = false;
  let searchMatches: EditorSearchMatch[] = [];
  let searchActiveIndex = 0;
  let searchMatchCount = 0;
  let lastSearchSignature = '';

  // 上下文菜单状态
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuItems: ContextMenuItem[] = [];
  let contextMenuOpen = false;

  // 删除确认对话框状态
  let deleteConfirmOpen = false;
  let deleteConfirmPath = '';
  let deleteConfirmIsDir = false;
  let deleteConfirmName = '';
  // 外部文件变更弹框状态
  let externalChangeDialogOpen = false;
  let externalChangeDialogState: ExternalFileChangeState | null = null;

  let closeWindowChoiceDialogOpen = false;
  let rememberCloseWindowChoice = true;
  let closeWindowChoiceResolver: ((choice: CloseWindowChoiceResult) => void) | null = null;
  let closeWindowChoicePromise: Promise<CloseWindowChoiceResult> | null = null;

  interface StartupDraftConflict {
    tabId: string;
    fileName: string;
    filePath: string;
    nativePath: string;
    draftId: string;
    draftMarkdown: string;
    diskMarkdown: string;
    diskModifiedAt: number;
    diskReadonly: boolean;
    diskLargeDocumentMode: boolean;
  }

  let startupDraftConflict: StartupDraftConflict | null = null;

  // 订阅自定义确认对话框（Svelte 5 Runes 模式 $store 语法不工作，需手动订阅）
  let confirmDialogState: ConfirmDialogState = {
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Discard',
    cancelLabel: 'Cancel',
    saveLabel: '',
  };
  const _unsubConfirmStore = confirmDialogStore.subscribe((v) => {
    confirmDialogState = v;
  });

  let tabs: Tab[] = [];
  let activeTabId = '';
  let previewTabId: string | null = null;

  type AppBootState = 'booting' | 'restoring-workspace' | 'opening-file' | 'ready';
  let appBootState: AppBootState = 'booting';
  let filePreviewEnabled = DEFAULT_APP_PREFERENCES.filePreviewEnabled;
  let autoSaveEnabled = DEFAULT_APP_PREFERENCES.autoSaveEnabled;
  let closeWindowBehavior = DEFAULT_APP_PREFERENCES.closeWindowBehavior;
  let windowLabel = '';
  let developerMode = DEFAULT_APP_PREFERENCES.developerMode;

  function hasPersistableReadingPositionPath(path: string) {
    return Boolean(desktopEnabled && path && path !== t.untitledMarkdown());
  }

  // 防抖持久化工作区状态，避免每次按键都触发两次 IPC 调用 + 磁盘写入
  let _persistTimer: number | null = null;
  let _workspaceDraftTimer: number | null = null;
  let _workspaceDraftWritePromise: Promise<void> | null = null;
  const WORKSPACE_PERSIST_DEBOUNCE_MS = 500;
  const WORKSPACE_DRAFT_PERSIST_DEBOUNCE_MS = 2000;
  const workspaceDraftPersistenceCache: WorkspaceDraftPersistenceCache = new Map();
  const lastPersistedWorkspaceJsonByKey = new Map<string, string>();

  function persistWorkspaceState() {
    if (!desktopEnabled || !windowLabel) return;

    if (_persistTimer !== null) {
      window.clearTimeout(_persistTimer);
    }

    _persistTimer = window.setTimeout(() => {
      _persistTimer = null;
      persistWorkspaceStateNow().catch(() => undefined);
    }, WORKSPACE_PERSIST_DEBOUNCE_MS);
  }

  /** 立即刷新待持久化的工作区状态（用于关闭窗口/退出应用等场景） */
  async function flushPersistWorkspaceState() {
    if (_persistTimer !== null) {
      window.clearTimeout(_persistTimer);
      _persistTimer = null;
    }
    if (!desktopEnabled || !windowLabel) return;
    await persistWorkspaceDraftsNow('changed');
    await persistWorkspaceStateNow({ ensureDraftIds: false });
  }

  async function persistWorkspaceStateNow(options?: { ensureDraftIds?: boolean }) {
    if (!desktopEnabled || !windowLabel) return;
    if (options?.ensureDraftIds !== false) {
      await persistWorkspaceDraftsNow('missing-only');
    }
    const state = await createPersistedWorkspaceState({
      tabs,
      activeTabId,
      currentFolderPath,
      desktopEnabled,
      preservedDraftIds: getPendingStartupConflictDraftIds(),
      draftWritePolicy: 'skip',
    });
    const workspaceEntries: Record<string, unknown> = {
      [`workspaceTabs:${windowLabel}`]: state,
    };
    if (currentFolderPath) {
      workspaceEntries[`workspaceTabs:folder:${currentFolderPath}`] = state;
    }
    await updateWorkspaceStateSettings(workspaceEntries);
  }

  async function persistFolderWorkspaceState(
    folderPath: string,
    folderTabs: Tab[],
    folderActiveTabId: string,
  ) {
    if (!desktopEnabled || !folderPath || !windowLabel) return;
    const state = await createPersistedWorkspaceState({
      tabs: folderTabs,
      activeTabId: folderActiveTabId,
      currentFolderPath: folderPath,
      desktopEnabled,
      preservedDraftIds: getPendingStartupConflictDraftIds(),
      draftWritePolicy: 'missing-only',
    });
    await updateWorkspaceStateSettings({ [`workspaceTabs:folder:${folderPath}`]: state });
  }

  function schedulePersistWorkspaceDrafts() {
    if (!desktopEnabled || !windowLabel) return;
    if (_workspaceDraftTimer !== null) {
      window.clearTimeout(_workspaceDraftTimer);
    }
    _workspaceDraftTimer = window.setTimeout(() => {
      _workspaceDraftTimer = null;
      persistWorkspaceDraftsNow('changed')
        .then((result) => {
          if (result.changedDraftIds) {
            persistWorkspaceState();
          }
        })
        .catch(() => undefined);
    }, WORKSPACE_DRAFT_PERSIST_DEBOUNCE_MS);
  }

  async function persistWorkspaceDraftsNow(policy: 'changed' | 'missing-only') {
    if (policy === 'changed' && _workspaceDraftTimer !== null) {
      window.clearTimeout(_workspaceDraftTimer);
      _workspaceDraftTimer = null;
    }
    if (_workspaceDraftWritePromise) {
      await _workspaceDraftWritePromise;
    }

    let result = { changed: false, changedDraftIds: false };
    _workspaceDraftWritePromise = persistWorkspaceDrafts({
      tabs,
      desktopEnabled,
      policy,
      preservedDraftIds: getPendingStartupConflictDraftIds(),
      cache: workspaceDraftPersistenceCache,
    })
      .then((value) => {
        result = value;
      })
      .catch(() => undefined);

    try {
      await _workspaceDraftWritePromise;
      return result;
    } finally {
      _workspaceDraftWritePromise = null;
    }
  }

  async function updateWorkspaceStateSettings(entries: Record<string, unknown>) {
    const changedEntries: Record<string, unknown> = {};
    const changedJsonByKey = new Map<string, string>();

    for (const [key, value] of Object.entries(entries)) {
      const nextJson = JSON.stringify(value);
      if (lastPersistedWorkspaceJsonByKey.get(key) === nextJson) {
        continue;
      }
      changedEntries[key] = value;
      changedJsonByKey.set(key, nextJson);
    }

    if (Object.keys(changedEntries).length === 0) {
      return;
    }

    try {
      await updateAppSettings(changedEntries);
    } catch {
      return;
    }
    for (const [key, json] of changedJsonByKey.entries()) {
      lastPersistedWorkspaceJsonByKey.set(key, json);
    }
  }

  function getPendingStartupConflictDraftIds() {
    return startupDraftConflict ? new Set([startupDraftConflict.draftId]) : undefined;
  }

  async function restoreFolderWorkspaceState(folderPath: string) {
    if (!desktopEnabled || !folderPath) return;
    const settings = await listAppSettings().catch(() => []);
    const setting = settings.find((s) => s.key === `workspaceTabs:folder:${folderPath}`);
    if (!setting) return;
    const result = await migrateWorkspaceSetting(setting).catch(() => null);
    if (!result) return;
    if (result.migrated) {
      await updateAppSetting(`workspaceTabs:folder:${folderPath}`, result.state).catch(
        () => undefined,
      );
    }
    await restorePersistedWorkspaceState(result.state);
  }

  async function restorePersistedWorkspaceState(state: PersistedWorkspaceState) {
    if (typeof state.currentFolderPath === 'string' && state.currentFolderPath.length > 0) {
      currentFolderPath = state.currentFolderPath;
      startupFolderPath = state.currentFolderPath;
    }
    if (state.tabs.length === 0) return;

    const restoredTabs: Tab[] = [];
    for (const persistedTab of state.tabs) {
      const restoredTab = await restorePersistedWorkspaceTab(persistedTab);
      if (restoredTab) {
        restoredTabs.push(restoredTab);
      }
    }

    if (restoredTabs.length === 0) return;
    tabs = restoredTabs;
    activeTabId = tabs.some((tab) => tab.id === state.activeTabId) ? state.activeTabId : tabs[0].id;
    const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
    activeTabId = activeTab.id;
    loadTabState(activeTab);
  }

  async function restorePersistedWorkspaceTab(
    persistedTab: PersistedWorkspaceTab,
  ): Promise<Tab | null> {
    const draft = persistedTab.draftId
      ? await readWorkspaceDraft(persistedTab.draftId).catch(() => null)
      : null;

    if (!persistedTab.nativePath) {
      if (!draft) {
        return createRuntimeTabFromPersisted(persistedTab, '', {
          savedMarkdown: '',
          dirty: false,
          lastKnownModifiedAt: 0,
          largeDocumentMode: false,
          readonlyDocumentMode: false,
        });
      }
      return createRuntimeTabFromPersisted(persistedTab, draft.markdown, {
        savedMarkdown: '',
        dirty: true,
        lastKnownModifiedAt: 0,
        largeDocumentMode: draft.markdown.length > largeDocumentLimit,
        readonlyDocumentMode: draft.markdown.length > largeDocumentLimit,
      });
    }

    const { document, error } = await readMarkdownFromPath(
      persistedTab.nativePath,
      t.openRecentFailed(),
    );
    if (!document) {
      if (draft) {
        statusMessage = error || t.openRecentFailed();
        return createRuntimeTabFromPersisted(persistedTab, draft.markdown, {
          savedMarkdown: '',
          dirty: true,
          largeDocumentMode: draft.markdown.length > largeDocumentLimit,
          readonlyDocumentMode: draft.markdown.length > largeDocumentLimit,
        });
      }
      statusMessage = error || t.openRecentFailed();
      return createRuntimeTabFromPersisted(persistedTab, '', {
        savedMarkdown: '',
        dirty: false,
        largeDocumentMode: false,
        readonlyDocumentMode: true,
      });
    }

    const diskLargeDocument =
      document.markdown.length > largeDocumentLimit || document.sizeBytes > largeDocumentLimit;
    if (!draft) {
      return createRuntimeTabFromPersisted(persistedTab, document.markdown, {
        savedMarkdown: document.markdown,
        dirty: false,
        lastKnownModifiedAt: document.modifiedAt,
        largeDocumentMode: diskLargeDocument,
        readonlyDocumentMode: diskLargeDocument || document.readonly,
      });
    }

    const changedOnDisk =
      persistedTab.lastKnownModifiedAt > 0 &&
      document.modifiedAt !== persistedTab.lastKnownModifiedAt;
    if (changedOnDisk) {
      const diskTab = createRuntimeTabFromPersisted(persistedTab, document.markdown, {
        savedMarkdown: document.markdown,
        dirty: false,
        lastKnownModifiedAt: document.modifiedAt,
        largeDocumentMode: diskLargeDocument,
        readonlyDocumentMode: diskLargeDocument || document.readonly,
      });
      queueStartupDraftConflict({
        tabId: persistedTab.id,
        fileName: persistedTab.fileName,
        filePath: persistedTab.filePath,
        nativePath: persistedTab.nativePath,
        draftId: draft.draftId,
        draftMarkdown: draft.markdown,
        diskMarkdown: document.markdown,
        diskModifiedAt: document.modifiedAt,
        diskReadonly: document.readonly,
        diskLargeDocumentMode: diskLargeDocument,
      });
      return diskTab;
    }

    return createRuntimeTabFromPersisted(persistedTab, draft.markdown, {
      savedMarkdown: document.markdown,
      dirty: true,
      lastKnownModifiedAt: document.modifiedAt,
      largeDocumentMode: draft.markdown.length > largeDocumentLimit,
      readonlyDocumentMode: draft.markdown.length > largeDocumentLimit || document.readonly,
    });
  }

  function queueStartupDraftConflict(conflict: StartupDraftConflict) {
    if (!startupDraftConflict) {
      startupDraftConflict = conflict;
    }
  }

  function applyStartupConflictDraft() {
    const conflict = startupDraftConflict;
    if (!conflict) return;
    const targetTab = tabs.find((tab) => tab.id === conflict.tabId);
    if (!targetTab) {
      startupDraftConflict = null;
      return;
    }

    Object.assign(targetTab, {
      markdown: conflict.draftMarkdown,
      savedMarkdown: conflict.diskMarkdown,
      dirty: true,
      draftId: conflict.draftId,
      lastKnownModifiedAt: conflict.diskModifiedAt,
      largeDocumentMode: conflict.draftMarkdown.length > largeDocumentLimit,
      readonlyDocumentMode:
        conflict.draftMarkdown.length > largeDocumentLimit || conflict.diskReadonly,
    });
    tabs = [...tabs];
    switchTab(conflict.tabId);
    startupDraftConflict = null;
    persistWorkspaceState();
  }

  function applyStartupConflictDiskVersion() {
    const conflict = startupDraftConflict;
    if (!conflict) return;
    const targetTab = tabs.find((tab) => tab.id === conflict.tabId);
    if (targetTab) {
      Object.assign(targetTab, {
        markdown: conflict.diskMarkdown,
        savedMarkdown: conflict.diskMarkdown,
        dirty: false,
        draftId: null,
        lastKnownModifiedAt: conflict.diskModifiedAt,
        largeDocumentMode: conflict.diskLargeDocumentMode,
        readonlyDocumentMode: conflict.diskLargeDocumentMode || conflict.diskReadonly,
      });
      tabs = [...tabs];
      loadTabState(targetTab);
    }
    deleteWorkspaceDraft(conflict.draftId).catch(() => undefined);
    startupDraftConflict = null;
    persistWorkspaceState();
  }

  async function saveStartupConflictDraftAs() {
    const conflict = startupDraftConflict;
    if (!conflict) return;
    applyStartupConflictDraft();
    await tick();
    await saveMarkdownFile(true);
  }

  // 保存当前活跃 Tab 的状态
  function saveActiveTabState() {
    if (!activeTabId) return;

    saveCurrentReadingPositionToMemoryOnly();

    tabs = writeActiveTabState(tabs, activeTabId, {
      markdown,
      savedMarkdown,
      dirty,
      version,
      fileName,
      filePath,
      nativePath,
      largeDocumentMode,
      readonlyDocumentMode,
      externalFileChange,
      lastKnownModifiedAt,
    });
    persistWorkspaceState();
  }

  function getCurrentReadingAnchor(modeToSave: ReadingPositionMode): OutlineScrollAnchor | null {
    if (modeToSave === 'semantic') {
      return semanticPane
        ? getSemanticScrollAnchor(outline, semanticPane, semanticPane.scrollTop)
        : null;
    }
    if (!sourcePane) {
      return null;
    }
    return getSourceScrollAnchor(
      outline,
      sourcePane.scrollTop,
      getSourceLineHeight(),
      sourceTextarea,
      sourcePane,
    );
  }

  function saveCurrentReadingPositionToMemoryOnly(modeToSave: ReadingPositionMode = mode) {
    if (!hasPersistableReadingPositionPath(filePath)) return;
    saveReadingPositionToMemoryOnly(filePath, modeToSave, getCurrentReadingAnchor(modeToSave));
  }

  function saveCurrentReadingPositionDebounced(modeToSave: ReadingPositionMode = mode) {
    if (!hasPersistableReadingPositionPath(filePath)) return;
    saveReadingPositionToMemory(filePath, modeToSave, getCurrentReadingAnchor(modeToSave));
  }

  async function flushCurrentReadingPosition() {
    saveCurrentReadingPositionToMemoryOnly();
    await flushReadingPositions();
  }

  let isSwitchingTab = false;

  // 加载指定 Tab 的状态并更新编辑器
  function loadTabState(tab: Tab) {
    isSwitchingTab = true;
    try {
      markdown = tab.markdown;
      savedMarkdown = tab.savedMarkdown ?? tab.markdown;
      dirty = tab.dirty;
      version = tab.version;
      fileName = tab.fileName;
      filePath = tab.filePath;
      nativePath = tab.nativePath;
      largeDocumentMode = tab.largeDocumentMode;
      readonlyDocumentMode = tab.readonlyDocumentMode;
      externalFileChange = normalizeExternalFileChange(tab.externalFileChange);
      tab.externalFileChange = externalFileChange;
      lastKnownModifiedAt = tab.lastKnownModifiedAt;

      if (editor) {
        const nextMode = largeDocumentMode ? 'source' : mode;
        editor.updateOptions({
          readonly: readonlyDocumentMode,
          mode: nextMode,
        });
        mode = nextMode;
        editor.setMarkdown(markdown, {
          reason: 'switch-tab',
          dirty: tab.dirty,
          savedMarkdown,
        });
      }

      // 步骤：仅当新标签页没有可恢复的阅读位置时，立即将滚动归零。
      // editor.setMarkdown() 更新了 DOM 内容，但 scrollTop 仍保留旧标签页的值。
      // 若 scrollTop 远超新内容的 scrollHeight，macOS WebKit 会渲染空白页，
      // Windows Chromium 则显示在底部。
      // 有阅读位置的标签页留给 scheduleRestoreReadingPosition 异步恢复，不在此处干预。
      const storedPosition = hasPersistableReadingPositionPath(filePath)
        ? getReadingPosition(filePath)
        : undefined;
      const hasAnchor =
        storedPosition != null &&
        (mode === 'semantic'
          ? storedPosition.semanticAnchor != null
          : storedPosition.sourceAnchor != null);

      if (!hasAnchor) {
        if (semanticPane) setScrollTop(semanticPane, 0);
        if (sourcePane) setScrollTop(sourcePane, 0);
      }

      const analysis = analyzeMarkdown(markdown);
      outline = analysis.outline;
      activeOutlineId = outline[0]?.id ?? '';
      applyOutlineDefaultExpansion();
      stats = analysis.stats;
      syncSourceTextareaHeight();

      scheduleRestoreReadingPosition(tab.filePath, mode);
    } finally {
      isSwitchingTab = false;
    }
  }

  // 切换活动标签页
  function switchTab(tabId: string) {
    if (!tabId || activeTabId === tabId) return;
    saveActiveTabState();
    void flushReadingPositions();
    const targetTab = tabs.find((t) => t.id === tabId);
    if (targetTab) {
      activeTabId = tabId;
      persistWorkspaceState();
      loadTabState(targetTab);
      updateWindowTitle();
      // 切换后若标签关联了本地文件，展开资源管理器中对应的文件夹路径
      if (targetTab.nativePath && currentFolderPath) {
        expandAncestors(targetTab.nativePath, currentFolderPath);
      }
    }
  }

  function handleSemanticScroll() {
    debounceReadingPositionSave('semantic');
  }

  function handleSourceScroll() {
    debounceReadingPositionSave('source');
  }

  function debounceReadingPositionSave(modeToSave: ReadingPositionMode) {
    saveCurrentReadingPositionToMemoryOnly(modeToSave);
    if (scrollDebounceTimer !== null) {
      window.clearTimeout(scrollDebounceTimer);
    }
    scrollDebounceTimer = window.setTimeout(() => {
      scrollDebounceTimer = null;
      saveCurrentReadingPositionDebounced(modeToSave);
    }, 1500);
  }

  function skipReadingPositionRestoreOnce() {
    skipNextReadingPositionRestore = true;
    skipReadingPositionRestoreUntil = Date.now() + 1000;
    readingPositionRestoreToken += 1;
  }

  function scheduleRestoreReadingPosition(path: string, targetMode: EditorMode, attempts = 120) {
    if (skipNextReadingPositionRestore) {
      skipNextReadingPositionRestore = false;
      if (Date.now() <= skipReadingPositionRestoreUntil) {
        return;
      }
    }
    if (!hasPersistableReadingPositionPath(path)) return;

    const position = getReadingPosition(path);
    const anchor = targetMode === 'semantic' ? position?.semanticAnchor : position?.sourceAnchor;
    if (!anchor) return;

    const restoreToken = ++readingPositionRestoreToken;
    const tryRestore = async (remainingAttempts: number) => {
      await tick();
      await waitForAnimationFrame();
      if (
        restoreToken !== readingPositionRestoreToken ||
        filePath !== path ||
        mode !== targetMode
      ) {
        return;
      }

      const pane = targetMode === 'semantic' ? semanticPane : sourcePane;
      const contentReady =
        targetMode === 'semantic'
          ? Boolean(semanticPane?.querySelector('.ProseMirror'))
          : Boolean(sourceTextarea && sourceTextarea.value === markdown);

      if (!pane || !contentReady) {
        if (remainingAttempts > 0) {
          requestAnimationFrame(() => void tryRestore(remainingAttempts - 1));
        }
        return;
      }

      if (targetMode === 'semantic') {
        restoreSemanticReadingPosition(outline, semanticPane, anchor);
      } else {
        restoreSourceReadingPosition(outline, sourcePane, sourceTextarea, anchor);
      }
    };

    requestAnimationFrame(() => void tryRestore(attempts));
  }

  // 顶级目录展开与收起状态
  let rootFolderExpanded = true;
  const folderExplorer = createFolderExplorerController({
    getDesktopEnabled: () => desktopEnabled,
    getFolderTree: () => folderTree,
    setFolderTree: (value) => {
      folderTree = value;
    },
    getExpandedFolders: () => expandedFolders,
    setExpandedFolders: (value) => {
      expandedFolders = value;
    },
    getRootFolderExpanded: () => rootFolderExpanded,
    setRootFolderExpanded: (value) => {
      rootFolderExpanded = value;
    },
    getCurrentFolderPath: () => currentFolderPath,
    setCurrentFolderPath: (value) => {
      currentFolderPath = value;
      persistWorkspaceState();
    },
    setStatusMessage: (value) => {
      statusMessage = value;
    },
  });
  const expandAncestors = folderExplorer.expandAncestors;
  const toggleFolderCollapse = folderExplorer.toggleFolderCollapse;
  const toggleRootFolder = folderExplorer.toggleRootFolder;
  const removeMissingExplorerPaths = folderExplorer.removeMissingPaths;
  const syncLoadedExplorerFolders = folderExplorer.syncLoadedFolders;

  // 侧边栏宽度拉伸状态与函数
  let sidebarWidth = 250;
  let isResizing = false;
  const sidebarResize = createSidebarResizeHandlers({
    setResizing: (value) => {
      isResizing = value;
    },
    setSidebarWidth: (value) => {
      sidebarWidth = value;
    },
  });
  const startResize = sidebarResize.startResize;

  let activeMenu: string | null = null;

  function toggleMenu(menu: string) {
    activeMenu = getNextActiveMenu(activeMenu, menu);
  }

  function closeMenu(menu: string) {
    activeMenu = closeActiveMenu(activeMenu, menu);
  }

  const minimizeWindow = () => minimizeAppWindow(desktopEnabled);
  const maximizeWindow = () => maximizeAppWindow(desktopEnabled);
  const closeAppWindow = () => closeCurrentWindow();
  const exitApp = () => requestExitApp();
  const createNewWindow = (folderPath?: string) => createAppWindow(desktopEnabled, folderPath);

  function resolveFolderName(path: string): string {
    const normalized = path.replace(/\\/g, '/').replace(/\/$/, '');
    const idx = normalized.lastIndexOf('/');
    return idx >= 0 ? normalized.slice(idx + 1) || path : path;
  }

  function sameFileSystemPath(left: string, right: string) {
    return (
      left.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase() ===
      right.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase()
    );
  }

  // 步骤：关闭全部标签页前统一确认未保存内容，确认后不自动创建空白标签。
  async function closeAllTabsWithConfirmation(options?: { skipPersist?: boolean }) {
    const dirtyTabs = getDirtyTabs(tabs);
    if (dirtyTabs.length > 0) {
      const names = dirtyTabs.map((t) => t.fileName).join('、');
      const ok = await confirmAction(t.unsavedChangesCloseTabs({ names }));
      if (ok === false) return false;
    }

    clearAllTabsWithoutCreatingBlank(options);
    return true;
  }

  function clearAllTabsWithoutCreatingBlank(options?: { skipPersist?: boolean }) {
    isSwitchingTab = true;
    try {
      tabs = [];
      activeTabId = '';
      previewTabId = null;
      markdown = '';
      savedMarkdown = '';
      fileName = '';
      filePath = '';
      nativePath = null;
      dirty = false;
      version = 0;
      lastKnownModifiedAt = 0;
      largeDocumentMode = false;
      readonlyDocumentMode = false;
      externalFileChange = createEmptyExternalFileChange();
      outline = [];
      if (editor) {
        editor.setMarkdown('', { reason: 'switch-tab', dirty: false, savedMarkdown: '' });
      }
    } finally {
      isSwitchingTab = false;
    }
    updateWindowTitle();
    if (!options?.skipPersist) {
      persistWorkspaceState();
    }
  }

  async function openFolderInCurrentWindow(folderPath: string) {
    if (!currentFolderPath || !sameFileSystemPath(currentFolderPath, folderPath)) {
      // 切换文件夹前保存当前文件夹状态，避免清空标签后的空状态覆盖已有记录
      if (currentFolderPath && tabs.length > 0) {
        await persistFolderWorkspaceState(currentFolderPath, tabs, activeTabId).catch(
          () => undefined,
        );
      }
      if (!(await closeAllTabsWithConfirmation({ skipPersist: true }))) {
        return;
      }
    }
    currentFolderPath = folderPath;
    await loadFolder(folderPath);
    await restoreFolderWorkspaceState(folderPath);
    await rememberNativeFolder(folderPath);
    await refreshRecentFiles();
  }

  async function openFolderInNewWindow(folderPath: string) {
    await rememberNativeFolder(folderPath);
    await refreshRecentFiles();
    await createNewWindow(folderPath);
  }

  async function handleFolderOpenChoice(
    event: CustomEvent<{ choice: 'current-window' | 'new-window'; remember: boolean }>,
  ) {
    const { choice, remember } = event.detail;
    folderOpenDialogPath = null;

    if (!folderOpenDialogName) return;

    if (remember) {
      folderOpenDefaultBehavior = choice;
      await updateAppSetting('folderOpenDefaultBehavior', choice).catch(() => undefined);
    }

    if (choice === 'current-window') {
      await openFolderInCurrentWindow(folderOpenDialogName);
    } else {
      await openFolderInNewWindow(folderOpenDialogName);
    }
    folderOpenDialogName = '';
  }

  function showFolderOpenDialog(folderPath: string) {
    folderOpenDialogName = folderPath;
    folderOpenDialogPath = folderPath;
  }

  async function openFolderWithBehavior(folderPath: string) {
    if (folderOpenDefaultBehavior === 'current-window') {
      await openFolderInCurrentWindow(folderPath);
    } else if (folderOpenDefaultBehavior === 'new-window') {
      await openFolderInNewWindow(folderPath);
    } else {
      showFolderOpenDialog(folderPath);
    }
  }

  async function openFolderDialog() {
    if (!desktopEnabled) return;
    const { folderPath, error } = await pickFolderPath();
    if (error) {
      statusMessage = error;
    }
    if (folderPath) {
      await openFolderWithBehavior(folderPath);
    }
  }

  async function openRecentEntry(path: string, entryType: RecentEntryType) {
    if (!desktopEnabled) return;

    if (entryType === 'folder') {
      if (!(await ensureExplorerPathExists(path, t.folderMissing()))) {
        return;
      }
      await openFolderWithBehavior(path);
      return;
    }

    if (!(await ensureExplorerPathExists(path, t.fileMissing()))) {
      return;
    }
    await openRecentFile(path);
  }

  async function clearRecentEntriesList() {
    if (!desktopEnabled) return;
    await clearRecentEntries().catch(() => undefined);
    await refreshRecentFiles();
  }

  async function removeRecentEntry(path: string) {
    if (!desktopEnabled) return;
    // 当前后端没有单条删除命令，通过清除全部 + 重新写入保留条目实现
    const current = recentFiles.filter((entry) => entry.path !== path);
    await clearRecentEntries().catch(() => undefined);
    for (const entry of current) {
      if (entry.entryType === 'file') {
        await rememberRecentEntry(entry.path, 'file', entry.title ?? null, entry.wordCount).catch(
          () => undefined,
        );
      } else {
        await rememberRecentEntry(entry.path, 'folder', null, 0).catch(() => undefined);
      }
    }
    await refreshRecentFiles();
  }

  async function closeCurrentFile() {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab) return;
    await closeTab(activeTab.id);
  }

  async function closeCurrentWindow() {
    const closeBehavior = await resolveCloseWindowBehaviorForCloseRequest();
    if (!closeBehavior) {
      return;
    }

    // 步骤：关闭窗口前检查未保存的脏标签，弹出确认对话框（三按钮模式，与关闭标签页 UI 一致）
    if (closeBehavior === 'close-window') {
      const dirtyTabs = getDirtyTabs(tabs);
      if (dirtyTabs.length > 0) {
        const names = dirtyTabs.map((t) => t.fileName).join('、');
        const hasSaveable = dirtyTabs.some((t) => t.nativePath);
        const result = await confirmAction(t.unsavedChangesCloseWindow({ names }), {
          okLabel: t.discardChanges(),
          cancelLabel: t.cancel(),
          saveLabel: hasSaveable ? t.save() : undefined,
        });
        if (result === false) return;
        // 用户选择保存：保存当前活动文件后继续关闭
        if (result === 'save') {
          await saveMarkdownFile(false);
        }
      }
    }

    // 关闭窗口前立即持久化工作区状态和阅读位置
    await flushPersistWorkspaceState();
    await flushCurrentReadingPosition();
    const shouldHideToTray = closeBehavior === 'close-to-tray';
    await closeDesktopWindow(desktopEnabled, shouldHideToTray);
  }

  async function resolveCloseWindowBehaviorForCloseRequest(): Promise<CloseWindowAction | null> {
    if (!desktopEnabled) {
      return 'close-window';
    }
    if (closeWindowBehavior !== 'ask-every-time') {
      return closeWindowBehavior;
    }

    const choice = await requestCloseWindowChoice();
    if (!choice) {
      return null;
    }
    if (choice.remember) {
      await persistCloseWindowBehavior(choice.behavior);
    }
    return choice.behavior;
  }

  function requestCloseWindowChoice() {
    if (closeWindowChoicePromise) {
      return closeWindowChoicePromise;
    }

    rememberCloseWindowChoice = true;
    closeWindowChoiceDialogOpen = true;
    closeWindowChoicePromise = new Promise<CloseWindowChoiceResult>((resolve) => {
      closeWindowChoiceResolver = resolve;
    });
    return closeWindowChoicePromise;
  }

  async function persistCloseWindowBehavior(behavior: CloseWindowBehavior) {
    closeWindowBehavior = behavior;
    await updateAppSetting('closeWindowBehavior', behavior).catch(() => undefined);
  }

  function resolveCloseWindowChoice(behavior: CloseWindowAction) {
    closeWindowChoiceDialogOpen = false;
    const resolver = closeWindowChoiceResolver;
    closeWindowChoiceResolver = null;
    closeWindowChoicePromise = null;
    resolver?.({ behavior, remember: rememberCloseWindowChoice });
  }

  function cancelCloseWindowChoice() {
    closeWindowChoiceDialogOpen = false;
    const resolver = closeWindowChoiceResolver;
    closeWindowChoiceResolver = null;
    closeWindowChoicePromise = null;
    resolver?.(null);
  }

  // 外部文件变更弹框 —— 重新载入外部版本
  function handleExternalChangeReload() {
    externalChangeDialogOpen = false;
    externalChangeDialogState = null;
    reloadExternalFile().catch(() => undefined);
  }

  // 外部文件变更弹框 —— 覆盖外部版本
  function handleExternalChangeOverwrite() {
    externalChangeDialogOpen = false;
    externalChangeDialogState = null;
    overwriteExternalFile().catch(() => undefined);
  }

  // 外部文件变更弹框 —— 忽略（保留当前内容，关闭弹框）
  function handleExternalChangeDismiss() {
    // 更新 lastKnownModifiedAt 为磁盘时间，避免下次轮询重复弹框
    if (externalChangeDialogState && externalChangeDialogState.modifiedAt > 0) {
      lastKnownModifiedAt = externalChangeDialogState.modifiedAt;
    }
    externalFileChange = createEmptyExternalFileChange();
    externalChangeDialogOpen = false;
    externalChangeDialogState = null;
  }

  async function requestExitApp() {
    const dirtyTabs = getDirtyTabs(tabs);
    if (dirtyTabs.length > 0) {
      const names = dirtyTabs.map((t) => t.fileName).join('、');
      const ok = await confirmAction(t.unsavedChangesExitApp({ names }));
      if (ok === false) return;
    }
    // 退出应用前立即持久化工作区状态和阅读位置
    await flushPersistWorkspaceState();
    await flushCurrentReadingPosition();
    await exitDesktopApp(desktopEnabled);
  }

  async function approveSoftwareUpdateInstall(requestId: string) {
    const dirtyTabs = getDirtyTabs(tabs);
    let approved = true;
    if (dirtyTabs.length > 0) {
      const names = dirtyTabs.map((tab) => tab.fileName).join('、');
      approved = (await confirmAction(t.unsavedChangesBeforeUpdate({ names }))) !== false;
    }

    const { emit } = await import('@tauri-apps/api/event');
    await emit('nomo://update-install-decision', { requestId, approved });
  }

  function persistEditorModePreference(nextMode: EditorMode) {
    updateAppSetting('editorMode', nextMode).catch(() => undefined);
  }

  function setMode(nextMode: EditorMode) {
    const previousMode = mode;
    saveCurrentReadingPositionToMemoryOnly(previousMode);
    editorInteraction
      .setMode(nextMode)
      .then(() => {
        if (!(largeDocumentMode && nextMode === 'semantic')) {
          persistEditorModePreference(nextMode);
        }
        if (previousMode !== nextMode && mode === nextMode) {
          scheduleRestoreReadingPosition(filePath, nextMode);
        }
      })
      .catch(() => undefined);
  }

  function setSidebarHidden(hidden: boolean) {
    focusMode = hidden;
    updateAppSetting('sidebarHidden', hidden).catch(() => undefined);
  }

  function toggleFocusMode() {
    setSidebarHidden(!focusMode);
  }

  function setOutlineVisiblePreference(visible: boolean) {
    outlineVisible = visible;
    updateAppSetting('outlineVisible', visible).catch(() => undefined);
  }

  function toggleOutlineVisible() {
    setOutlineVisiblePreference(!outlineVisible);
  }

  function setWritingStatsVisiblePreference(visible: boolean) {
    writingStatsVisible = visible;
    updateAppSetting('writingStatsVisible', visible).catch(() => undefined);
  }

  function setWritingStatsMetric(metric: WritingStatsMetric) {
    writingStatsMetric = metric;
    updateAppSetting('writingStatsMetric', metric).catch(() => undefined);
  }

  const commandHandlers: AppCommandHandlers = {
    createNewFile: () => createNewFile(),
    createNewWindow,
    openFileDialog: () => openFileDialog(),
    openFolderDialog: () => openFolderDialog(),
    openRecentEntry: (path, entryType) => openRecentEntry(path, entryType),
    saveMarkdownFile: (saveAs) => saveMarkdownFile(saveAs),
    closeCurrentFile: () => closeCurrentFile(),
    closeCurrentWindow: () => closeCurrentWindow(),
    runCommand: (command) => runCommand(command),
    openTablePicker: () => openTablePicker(),
    openLinkPicker: () => openLinkPicker(),
    openSearchPanel: (replaceVisible) => openSearchPanel(replaceVisible),
    closeSearchPanel: () => closeSearchPanel(),
    getSearchState: () => ({ open: searchPanelOpen, replaceVisible: searchReplaceVisible }),
    openSettings: () => openSettings(),
    editFrontMatter: () => editFrontMatter(),
    showUnavailableFeature: (featureName) => showUnavailableFeature(featureName),
    setMode: (nextMode) => setMode(nextMode),
    getMode: () => mode,
    toggleTheme: () => toggleTheme(),
    toggleFocusMode: () => toggleFocusMode(),
    toggleOutlineVisible: () => toggleOutlineVisible(),
    getDefaultCodeBlockLanguage: () => defaultCodeBlockLanguage,
    getDefaultDiagramType: () => defaultDiagramType,
    switchToNextTab: () => {
      const idx = tabs.findIndex((t) => t.id === activeTabId);
      const nextIdx = idx >= 0 ? (idx + 1) % tabs.length : 0;
      if (tabs[nextIdx]) switchTab(tabs[nextIdx].id);
    },
    switchToPrevTab: () => {
      const idx = tabs.findIndex((t) => t.id === activeTabId);
      const prevIdx = idx >= 0 ? (idx - 1 + tabs.length) % tabs.length : tabs.length - 1;
      if (tabs[prevIdx]) switchTab(tabs[prevIdx].id);
    },
    exportHtml: () => handleExport('html'),
    exportPdf: () => handleExport('pdf'),
  };

  async function updateWindowTitle() {
    await updateAppWindowTitle(desktopEnabled, fileName, dirty);
  }

  $: {
    if (desktopEnabled && (fileName || dirty !== undefined)) {
      updateWindowTitle();
    }
  }

  // 步骤：recentFiles 变化时异步检测路径是否存在，用于灰显失效条目
  $: if (desktopEnabled && recentFiles.length > 0) {
    void (async () => {
      const paths = recentFiles.map((entry) => entry.path);
      const exists = await checkPathsExist(paths).catch(() => paths.map(() => true));
      const nextMissing = new Set<string>();
      recentFiles.forEach((entry, index) => {
        if (!exists[index]) {
          nextMissing.add(entry.path);
        }
      });
      missingRecentPaths = nextMissing;
    })();
  } else {
    missingRecentPaths = new Set<string>();
  }
  let fileCheckTimer: number | null = null;
  let explorerSyncInProgress = false;
  let systemThemeMediaQuery: MediaQueryList | null = null;
  let systemThemeChangeHandler: (() => void) | null = null;

  async function ensureExplorerPathExists(path: string, missingMessage: string) {
    if (!desktopEnabled) {
      return true;
    }

    const [exists] = await checkPathsExist([path]).catch(() => [true]);
    if (exists) {
      return true;
    }

    removeMissingExplorerPaths([path], false);
    statusMessage = `${missingMessage}：${path}`;
    await refreshRecentFiles();
    return false;
  }

  function isMissingPathError(error: string) {
    const message = error.toLowerCase();
    return (
      message.includes('文件不存在') ||
      message.includes('not found') ||
      message.includes('os error 2')
    );
  }

  async function syncExplorerWithFileSystem() {
    if (explorerSyncInProgress) {
      return;
    }

    explorerSyncInProgress = true;
    try {
      await syncLoadedExplorerFolders();
    } finally {
      explorerSyncInProgress = false;
    }
  }

  function handleContextMenuOpen(event: ContextMenuOpenEvent) {
    contextMenuX = event.x;
    contextMenuY = event.y;
    contextMenuItems = event.items;
    contextMenuOpen = true;
  }

  /**
   * 监听 ImageNodeView 通过自定义 DOM 事件传递的右键菜单。
   * 由于 NodeView.stopEvent 拦截了原生 contextmenu，
   * 菜单数据通过 image-context-menu 自定义事件冒泡到此。
   */
  function handleImageContextMenu(event: Event) {
    const customEvent = event as CustomEvent;
    const detail = customEvent.detail;
    if (!detail?.items) return;
    contextMenuX = detail.x;
    contextMenuY = detail.y;
    contextMenuItems = detail.items;
    contextMenuOpen = true;
  }

  function closeContextMenu() {
    contextMenuOpen = false;
    contextMenuItems = [];
  }

  const editor = createEditorCore({
    markdown,
    mode,
    inlineCodeRenderingEnabled,
    theme: { name: theme },
    onChange: syncFromEditor,
    onLinkShortcut: () => openLinkPicker(),
    onOpenLink: (href) => openLinkFromEditor(href),
    getImageContext: () => getImageContext(),
    onImagesDeleted: (event) => handleDeletedImageResources(event),
    onContextMenuOpen: handleContextMenuOpen,
  });

  function openSearchPanel(replaceVisible = false) {
    if (!hasOpenDocument()) return;
    searchPanelOpen = true;
    searchReplaceVisible = replaceVisible;
    linkPickerOpen = false;
    tablePickerOpen = false;
    refreshSearchMatches({ preserveActive: true, selectActive: false });
  }

  function closeSearchPanel() {
    searchPanelOpen = false;
    editor.focus();
  }

  function updateSearchQuery(event: Event) {
    searchQuery = (event.currentTarget as HTMLInputElement).value;
    searchActiveIndex = 0;
    refreshSearchMatches({ preserveActive: false, selectActive: false });
  }

  function updateSearchReplacement(event: Event) {
    searchReplacement = (event.currentTarget as HTMLInputElement).value;
  }

  function toggleSearchCaseSensitive() {
    searchCaseSensitive = !searchCaseSensitive;
    searchActiveIndex = 0;
    refreshSearchMatches({ preserveActive: false, selectActive: false });
  }

  function toggleSearchReplaceVisible() {
    searchReplaceVisible = !searchReplaceVisible;
  }

  function findPreviousSearchMatch() {
    if (searchMatches.length === 0) return;
    searchActiveIndex = (searchActiveIndex - 1 + searchMatches.length) % searchMatches.length;
    selectActiveSearchMatch();
  }

  function findNextSearchMatch() {
    if (searchMatches.length === 0) return;
    searchActiveIndex = (searchActiveIndex + 1) % searchMatches.length;
    selectActiveSearchMatch();
  }

  function replaceCurrentSearchMatch() {
    if (readonlyDocumentMode || searchMatches.length === 0) return;
    const match = searchMatches[searchActiveIndex];
    if (!match) return;

    if (mode === 'source') {
      const nextMarkdown = replaceTextRange(markdown, match, searchReplacement);
      editor.setMarkdown(nextMarkdown, { reason: 'programmatic-update' });
    } else {
      editor.replaceSearchMatch(match, searchReplacement);
    }

    tick().then(() => {
      refreshSearchMatches({ preserveActive: true, selectActive: true });
      statusMessage = t.replacedOneMatch();
    });
  }

  function replaceAllSearchMatches() {
    if (readonlyDocumentMode || !searchQuery) return;
    let replaced = 0;

    if (mode === 'source') {
      const result = replaceAllTextMatches(markdown, searchQuery, searchReplacement, {
        caseSensitive: searchCaseSensitive,
      });
      replaced = result.count;
      if (replaced > 0) {
        editor.setMarkdown(result.text, { reason: 'programmatic-update' });
      }
    } else {
      replaced = editor.replaceAllSearchMatches(searchQuery, searchReplacement, {
        caseSensitive: searchCaseSensitive,
      });
    }

    tick().then(() => {
      searchActiveIndex = 0;
      refreshSearchMatches({ preserveActive: false, selectActive: true });
      statusMessage = t.replacedMatchCount({ count: replaced });
    });
  }

  function refreshSearchMatches(options?: { preserveActive?: boolean; selectActive?: boolean }) {
    if (!searchPanelOpen) {
      searchMatches = [];
      searchMatchCount = 0;
      lastSearchSignature = '';
      return;
    }

    const previousMatch = searchMatches[searchActiveIndex];
    searchMatches =
      mode === 'source'
        ? findTextMatches(markdown, searchQuery, { caseSensitive: searchCaseSensitive })
        : editor.findSearchMatches(searchQuery, { caseSensitive: searchCaseSensitive });
    searchMatchCount = searchMatches.length;

    if (searchMatches.length === 0) {
      searchActiveIndex = 0;
      return;
    }

    if (options?.preserveActive && previousMatch) {
      const nextIndex = searchMatches.findIndex(
        (match) => match.from >= previousMatch.from && match.text === previousMatch.text,
      );
      searchActiveIndex =
        nextIndex >= 0 ? nextIndex : Math.min(searchActiveIndex, searchMatches.length - 1);
    } else {
      searchActiveIndex = Math.min(searchActiveIndex, searchMatches.length - 1);
    }

    // 更新编辑器搜索高亮 decorations（不依赖 focus 即可显示）
    if (mode !== 'source') {
      editor.setSearchHighlights(searchMatches, searchActiveIndex);
    } else {
      editor.setSearchHighlights([], 0);
    }

    if (options?.selectActive) {
      selectActiveSearchMatch();
    }
  }

  async function selectActiveSearchMatch() {
    const match = searchMatches[searchActiveIndex];
    if (!match) return;

    skipReadingPositionRestoreOnce();

    const isSearchFocused = document.activeElement?.closest('.search-replace-panel') !== null;
    const activeSearchInput =
      document.activeElement instanceof HTMLInputElement &&
      document.activeElement.closest('.search-replace-panel')
        ? document.activeElement
        : null;
    const searchInput =
      activeSearchInput ?? document.querySelector<HTMLInputElement>('.search-replace-panel input');
    const searchCursorStart = activeSearchInput?.selectionStart ?? null;
    const searchCursorEnd = activeSearchInput?.selectionEnd ?? null;

    // 总是 focus 编辑器，让 scrollIntoView 和 selection 高亮生效
    if (mode === 'source') {
      await selectSourceSearchMatch(match, true);
    } else {
      editor.selectSearchMatch(match, true);
      await tick();
      await waitForAnimationFrame();
    }

    // 如果搜索面板之前有焦点，focus 回去并保持光标位置；preventScroll 避免覆盖编辑区跳转。
    if (isSearchFocused && searchInput) {
      searchInput.focus({ preventScroll: true });
      if (searchCursorStart !== null && searchCursorEnd !== null) {
        searchInput.setSelectionRange(searchCursorStart, searchCursorEnd);
      }
    }
  }

  async function selectSourceSearchMatch(match: EditorSearchMatch, focusEditor = true) {
    await tick();
    if (!sourceTextarea) return;
    if (focusEditor) {
      sourceTextarea.focus();
    }
    sourceTextarea.setSelectionRange(match.from, match.to);
    const lineHeight = getSourceLineHeight();
    const line = markdown.slice(0, match.from).split('\n').length - 1;
    setScrollTop(sourcePane, Math.max(0, line * lineHeight - sourcePane.clientHeight / 2));
    await waitForAnimationFrame();
  }

  function waitForAnimationFrame() {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  function hasOpenDocument() {
    return tabs.length > 0 && Boolean(activeTabId);
  }

  function detachMountedEditorHostEvents() {
    if (!mountedEditorHost) return;
    mountedEditorHost.removeEventListener('image-context-menu', handleImageContextMenu);
    mountedEditorHost = null;
  }

  function mountEditorHostIfReady() {
    if (!hasOpenDocument() || !editorHost || mountedEditorHost === editorHost) {
      return;
    }

    detachMountedEditorHostEvents();
    editor.mount(editorHost);
    editorHost.addEventListener('image-context-menu', handleImageContextMenu);
    mountedEditorHost = editorHost;
  }

  $: if (tabs.length > 0 && activeTabId && editorHost) mountEditorHostIfReady();
  $: if ((tabs.length === 0 || !activeTabId) && mountedEditorHost) detachMountedEditorHostEvents();

  const editorSettings = createEditorSettingsController({
    getDesktopEnabled: () => desktopEnabled,
    getEditor: () => editor,
    getTheme: () => theme,
    setTheme: (value) => {
      themePreference = value;
      theme = resolveThemePreference(value);
    },
    getFontSize: () => fontSize,
    setFontSize: (value) => {
      fontSize = value;
    },
    getLineHeight: () => lineHeight,
    setLineHeight: (value) => {
      lineHeight = value;
    },
    getContentWidthPercent: () => contentWidthPercent,
    setContentWidthPercent: (value) => {
      contentWidthPercent = value;
    },
    getBlockStyle: () => blockStyle,
    setBlockStyle: (value) => {
      blockStyle = value;
    },
    refreshEditorViewportLayout: () => refreshEditorViewportLayout(),
  });
  function openSettings() {
    openSettingsWindow(desktopEnabled);
  }

  // 打开预览标签页（文件树单击）
  async function openPreviewFile(path: string) {
    if (!desktopEnabled) return;
    if (!(await ensureExplorerPathExists(path, t.fileMissing()))) {
      return;
    }

    // 已有固定标签页打开此文件 → 切换到它
    const existingFixedTab = tabs.find(
      (t) => t.nativePath && sameNativePath(t.nativePath, path) && t.id !== previewTabId,
    );
    if (existingFixedTab) {
      if (activeTabId !== previewTabId) {
        saveActiveTabState();
      }
      switchTab(existingFixedTab.id);
      return;
    }

    const { document, error } = await readMarkdownFromPath(path, t.previewOpenFailed());
    if (error) {
      statusMessage = error;
      if (isMissingPathError(error)) {
        removeMissingExplorerPaths([path], false);
        statusMessage = t.removedFromExplorer({ message: error });
      }
      return;
    }
    if (!document) return;

    // 保存当前固定标签页状态（如果当前不是预览）
    if (activeTabId !== previewTabId) {
      saveActiveTabState();
    }

    // 复用现有预览标签页或按设置直接创建固定标签页
    let targetTab: Tab;
    const existingPreview =
      filePreviewEnabled && previewTabId ? tabs.find((t) => t.id === previewTabId) : undefined;

    if (existingPreview) {
      targetTab = existingPreview;
    } else {
      targetTab = createBlankTab('', '');
      tabs = [...tabs, targetTab];
      previewTabId = filePreviewEnabled ? targetTab.id : null;
    }

    const isLargeDocument =
      document.markdown.length > largeDocumentLimit || document.sizeBytes > largeDocumentLimit;

    targetTab.fileName = document.fileName;
    targetTab.filePath = document.path;
    targetTab.nativePath = document.path;
    targetTab.draftId = null;
    targetTab.markdown = document.markdown;
    targetTab.savedMarkdown = document.markdown;
    targetTab.dirty = false;
    targetTab.lastKnownModifiedAt = document.modifiedAt;
    targetTab.largeDocumentMode = isLargeDocument;
    targetTab.readonlyDocumentMode = isLargeDocument || document.readonly;
    targetTab.externalFileChange = createEmptyExternalFileChange();
    targetTab.version = 0;

    tabs = [...tabs];
    activeTabId = targetTab.id;
    loadTabState(targetTab);

    const parentDir = getDirectoryLabel(document.path);
    if (parentDir && parentDir !== t.currentFolder()) {
      if (!currentFolderPath) {
        loadFolder(parentDir).catch(() => undefined);
      } else {
        expandAncestors(document.path, currentFolderPath);
      }
    }
  }

  // 手动固定当前预览标签页（双击标签页标题）
  function pinPreviewTab() {
    if (previewTabId && previewTabId === activeTabId) {
      previewTabId = null;
    }
  }

  // 步骤：关闭除指定标签外的所有标签页（保留标签自动固定）
  async function handleCloseOtherTabs(event: CustomEvent<{ tabId: string }>) {
    const keepTabId = event.detail.tabId;
    const keepTab = tabs.find((t) => t.id === keepTabId);
    if (!keepTab) return;

    const dirtyTabs = getDirtyTabs(tabs.filter((t) => t.id !== keepTabId));
    if (dirtyTabs.length > 0) {
      const names = dirtyTabs.map((t) => t.fileName).join('、');
      const ok = await confirmAction(t.unsavedChangesCloseTabs({ names }));
      if (ok === false) return;
    }

    tabs = [keepTab];
    activeTabId = keepTabId;
    // 无论保留的是否是预览标签，都固定它（只剩一个标签不需要预览机制）
    previewTabId = null;
    loadTabState(keepTab);
    updateWindowTitle();
    persistWorkspaceState();
  }

  // 步骤：关闭指定标签页右侧的所有标签页
  async function handleCloseTabsToRight(event: CustomEvent<{ tabId: string }>) {
    const tabId = event.detail.tabId;
    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    if (tabIndex < 0) return;

    const rightTabs = tabs.slice(tabIndex + 1);
    const dirtyRightTabs = getDirtyTabs(rightTabs);
    if (dirtyRightTabs.length > 0) {
      const names = dirtyRightTabs.map((t) => t.fileName).join('、');
      const ok = await confirmAction(t.unsavedChangesCloseTabs({ names }));
      if (ok === false) return;
    }

    const remaining = tabs.slice(0, tabIndex + 1);
    tabs = remaining;
    if (previewTabId && !remaining.find((t) => t.id === previewTabId)) {
      previewTabId = null;
    }
    if (!remaining.find((t) => t.id === activeTabId)) {
      activeTabId = tabId;
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) loadTabState(tab);
    }
    updateWindowTitle();
    persistWorkspaceState();
  }

  // 步骤：关闭全部标签页，清空状态不保留空白标签
  function handleCloseAllTabs() {
    closeAllTabsWithConfirmation().catch(() => undefined);
  }

  const documentActions = createDocumentActionsController({
    getLargeDocumentLimit: () => largeDocumentLimit,
    getAutoSaveDelayMs: () => autoSaveDelayMs,
    getCreateSnapshotBeforeSave: () => createSnapshotBeforeSave,
    recoveryKey: RECOVERY_KEY,
    getDesktopEnabled: () => desktopEnabled,
    getDirty: () => dirty,
    getAutoSaveEnabled: () => autoSaveEnabled,
    setMarkdown: (value) => {
      markdown = value;
    },
    setSavedMarkdown: (value) => {
      savedMarkdown = value;
    },
    setDirty: (value) => {
      dirty = value;
    },
    setLargeDocumentMode: (value) => {
      largeDocumentMode = value;
    },
    setReadonlyDocumentMode: (value) => {
      readonlyDocumentMode = value;
    },
    getNativePath: () => nativePath,
    setNativePath: (value) => {
      nativePath = value;
    },
    getFileName: () => fileName,
    setFileName: (value) => {
      fileName = value;
    },
    getFilePath: () => filePath,
    setFilePath: (value) => {
      filePath = value;
    },
    getLastKnownModifiedAt: () => lastKnownModifiedAt,
    setLastKnownModifiedAt: (value) => {
      lastKnownModifiedAt = value;
    },
    getExternalFileChange: () => externalFileChange,
    setExternalFileChange: (value) => {
      const changed = externalFileChange.type !== value.type;
      externalFileChange = value;
      const activeTab = tabs.find((tab) => tab.id === activeTabId);
      if (activeTab && changed) {
        activeTab.externalFileChange = value;
        tabs = [...tabs];
        persistWorkspaceState();
      }
      // 检测到外部变更且弹框未打开时，弹出模态对话框
      if (value.type !== 'none' && !externalChangeDialogOpen) {
        externalChangeDialogState = value;
        externalChangeDialogOpen = true;
      }
    },
    getCurrentFolderPath: () => currentFolderPath,
    getFileInput: () => fileInput,
    getEditor: () => editor,
    getTabs: () => tabs,
    setTabs: (value) => {
      tabs = value;
      persistWorkspaceState();
    },
    getActiveTabId: () => activeTabId,
    setActiveTabId: (value) => {
      activeTabId = value;
      persistWorkspaceState();
    },
    getPreviewTabId: () => previewTabId,
    setPreviewTabId: (value) => {
      previewTabId = value;
      persistWorkspaceState();
    },
    setStatusMessage: (value) => {
      statusMessage = value;
    },
    setRecentFiles: (value) => {
      recentFiles = value;
    },
    saveActiveTabState,
    loadTabState,
    switchTab,
    writeRecoveryDraft,
    updateWindowTitle,
    loadFolder,
    expandAncestors,
  });
  const outlineInteraction = createOutlineInteractionController({
    getMode: () => mode,
    getMarkdown: () => markdown,
    getOutline: () => outline,
    getCollapsedOutlineIds: () => collapsedOutlineIds,
    setCollapsedOutlineIds: (value) => {
      collapsedOutlineIds = value;
    },
    getOutlineVisible: () => outlineVisible,
    setOutlineVisible: (value) => {
      outlineVisible = value;
    },
    setActiveOutlineId: (value) => {
      activeOutlineId = value;
    },
    getSuppressOutlineScrollUntil: () => suppressOutlineScrollUntil,
    setSuppressOutlineScrollUntil: (value) => {
      suppressOutlineScrollUntil = value;
    },
    getSemanticPane: () => semanticPane,
    getSourcePane: () => sourcePane,
    getSourceTextarea: () => sourceTextarea,
    onExplicitJumpIntent: skipReadingPositionRestoreOnce,
  });
  const editorInteraction = createEditorInteractionController({
    getEditor: () => editor,
    getLargeDocumentMode: () => largeDocumentMode,
    getMode: () => mode,
    getOutline: () => outline,
    getSemanticPane: () => semanticPane,
    getSourcePane: () => sourcePane,
    getSourceTextarea: () => sourceTextarea,
    getPendingSourceScrollTop: () => pendingSourceScrollTop,
    setPendingSourceScrollTop: (value) => {
      pendingSourceScrollTop = value;
    },
    setSuppressOutlineScrollUntil: (value) => {
      suppressOutlineScrollUntil = value;
    },
    setStatusMessage: (value) => {
      statusMessage = value;
    },
    getSourceLineHeight,
  });
  const imageInsertion = createImageInsertionHandlers({
    getEditor: () => editor,
    getMode: () => mode,
    getFileName: () => fileName,
    getNativePath: () => nativePath,
    getSourceTextarea: () => sourceTextarea,
    getImageContext: () => getImageContext(),
    saveMarkdownFile: (saveAs) => saveMarkdownFile(saveAs),
    setMarkdown: (value) => editor.setMarkdown(value),
    setStatusMessage: (message) => {
      statusMessage = message;
    },
    syncSourceTextareaHeight: () => syncSourceTextareaHeight(),
  });
  const handleEditorDrop = imageInsertion.handleEditorDrop;
  const handleEditorPaste = imageInsertion.handleEditorPaste;
  const updateMarkdown = editorInteraction.updateMarkdown;
  const runCommand = editorInteraction.runCommand;
  refreshEditorViewportLayout = editorInteraction.refreshEditorViewportLayout;
  async function getDesktopEffectiveSystemTheme() {
    return (await getDesktopSystemTheme(desktopEnabled)) ?? resolveThemePreference('system');
  }

  async function syncDesktopIconTheme(nextTheme?: 'light' | 'dark') {
    const effectiveTheme =
      nextTheme ?? (themePreference === 'system' ? await getDesktopEffectiveSystemTheme() : theme);
    await setDesktopIconTheme(desktopEnabled, effectiveTheme).catch(() => undefined);
  }

  async function syncSystemThemeFromDesktop(options?: { transition?: boolean }) {
    if (themePreference !== 'system') {
      return;
    }

    const nextTheme = await getDesktopEffectiveSystemTheme();
    const previousTheme = theme;
    theme = applyThemeSetting(themePreference, {
      effectiveTheme: nextTheme,
      transition: options?.transition,
    });
    if (previousTheme !== nextTheme) {
      editor.updateTheme({ name: nextTheme });
    }
    await syncDesktopIconTheme(nextTheme);
  }

  function toggleTheme() {
    const nextTheme: ThemePreference = theme === 'light' ? 'dark' : 'light';
    themePreference = nextTheme;
    theme = applyThemeSetting(themePreference, { transition: true });
    localStorage.setItem('nomo-theme', themePreference);
    updateAppSetting('theme', themePreference).catch(() => undefined);
    syncDesktopIconTheme().catch(() => undefined);
    editor.updateTheme({ name: theme });
  }
  const updateContentWidth = editorSettings.updateContentWidth;
  const isOutlineItemExpandable = outlineInteraction.isOutlineItemExpandable;
  const toggleOutlineItemExpanded = outlineInteraction.toggleOutlineItemExpanded;
  const pruneCollapsedOutlineIds = outlineInteraction.pruneCollapsedOutlineIds;
  const syncSourceTextareaHeight = editorInteraction.syncSourceTextareaHeight;
  const openDroppedMarkdown = documentActions.openDroppedMarkdown;
  const openFileDialog = documentActions.openFileDialog;
  const openMarkdownFile = documentActions.openMarkdownFile;
  const saveMarkdownFile = documentActions.saveMarkdownFile;
  const openRecentFile = documentActions.openRecentFile;
  const createNewFile = documentActions.createNewFile;
  const _documentCloseTab = documentActions.closeTab;
  const refreshRecentFiles = documentActions.refreshRecentFiles;
  const reloadExternalFile = documentActions.reloadExternalFile;
  const overwriteExternalFile = documentActions.overwriteExternalFile;
  const checkExternalFileChange = documentActions.checkExternalFileChange;

  // 包装 closeTab：预览标签页直接关闭无需确认
  async function closeTab(tabId: string, event?: Event) {
    event?.stopPropagation();

    // 关闭前保存阅读位置
    if (activeTabId === tabId) {
      saveActiveTabState();
      void flushReadingPositions();
    }

    const tabToClose = tabs.find((t) => t.id === tabId);
    if (!tabToClose) {
      logCloseDiagnostics('closeTab: 未找到目标标签', {
        tabId,
        activeTabId,
        tabCount: tabs.length,
      });
      return;
    }

    logCloseDiagnostics('closeTab: 收到关闭请求', {
      tabId,
      activeTabId,
      previewTabId,
      targetDirty: tabToClose.dirty,
      appDirty: dirty,
      isActiveTarget: tabId === activeTabId,
      targetVersion: tabToClose.version,
      appVersion: version,
      targetMarkdownLength: tabToClose.markdown.length,
      appMarkdownLength: markdown.length,
      targetSavedMarkdownLength: tabToClose.savedMarkdown?.length ?? null,
      appSavedMarkdownLength: savedMarkdown.length,
    });

    const dirtyTabToClose = getDirtyTabs([tabToClose]).find((tab) => tab.id === tabId);
    logCloseDiagnostics('closeTab: 实时 dirty 判定完成', {
      tabId,
      hasDirtyTabToClose: Boolean(dirtyTabToClose),
      targetDirtyAfterCheck: tabToClose.dirty,
      appDirty: dirty,
      dirtyTabVersion: dirtyTabToClose?.version ?? null,
      dirtyMarkdownLength: dirtyTabToClose?.markdown.length ?? null,
      dirtySavedMarkdownLength: dirtyTabToClose?.savedMarkdown.length ?? null,
    });

    if (dirtyTabToClose && !tabToClose.dirty) {
      Object.assign(tabToClose, dirtyTabToClose);
      tabs = [...tabs];
      logCloseDiagnostics('closeTab: 已把活动标签 dirty 状态写回 tabs', {
        tabId,
        targetDirty: tabToClose.dirty,
        targetVersion: tabToClose.version,
      });
    }

    if (tabId === previewTabId && !dirtyTabToClose) {
      logCloseDiagnostics('closeTab: 干净预览标签直接关闭', { tabId });
      const wasActive = activeTabId === tabId;
      const index = tabs.findIndex((t) => t.id === tabId);
      tabs = tabs.filter((t) => t.id !== tabId);
      previewTabId = null;

      if (wasActive) {
        if (tabs.length > 0) {
          const newActiveIndex = Math.min(index, tabs.length - 1);
          activeTabId = tabs[newActiveIndex].id;
          loadTabState(tabs[newActiveIndex]);
        } else {
          activeTabId = '';
          markdown = '';
          savedMarkdown = '';
          fileName = '';
          filePath = '';
          nativePath = null;
          dirty = false;
          lastKnownModifiedAt = 0;
          largeDocumentMode = false;
          readonlyDocumentMode = false;
          externalFileChange = createEmptyExternalFileChange();
          outline = [];
          isSwitchingTab = true;
          try {
            if (editor) {
              editor.setMarkdown('', { reason: 'switch-tab', dirty: false, savedMarkdown: '' });
            }
          } finally {
            isSwitchingTab = false;
          }
        }
        updateWindowTitle();
      }
      persistWorkspaceState();
      return;
    }

    logCloseDiagnostics('closeTab: 交给 documentActions.closeTab 处理确认', {
      tabId,
      targetDirty: tabToClose.dirty,
    });
    await _documentCloseTab(tabId, event);

    // 关闭最后一个普通标签后清空编辑器状态
    if (tabs.length === 0) {
      markdown = '';
      savedMarkdown = '';
      fileName = '';
      filePath = '';
      nativePath = null;
      dirty = false;
      lastKnownModifiedAt = 0;
      largeDocumentMode = false;
      readonlyDocumentMode = false;
      externalFileChange = createEmptyExternalFileChange();
      outline = [];
      isSwitchingTab = true;
      try {
        if (editor) {
          editor.setMarkdown('', { reason: 'switch-tab', dirty: false, savedMarkdown: '' });
        }
      } finally {
        isSwitchingTab = false;
      }
      updateWindowTitle();
    }
  }

  function getDirtyTabs(candidateTabs: Tab[]) {
    const dirtyTabs = candidateTabs.filter((tab) => tab.dirty);
    const activeTab = candidateTabs.find((tab) => tab.id === activeTabId);
    if (dirty && activeTab && !dirtyTabs.some((tab) => tab.id === activeTab.id)) {
      return [
        ...dirtyTabs,
        {
          ...activeTab,
          markdown,
          savedMarkdown,
          dirty: true,
          version,
        },
      ];
    }
    return dirtyTabs;
  }
  const jumpToOutlineItem = outlineInteraction.jumpToOutlineItem;
  const updateActiveOutlineFromSourceScroll =
    outlineInteraction.updateActiveOutlineFromSourceScroll;
  const updateActiveOutlineFromSemanticScroll =
    outlineInteraction.updateActiveOutlineFromSemanticScroll;

  async function handleRefreshFolder() {
    if (currentFolderPath) {
      await loadFolder(currentFolderPath);
    }
  }

  function handleCollapseAll() {
    expandedFolders = new Set();
    // 保留根目录展开，只折叠子文件夹
  }

  // 步骤：打开删除确认对话框
  function handleDeleteNode(event: CustomEvent<{ path: string; isDir: boolean }>) {
    const { path, isDir } = event.detail;
    deleteConfirmPath = path;
    deleteConfirmIsDir = isDir;
    deleteConfirmName = path.includes('\\')
      ? path.slice(path.lastIndexOf('\\') + 1)
      : path.includes('/')
        ? path.slice(path.lastIndexOf('/') + 1)
        : path;
    deleteConfirmOpen = true;
  }

  // 步骤：执行删除操作
  async function executeDelete() {
    const path = deleteConfirmPath;
    const isDir = deleteConfirmIsDir;
    const typeLabel = isDir ? t.folder() : t.file();
    deleteConfirmOpen = false;

    try {
      await deleteFile(path);
      // 关闭受影响的标签页（精确匹配或以文件夹路径开头）
      const affectedTabs = tabs.filter((t) =>
        isDir
          ? t.nativePath && pathEqualsOrDescendsFrom(t.nativePath, path)
          : t.nativePath != null && sameNativePath(t.nativePath, path),
      );
      for (const tab of affectedTabs) {
        if (tab.id === previewTabId) {
          // 预览标签直接移除
          tabs = tabs.filter((t) => t.id !== tab.id);
          previewTabId = null;
        } else {
          closeTab(tab.id);
        }
      }
      // 如果删光了所有标签，清空状态不自动创建标签
      if (tabs.length === 0) {
        activeTabId = '';
        markdown = '';
        savedMarkdown = '';
        fileName = '';
        filePath = '';
        nativePath = null;
        dirty = false;
        lastKnownModifiedAt = 0;
        largeDocumentMode = false;
        readonlyDocumentMode = false;
        externalFileChange = createEmptyExternalFileChange();
        outline = [];
        isSwitchingTab = true;
        try {
          if (editor) {
            editor.setMarkdown('', { reason: 'switch-tab', dirty: false, savedMarkdown: '' });
          }
        } finally {
          isSwitchingTab = false;
        }
      }
      // 刷新文件夹
      if (currentFolderPath) {
        await loadFolder(currentFolderPath);
      }
      statusMessage = t.deletedType({ type: typeLabel });
    } catch (error) {
      statusMessage = t.deleteFailed({ error });
    }
  }

  function closeDeleteConfirm() {
    deleteConfirmOpen = false;
  }

  async function handleCreateNode(
    event: CustomEvent<{ parentPath: string; type: 'folder' | 'file'; name: string }>,
  ) {
    const { parentPath, type, name } = event.detail;
    let finalName = name || (type === 'folder' ? t.newFolder() : t.untitledMarkdown());
    finalName = finalName.replace(/[<>:"/\\|?*]/g, '');
    if (!finalName) finalName = type === 'folder' ? t.newFolder() : t.untitledMarkdown();
    if (type === 'file' && !finalName.toLowerCase().endsWith('.md')) {
      finalName += '.md';
    }

    const { join } = await import('@tauri-apps/api/path');
    let targetPath = await join(parentPath, finalName);

    const { statMarkdownFile } = await import('../lib/desktop/tauriStorage');
    let suffix = 1;
    let currentName = finalName;
    while (true) {
      const stat = await statMarkdownFile(targetPath).catch(() => null);
      if (!stat || !stat.exists) break;
      if (type === 'file') {
        const base = finalName.replace(/\.md$/i, '');
        currentName = `${base} (${suffix}).md`;
      } else {
        currentName = `${finalName} (${suffix})`;
      }
      targetPath = await join(parentPath, currentName);
      suffix++;
    }

    if (type === 'folder') {
      const { createFolder } = await import('../lib/desktop/tauriStorage');
      await createFolder(targetPath).catch((err) => {
        statusMessage = t.createFolderFailed({ error: err });
      });
      await loadFolder(currentFolderPath);
      expandAncestors(targetPath, currentFolderPath);
    } else {
      const { saveMarkdownNative } = await import('../lib/desktop/tauriStorage');
      const defaultContent = `# ${currentName.replace(/\.md$/i, '')}\n\n`;
      const result = await saveMarkdownNative(targetPath, defaultContent, currentName);
      if (result) {
        await loadFolder(currentFolderPath);
        expandAncestors(targetPath, currentFolderPath);
        openRecentEntry(targetPath, 'file');
      }
    }
  }

  async function handleRenameNode(event: CustomEvent<{ path: string; newName: string }>) {
    const { path, newName } = event.detail;
    let finalName = newName.replace(/[<>:"/\\|?*]/g, '');
    if (!finalName) return;

    const { dirname, join } = await import('@tauri-apps/api/path');
    const parentDir = await dirname(path);
    const targetPath = await join(parentDir, finalName);

    if (path === targetPath) return;

    const { renameFile } = await import('../lib/desktop/tauriStorage');
    await renameFile(path, targetPath).catch((err) => {
      statusMessage = t.renameFailed({ error: err });
    });

    await loadFolder(currentFolderPath);

    tabs.forEach((t) => {
      if (t.nativePath && pathEqualsOrDescendsFrom(t.nativePath, path)) {
        const newNativePath = t.nativePath.replace(path, targetPath);
        t.nativePath = newNativePath;
        t.filePath = newNativePath;
        if (sameNativePath(t.nativePath, targetPath)) {
          t.fileName = finalName;
        }
        if (activeTabId === t.id) {
          fileName = t.fileName;
          filePath = t.filePath;
          nativePath = t.nativePath;
        }
      }
    });
    tabs = [...tabs];
    persistWorkspaceState();
  }

  const unsubscribe = editor.subscribe(syncFromEditor);

  async function applyAppPreferences(
    preferences: AppPreferences,
    options: { applyEditorMode?: boolean; refreshInterfaceChrome?: boolean } = {},
  ) {
    themePreference = preferences.theme;
    if (themePreference === 'system') {
      await syncSystemThemeFromDesktop({ transition: true });
    } else {
      theme = applyThemeSetting(themePreference, { transition: true });
      await syncDesktopIconTheme(theme);
    }
    interfaceLanguage = preferences.interfaceLanguage;
    interfaceLocale = applyInterfaceLanguagePreference(interfaceLanguage);
    if (options.refreshInterfaceChrome) {
      void refreshInterfaceLanguageChrome(desktopEnabled);
    }
    fontSize = preferences.fontSize;
    lineHeight = preferences.lineHeight;
    contentWidthPercent = preferences.contentWidthPercent;
    blockStyle = preferences.blockStyle;
    imageSettings = preferences.imageHandlingSettings;
    folderOpenDefaultBehavior = preferences.folderOpenDefaultBehavior;
    filePreviewEnabled = preferences.filePreviewEnabled;
    closeWindowBehavior = preferences.closeWindowBehavior;
    focusMode = preferences.sidebarHidden;
    outlineVisible = preferences.outlineVisible;
    writingStatsVisible = preferences.writingStatsVisible;
    writingStatsMetric = preferences.writingStatsMetric;
    readingTimeVisible = preferences.readingTimeVisible;
    largeDocumentLimit = preferences.largeDocumentLimit;
    autoSaveDelayMs = preferences.autoSaveDelayMs;
    createSnapshotBeforeSave = preferences.createSnapshotBeforeSave;
    defaultCodeBlockLanguage = preferences.defaultCodeBlockLanguage;
    defaultDiagramType = preferences.defaultDiagramType;
    zoomPercent = preferences.zoomPercent;
    ctrlWheelZoomEnabled = preferences.ctrlWheelZoomEnabled;
    outlineDefaultExpandLevel = preferences.outlineDefaultExpandLevel;
    codeBlockLineNumbersVisible = preferences.codeBlockLineNumbersVisible;
    codeBlockIndent = preferences.codeBlockIndent;
    inlineCodeRenderingEnabled = preferences.inlineCodeRenderingEnabled;
    shortcutPreferences = preferences.shortcutPreferences;
    developerMode = preferences.developerMode;

    if (!filePreviewEnabled) {
      previewTabId = null;
    }
    if (autoSaveEnabled && !preferences.autoSaveEnabled) {
      documentActions.cancelPendingAutoSaves();
    }
    autoSaveEnabled = preferences.autoSaveEnabled;

    applyTypographySettings(fontSize, lineHeight);
    applyEditorLayoutSettings(contentWidthPercent);
    applyBlockStyleSetting(blockStyle);
    applyZoomSetting(zoomPercent, { onFrame: refreshEditorViewportLayout });
    applyCodeBlockLineNumberSetting(codeBlockLineNumbersVisible);
    document.documentElement.dataset.codeBlockIndent = codeBlockIndent;
    editor.updateTheme({ name: theme });
    editor.updateOptions({ inlineCodeRenderingEnabled });
    applyOutlineDefaultExpansion();

    const shouldBeLargeDocument = markdown.length > largeDocumentLimit;
    if (!shouldBeLargeDocument && largeDocumentMode) {
      largeDocumentMode = false;
      readonlyDocumentMode = false;
      editor.updateOptions({ mode });
    } else if (shouldBeLargeDocument && !largeDocumentMode) {
      largeDocumentMode = true;
      readonlyDocumentMode = true;
      mode = 'source';
      editor.updateOptions({ mode: 'source' });
      statusMessage = t.largeDocumentReadonly();
    }

    if (options.applyEditorMode && !largeDocumentMode) {
      mode = preferences.editorMode;
      editor.updateOptions({ mode: preferences.editorMode });
    }

    if (preferences.developerMode) {
      enableLogger();
    } else {
      disableLogger();
    }

    persistWorkspaceState();
  }

  function getCurrentAppPreferences(): AppPreferences {
    return normalizeAppPreferences({
      theme: themePreference,
      interfaceLanguage,
      editorMode: mode,
      autoSaveEnabled,
      autoSaveDelayMs,
      createSnapshotBeforeSave,
      fontSize,
      lineHeight,
      contentWidthPercent,
      blockStyle,
      largeDocumentLimit,
      folderOpenDefaultBehavior,
      filePreviewEnabled,
      closeWindowBehavior,
      sidebarHidden: focusMode,
      outlineVisible,
      writingStatsVisible,
      writingStatsMetric,
      readingTimeVisible,
      defaultCodeBlockLanguage,
      defaultDiagramType,
      zoomPercent,
      ctrlWheelZoomEnabled,
      outlineDefaultExpandLevel,
      codeBlockLineNumbersVisible,
      codeBlockIndent,
      inlineCodeRenderingEnabled,
      shortcutPreferences,
      imageHandlingSettings: imageSettings,
      developerMode,
    });
  }

  async function applyAppPreferencesPatch(patch: AppPreferencesPatch) {
    const preferences = normalizeAppPreferences({
      ...getCurrentAppPreferences(),
      ...patch,
      imageHandlingSettings: patch.imageHandlingSettings ?? imageSettings,
      shortcutPreferences: patch.shortcutPreferences ?? shortcutPreferences,
    });
    await applyAppPreferences(preferences, {
      applyEditorMode: 'editorMode' in patch,
      refreshInterfaceChrome: false,
    });
  }

  function isSettingsUpdatedPayload(payload: unknown): payload is SettingsUpdatedPayload {
    return Boolean(
      payload &&
      typeof payload === 'object' &&
      (payload as SettingsUpdatedPayload).source === 'settings-window',
    );
  }

  function applyOutlineDefaultExpansion() {
    if (outlineDefaultExpandLevel >= 6) {
      collapsedOutlineIds = new Set();
      return;
    }

    const nextCollapsedIds = new Set<string>();
    outline.forEach((item, index) => {
      const next = outline[index + 1];
      if (item.level >= outlineDefaultExpandLevel && next && next.level > item.level) {
        nextCollapsedIds.add(item.id);
      }
    });
    collapsedOutlineIds = nextCollapsedIds;
  }

  async function reloadAppPreferencesFromSettingsWindow() {
    const preferences = await loadAppPreferences(desktopEnabled);
    await applyAppPreferences(preferences, { applyEditorMode: true, refreshInterfaceChrome: true });
  }

  async function handleSettingsUpdated(payload: unknown) {
    if (!isSettingsUpdatedPayload(payload) || !payload.patch || typeof payload.patch !== 'object') {
      await reloadAppPreferencesFromSettingsWindow();
      return;
    }

    await applyAppPreferencesPatch(payload.patch);
  }

  async function maybeOpenFirstRunSample(state: FirstRunSampleState) {
    if (!desktopEnabled) {
      return;
    }

    if (shouldOpenFirstRunSample(state)) {
      try {
        const document = await installSampleDocument();
        await documentActions.applyNativeDocument(document, t.sampleOpened());
        await updateAppSetting(FIRST_RUN_SAMPLE_DOCUMENT_OPEN_ERROR_KEY, '').catch(() => undefined);
        await updateAppSetting(FIRST_RUN_SAMPLE_DOCUMENT_OPENED_KEY, true).catch(() => undefined);
      } catch (error) {
        const message = t.sampleOpenFailed({
          error: error instanceof Error ? error.message : String(error),
        });
        await updateAppSetting(FIRST_RUN_SAMPLE_DOCUMENT_OPEN_ERROR_KEY, message).catch(
          () => undefined,
        );
        statusMessage = message;
        showToast(message, 3500);
        return;
      }
      return;
    }

    if (shouldMarkFirstRunSampleHandled(state)) {
      await updateAppSetting(FIRST_RUN_SAMPLE_DOCUMENT_OPENED_KEY, true).catch(() => undefined);
    }
  }

  function scheduleStartupFolderLoad() {
    if (
      !desktopEnabled ||
      !startupFolderPath ||
      startupFolderLoadScheduled ||
      startupFolderLoadInProgress
    ) {
      return;
    }

    const folderPath = startupFolderPath;
    startupFolderPath = '';
    startupFolderLoadScheduled = true;

    const runStartupFolderLoad = () => {
      void (async () => {
        startupFolderLoadScheduled = false;
        startupFolderLoadInProgress = true;
        try {
          await loadFolder(folderPath);
          if (
            nativePath &&
            currentFolderPath &&
            sameFileSystemPath(currentFolderPath, folderPath)
          ) {
            await expandAncestors(nativePath, currentFolderPath);
          }
          await rememberNativeFolder(folderPath);
          await refreshRecentFiles();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          statusMessage = `${t.loadFolderTreeFailed()}：${message}`;
        } finally {
          startupFolderLoadInProgress = false;
        }
      })();
    };

    if (typeof queueMicrotask === 'function') {
      queueMicrotask(runStartupFolderLoad);
      return;
    }

    window.setTimeout(runStartupFolderLoad, 0);
  }

  async function restoreWindowWorkspaceState(
    settings: Awaited<ReturnType<typeof listAppSettings>>,
  ) {
    if (!desktopEnabled || !windowLabel) return;
    const workspaceTabsKey = windowLabel ? `workspaceTabs:${windowLabel}` : 'workspaceTabs';
    const workspaceTabsSetting =
      settings.find((s) => s.key === workspaceTabsKey) ??
      settings.find((s) => s.key === 'workspaceTabs');
    if (!workspaceTabsSetting) return;
    const result = await migrateWorkspaceSetting(workspaceTabsSetting).catch(() => null);
    if (!result) return;
    if (result.migrated) {
      await updateAppSetting(workspaceTabsKey, result.state).catch(() => undefined);
    }
    await restorePersistedWorkspaceState(result.state);
  }

  onMount(async () => {
    appBootState = 'restoring-workspace';
    try {
      desktopEnabled = isTauriRuntime();
      window.addEventListener('wheel', handleGlobalWheel, { capture: true, passive: false });
      setupSystemThemeListener();
      let persistedEditorMode: EditorMode | null = null;
      let settings: Awaited<ReturnType<typeof listAppSettings>> = [];
      let restoredWorkspaceTabs = false;
      let hasPendingFolder = false;

      if (desktopEnabled) {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        windowLabel = getCurrentWindow().label;
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('refresh_window_menu').catch(() => undefined);
        await setupCriticalDesktopEvents();

        settings = await listAppSettings().catch(() => []);
        await loadReadingPositions();

        // 先读取待处理的外部打开路径和文件夹，再决定如何恢复工作区
        const pendingExternalOpenSetting = settings.find(
          (s) => s.key === `pendingExternalOpen:${windowLabel}`,
        );
        if (pendingExternalOpenSetting) {
          try {
            const paths = JSON.parse(pendingExternalOpenSetting.valueJson);
            if (Array.isArray(paths)) {
              pendingExternalOpenPaths = paths.filter(
                (path): path is string => typeof path === 'string',
              );
            }
            await updateAppSetting(`pendingExternalOpen:${windowLabel}`, '').catch(() => undefined);
          } catch {
            // ignore
          }
        }

        let pendingFolderPath = '';
        const pendingFolderSetting = settings.find((s) => s.key === `pendingFolder:${windowLabel}`);
        if (pendingFolderSetting) {
          try {
            const folderPath = JSON.parse(pendingFolderSetting.valueJson);
            if (folderPath && typeof folderPath === 'string' && folderPath.length > 0) {
              pendingFolderPath = folderPath;
              hasPendingFolder = true;
              await updateAppSetting(`pendingFolder:${windowLabel}`, '').catch(() => undefined);
            }
          } catch {
            // ignore
          }
        }

        if (pendingExternalOpenPaths.length > 0) {
          // 双击 md 文件启动：不恢复上次工作区，稍后单独加载文件所在目录并打开该文件
          restoredWorkspaceTabs = false;
        } else {
          await restoreWindowWorkspaceState(settings);
          restoredWorkspaceTabs = tabs.length > 0;

          // 若待打开文件夹与恢复的工作区不同，先清除旧标签页
          if (
            pendingFolderPath &&
            currentFolderPath &&
            !sameFileSystemPath(currentFolderPath, pendingFolderPath)
          ) {
            clearAllTabsWithoutCreatingBlank();
            restoredWorkspaceTabs = false;
          }
          if (pendingFolderPath) {
            currentFolderPath = pendingFolderPath;
            startupFolderPath = pendingFolderPath;
          }
        }

        const appPreferences = await loadAppPreferences(desktopEnabled, settings);
        await applyAppPreferences(appPreferences, { applyEditorMode: false });
        persistedEditorMode = appPreferences.editorMode;
      }

      if (persistedEditorMode && !largeDocumentMode) {
        mode = persistedEditorMode;
        editor.updateOptions({ mode: persistedEditorMode });
        scheduleRestoreReadingPosition(filePath, persistedEditorMode);
      }
      // 确保 blockStyle 默认值写入 DOM
      applyBlockStyleSetting(blockStyle);
      await setupDesktopEvents();
      await refreshRecentFiles();
      if (pendingExternalOpenPaths.length === 0) {
        await maybeOpenFirstRunSample({
          settings,
          recentFilesCount: recentFiles.length,
          restoredWorkspaceTabs,
          hasPendingFolder,
        });
      }
      if (pendingExternalOpenPaths.length > 0) {
        appBootState = 'opening-file';
        await openStartupExternalMarkdownPaths(pendingExternalOpenPaths);
      } else {
        scheduleStartupFolderLoad();
      }
      pendingExternalOpenPaths = [];
      window.addEventListener('keydown', handleGlobalShortcut);
      fileCheckTimer = window.setInterval(() => {
        void checkExternalFileChange();
        void syncExplorerWithFileSystem();
      }, 5000);
      await tick();
      syncSourceTextareaHeight();
      await updateWindowTitle().catch(() => undefined);
    } finally {
      appBootState = 'ready';
    }
  });

  onDestroy(() => {
    // 组件销毁前立即持久化工作区状态和阅读位置
    void flushPersistWorkspaceState();
    saveCurrentReadingPositionToMemoryOnly();
    void flushReadingPositions();
    _unsubConfirmStore();
    for (const unlisten of desktopUnlisteners) unlisten();
    if (fileCheckTimer !== null) window.clearInterval(fileCheckTimer);
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    if (linkOpeningTimer !== null) window.clearTimeout(linkOpeningTimer);
    window.removeEventListener('keydown', handleGlobalShortcut);
    window.removeEventListener('wheel', handleGlobalWheel, { capture: true });
    detachMountedEditorHostEvents();
    if (systemThemeMediaQuery && systemThemeChangeHandler) {
      systemThemeMediaQuery.removeEventListener('change', systemThemeChangeHandler);
    }
    sidebarResize.destroy();
    unsubscribe();
    editor.destroy();
  });

  function syncFromEditor(event: EditorChangeEvent) {
    if (isSwitchingTab) return;

    const markdownChanged = event.markdown !== markdown;

    // 预览标签页开始编辑 → 自动固定
    if (markdownChanged && previewTabId && previewTabId === activeTabId && event.dirty) {
      previewTabId = null;
    }

    dirty = event.dirty;
    if (!event.dirty) {
      savedMarkdown = event.markdown;
    }
    version = event.version;
    mode = event.mode;
    pendingInlineMarks = event.pendingInlineMarks;

    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab) {
      activeTab.dirty = dirty;
      activeTab.version = version;
      if (!dirty) {
        activeTab.savedMarkdown = event.markdown;
      }
    }

    if (!markdownChanged) {
      if (activeTab) {
        tabs = [...tabs];
        persistWorkspaceState();
      }
      return;
    }

    markdown = event.markdown;
    const analysis = analyzeMarkdown(event.markdown);
    outline = analysis.outline;
    if (!outline.some((item) => item.id === activeOutlineId))
      activeOutlineId = outline[0]?.id ?? '';
    pruneCollapsedOutlineIds();
    stats = analysis.stats;

    if (activeTab) {
      activeTab.markdown = markdown;
      if (!dirty) {
        activeTab.savedMarkdown = markdown;
      }
      tabs = [...tabs];
      schedulePersistWorkspaceDrafts();
      persistWorkspaceState();
    }

    if (autoSaveEnabled && desktopEnabled && dirty && nativePath) {
      documentActions.debouncedAutoSave(event.markdown);
    }

    if (event.reason === 'source-input') {
      return;
    }

    if (event.markdown.length > largeDocumentLimit) {
      syncSourceTextareaHeight();
      return;
    }
    syncSourceTextareaHeight();
  }

  function openTablePicker() {
    tablePickerOpen = true;
  }

  function closeTablePicker() {
    tablePickerOpen = false;
  }

  function openLinkPicker() {
    if (readonlyDocumentMode) {
      statusMessage = t.readonlyCannotEditLink();
      return;
    }
    if (mode !== 'semantic') {
      statusMessage = t.switchSemanticBeforeEditLink();
      return;
    }

    const activeLink = editor.getActiveLink();
    linkText = activeLink?.text ?? '';
    linkHref = activeLink?.href ?? '';
    linkCanRemove = Boolean(activeLink?.active);
    linkDraftTitle = activeLink?.title ?? null;
    linkPickerPositionStyle = getLinkPickerPositionStyle(editor.getSelectionAnchorRect());
    linkError = '';
    tablePickerOpen = false;
    linkPickerOpen = true;
  }

  function openLinkFromEditor(href: string) {
    const token = ++linkOpeningToken;
    linkOpening = true;
    statusMessage = t.openingLink();
    if (linkOpeningTimer !== null) window.clearTimeout(linkOpeningTimer);

    const minimumVisibleTime = new Promise<void>((resolve) => {
      linkOpeningTimer = window.setTimeout(resolve, 700);
    });

    Promise.all([
      openExternalLink(href).catch((error) => {
        statusMessage = t.openLinkFailed({ error });
      }),
      minimumVisibleTime,
    ]).finally(() => {
      if (token === linkOpeningToken) {
        linkOpening = false;
        linkOpeningTimer = null;
      }
    });
  }

  function closeLinkPicker() {
    linkPickerOpen = false;
    linkText = '';
    linkError = '';
    linkCanRemove = false;
  }

  function updateLinkText(event: Event) {
    linkText = (event.currentTarget as HTMLInputElement).value;
  }

  function updateLinkHref(event: Event) {
    linkHref = (event.currentTarget as HTMLInputElement).value;
    if (linkError) linkError = '';
  }

  function applyLink() {
    if (!linkHref.trim()) {
      linkError = t.linkHrefRequired();
      return;
    }

    const applied = editor.execute({
      type: 'insertLink',
      href: linkHref,
      title: linkDraftTitle ?? undefined,
      text: linkText,
    });
    if (!applied) {
      linkError = t.linkHrefInvalid();
      return;
    }

    closeLinkPicker();
    editor.focus();
  }

  function getLinkPickerPositionStyle(anchorRect: EditorAnchorRect | null) {
    if (typeof window === 'undefined') return '';

    const popoverWidth = 392;
    const popoverHeight = 118;
    const viewportGap = 12;
    const fallbackLeft = window.innerWidth / 2 - popoverWidth / 2;
    const fallbackTop = 116;
    const baseLeft = anchorRect?.left ?? fallbackLeft;
    const baseTop = anchorRect ? anchorRect.bottom + 10 : fallbackTop;
    const maxLeft = Math.max(viewportGap, window.innerWidth - popoverWidth - viewportGap);
    const left = Math.min(Math.max(baseLeft, viewportGap), maxLeft);
    const top =
      baseTop + popoverHeight > window.innerHeight
        ? Math.max(viewportGap, (anchorRect?.top ?? fallbackTop) - popoverHeight - 10)
        : baseTop;

    return `left: ${Math.round(left)}px; top: ${Math.round(top)}px;`;
  }

  function removeLink() {
    const removed = editor.execute({ type: 'removeLink' });
    if (!removed) {
      linkError = t.linkNothingToRemove();
      return;
    }

    closeLinkPicker();
    editor.focus();
  }

  function insertTableWithSize(rows: number, columns: number) {
    runCommand({ type: 'insertTable', rows, columns });
    closeTablePicker();
  }

  function editFrontMatter() {
    if (readonlyDocumentMode) {
      statusMessage = t.readonlyCannotEditMetadata();
      return;
    }
    const hasFrontMatter = Boolean(extractFrontMatterBlock(editor.getMarkdown()));
    if (!hasFrontMatter) {
      editor.execute({ type: 'insertFrontMatter' });
      frontMatterFocusTarget = 'title-value';
      frontMatterFocusRequest += 1;
    } else {
      frontMatterFocusTarget = 'default';
    }
    frontMatterEditing = true;
  }

  function enterFrontMatterEdit() {
    if (readonlyDocumentMode) {
      statusMessage = t.readonlyCannotEditMetadata();
      return;
    }
    frontMatterFocusTarget = 'default';
    frontMatterEditing = true;
  }

  function leaveFrontMatterEdit() {
    frontMatterEditing = false;
  }

  function updateFrontMatterContent(content: string) {
    if (readonlyDocumentMode) {
      return;
    }
    editor.setMarkdown(replaceFrontMatterContent(editor.getMarkdown(), content));
  }

  function deleteFrontMatter() {
    if (readonlyDocumentMode) {
      statusMessage = t.readonlyCannotDeleteMetadata();
      return;
    }
    frontMatterEditing = false;
    editor.setMarkdown(removeFrontMatter(editor.getMarkdown()));
  }

  function showToast(message: string, durationMs = 1500) {
    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
    }
    toastMessage = message;
    toastTimer = window.setTimeout(() => {
      toastMessage = '';
      toastTimer = null;
    }, durationMs);
  }

  function showUnavailableFeature(featureName: string) {
    showToast(t.featureComingSoon({ featureName }));
  }

  async function handleExport(format: 'html' | 'pdf') {
    if (!nativePath && !markdown.trim()) {
      showToast(t.noOpenDocumentForExport(), 2000);
      return;
    }

    const { exportHtml, exportPdf } = await import('./services/exportService');
    const renderedHtml = editorHost?.innerHTML ?? '';
    const suggestedFileName = fileName.replace(/\.(md|markdown|txt)$/i, '') || 'Untitled';

    const result =
      format === 'html'
        ? await exportHtml({
            markdown,
            renderedHtml,
            documentPath: nativePath,
            suggestedFileName,
            title: fileName || 'Untitled',
          })
        : await exportPdf({
            markdown,
            renderedHtml,
            documentPath: nativePath,
            suggestedFileName,
            title: fileName || 'Untitled',
          });

    if (result.cancelled) {
      return;
    }

    if (result.success) {
      const message =
        format === 'html'
          ? t.exportHtmlSuccess({ path: result.filePath! })
          : t.exportPdfSuccess({ path: result.filePath! });
      showToast(message, 2500);
    } else {
      showToast(result.error ?? t.exportFailed(), 3500);
    }
  }

  $: visibleOutlineIds = new Set(
    outline
      .filter((_item, index) => getOutlineItemVisible(outline, collapsedOutlineIds, index))
      .map((item) => item.id),
  );

  $: frontMatter = extractFrontMatterBlock(markdown);
  $: if (!frontMatter) {
    frontMatterEditing = false;
    frontMatterFocusTarget = 'default';
  }
  $: {
    const signature = `${searchPanelOpen}|${mode}|${searchQuery}|${searchCaseSensitive}|${markdown}|${version}`;
    if (signature !== lastSearchSignature) {
      lastSearchSignature = signature;
      refreshSearchMatches({ preserveActive: true, selectActive: false });
    }
  }

  async function setupCriticalDesktopEvents() {
    if (!desktopEnabled || criticalDesktopEventsReady) {
      return;
    }

    const { listen } = await import('@tauri-apps/api/event');
    const [exitRequestUnlisten, closeRequestUnlisten] = await Promise.all([
      listen('nomo://request-exit-app', () => {
        requestExitApp().catch(() => undefined);
      }).catch(() => null),
      listen<{ windowLabel?: string; window_label?: string }>(
        'nomo://request-close-window',
        (event) => {
          // 多窗口场景下过滤只响应当前窗口的关闭请求，避免所有窗口同时弹出确认
          const requestedWindowLabel = event.payload?.windowLabel ?? event.payload?.window_label;
          if (requestedWindowLabel !== windowLabel) return;
          closeCurrentWindow().catch(() => undefined);
        },
      ).catch(() => null),
    ]);

    criticalDesktopEventsReady = true;
    desktopUnlisteners = [...desktopUnlisteners, exitRequestUnlisten, closeRequestUnlisten].filter(
      (value): value is () => void => Boolean(value),
    );
  }

  async function setupDesktopEvents() {
    if (!desktopEnabled) {
      return;
    }

    const { listen } = await import('@tauri-apps/api/event');
    const [
      menuUnlisten,
      dropUnlisten,
      settingsUnlisten,
      updateInstallRequestUnlisten,
      openDocumentUnlisten,
      openFolderUnlisten,
      folderIndexBatchUnlisten,
      folderIndexFinishedUnlisten,
    ] = await Promise.all([
      listenDesktopMenuCommands((command) => {
        executeDesktopCommand(command);
      }).catch(() => null),
      listenDesktopFileDrops((paths) => {
        openDroppedMarkdown(paths);
      }).catch(() => null),
      listen<SettingsUpdatedPayload>(SETTINGS_UPDATED_EVENT, (event) => {
        handleSettingsUpdated(event.payload).catch(() => undefined);
      }).catch(() => null),
      listen<{ requestId?: string }>('nomo://request-update-install', (event) => {
        const requestId = event.payload?.requestId;
        if (typeof requestId === 'string' && requestId.length > 0) {
          approveSoftwareUpdateInstall(requestId).catch(() => undefined);
        }
      }).catch(() => null),
      listenDesktopOpenDocuments((paths, targetWindowLabel) => {
        if (targetWindowLabel && targetWindowLabel !== windowLabel) {
          return;
        }
        if (windowLabel) {
          updateAppSetting(`pendingExternalOpen:${windowLabel}`, '').catch(() => undefined);
        }
        openExternalMarkdownPaths(paths).catch(() => undefined);
      }).catch(() => null),
      listenDesktopOpenFolder((folderPath, targetWindowLabel) => {
        if (targetWindowLabel && targetWindowLabel !== windowLabel) {
          return;
        }
        if (windowLabel) {
          updateAppSetting(`pendingFolder:${windowLabel}`, '').catch(() => undefined);
        }
        openFolderWithBehavior(folderPath).catch(() => undefined);
      }).catch(() => null),
      listenFolderIndexBatches((payload) => {
        folderExplorer.applyIndexBatch(payload);
      }).catch(() => null),
      listenFolderIndexFinished((payload) => {
        folderExplorer.finishIndexing(payload);
      }).catch(() => null),
    ]);

    desktopUnlisteners = [
      ...desktopUnlisteners,
      menuUnlisten,
      dropUnlisten,
      settingsUnlisten,
      updateInstallRequestUnlisten,
      openDocumentUnlisten,
      openFolderUnlisten,
      folderIndexBatchUnlisten,
      folderIndexFinishedUnlisten,
    ].filter((value): value is () => void => Boolean(value));
  }

  async function openExternalMarkdownPaths(paths: string[]) {
    if (!desktopEnabled || paths.length === 0) {
      return;
    }

    const supportedPaths = paths.filter((path) => /\.(md|markdown|txt)$/i.test(path));
    for (const path of supportedPaths) {
      await openRecentEntry(path, 'file');
    }
  }

  // 双击 md 文件启动：不恢复上次工作区，只打开文件所在目录并打开该文件
  async function openStartupExternalMarkdownPaths(paths: string[]) {
    if (!desktopEnabled || paths.length === 0) {
      return;
    }

    const supportedPaths = paths.filter((path) => /\.(md|markdown|txt)$/i.test(path));
    if (supportedPaths.length === 0) {
      return;
    }

    // 丢弃恢复的标签，避免上次工作区干扰
    clearAllTabsWithoutCreatingBlank({ skipPersist: true });

    const firstPath = supportedPaths[0];
    const parentDir = getDirectoryLabel(firstPath);

    if (parentDir && parentDir !== t.currentFolder()) {
      currentFolderPath = parentDir;
      await loadFolder(parentDir).catch(() => undefined);
      await rememberNativeFolder(parentDir).catch(() => undefined);
    }

    for (const path of supportedPaths) {
      await openRecentFile(path);
    }
  }

  function executeDesktopCommand(command: string) {
    executeDesktopAppCommand(command, commandHandlers);
  }

  function handleGlobalShortcut(event: KeyboardEvent) {
    handleGlobalAppShortcut(event, commandHandlers, shortcutPreferences);
  }

  // 使用 capture 阶段在事件到达可滚动元素之前拦截，
  // 避免浏览器对可滚动元素的 wheel 事件强制 passive 导致 preventDefault 失效。
  function handleGlobalWheel(event: WheelEvent) {
    if (!ctrlWheelZoomEnabled || !event.ctrlKey) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target?.closest('.editor-grid')) {
      return;
    }

    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    const nextZoom = Math.min(160, Math.max(80, zoomPercent + direction * 5));
    if (nextZoom === zoomPercent) {
      return;
    }
    zoomPercent = nextZoom;
    const anchor = saveScrollAnchor();
    applyZoomSetting(zoomPercent, {
      transition: true,
      onFrame: () => {
        refreshEditorViewportLayout();
        restoreScrollAnchor(anchor);
      },
    });
    updateAppSetting('zoomPercent', zoomPercent).catch(() => undefined);
    statusMessage = t.zoomStatus({ percent: zoomPercent });
  }

  // 步骤1：校验目标缩放值并更新状态
  // 步骤2：保存滚动锚点，缩放后恢复阅读位置
  // 步骤3：应用缩放动画并持久化到设置
  function handleZoomChange(nextZoom: number) {
    const clamped = Math.min(160, Math.max(80, nextZoom));
    if (clamped === zoomPercent) {
      return;
    }
    zoomPercent = clamped;
    const anchor = saveScrollAnchor();
    applyZoomSetting(zoomPercent, {
      transition: true,
      onFrame: () => {
        refreshEditorViewportLayout();
        restoreScrollAnchor(anchor);
      },
    });
    updateAppSetting('zoomPercent', zoomPercent).catch(() => undefined);
    statusMessage = t.zoomStatus({ percent: zoomPercent });
  }

  // 记录当前可见面板中视口中心内容的相对位置（0~1），
  // 缩放后按相同比例恢复 scrollTop，保持阅读位置不变。
  function saveScrollAnchor(): { pane: HTMLElement; ratio: number } | null {
    const pane = mode === 'source' ? sourcePane : semanticPane;
    if (!pane) return null;
    const maxScroll = pane.scrollHeight - pane.clientHeight;
    if (maxScroll <= 0) return null;
    const ratio = (pane.scrollTop + pane.clientHeight / 2) / pane.scrollHeight;
    return { pane, ratio };
  }

  function restoreScrollAnchor(anchor: { pane: HTMLElement; ratio: number } | null) {
    if (!anchor) return;
    const { pane, ratio } = anchor;
    const maxScroll = pane.scrollHeight - pane.clientHeight;
    if (maxScroll <= 0) return;
    setScrollTop(pane, ratio * pane.scrollHeight - pane.clientHeight / 2);
  }

  function setupSystemThemeListener() {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemThemeChangeHandler = () => {
      if (themePreference !== 'system') {
        return;
      }
      syncSystemThemeFromDesktop({ transition: true }).catch(() => undefined);
    };
    systemThemeMediaQuery.addEventListener('change', systemThemeChangeHandler);
  }

  async function loadFolder(folderPath: string) {
    await folderExplorer.loadFolder(folderPath);
  }

  function getSourceLineHeight() {
    return outlineInteraction.getSourceLineHeight();
  }

  function handleDeletedImageResources(event: EditorImageDeletionEvent) {
    const loader = getImageLoader();
    if (!imageSettings.autoDeleteUnusedLocalImages || !loader?.remove || event.srcs.length === 0) {
      return;
    }

    const context = getImageContext();
    Promise.allSettled(event.srcs.map((src) => loader.remove!(src, context))).then((results) => {
      const removed = results.filter(
        (result) => result.status === 'fulfilled' && result.value.removed,
      ).length;
      const failed = results.filter(
        (result) =>
          result.status === 'rejected' ||
          (result.status === 'fulfilled' && Boolean(result.value.error)),
      ).length;

      if (removed > 0 && failed > 0) {
        statusMessage = t.imageCleanupRemovedFailed({ removed, failed });
      } else if (removed > 0) {
        statusMessage = t.imageCleanupRemoved({ removed });
      } else if (failed > 0) {
        statusMessage = t.imageCleanupFailed({ failed });
      }
    });
  }

  function getImageContext(): ImageContext {
    const documentPath = nativePath ?? filePath;
    const documentDir = getParentPath(documentPath);
    return {
      documentPath,
      documentFileName: fileName,
      documentDir,
      assetsDirectory: documentDir ? joinPath(documentDir, 'assets') : undefined,
      settings: imageSettings,
    };
  }

  function getParentPath(path: string | null | undefined): string | undefined {
    if (!path) {
      return undefined;
    }
    const normalized = path.replace(/\\/g, '/');
    const index = normalized.lastIndexOf('/');
    if (index <= 0) {
      return undefined;
    }
    return path.slice(0, index);
  }

  function joinPath(parent: string, child: string): string {
    const separator = parent.includes('\\') ? '\\' : '/';
    return `${parent.replace(/[\\/]+$/, '')}${separator}${child}`;
  }

  function writeRecoveryDraft(reason: string) {
    writeRecoveryDraftToStorage(RECOVERY_KEY, {
      reason,
      fileName,
      filePath,
      nativePath,
      markdown: editor.getMarkdown(),
    });
  }

  function createEmptyPendingInlineMarks(): InlinePendingMarks {
    return {
      strong: false,
      em: false,
      code: false,
      strikethrough: false,
      underline: false,
      highlight: false,
    };
  }
</script>

<svelte:head>
  <title>{t.appName()}</title>
</svelte:head>

<AppShell
  {interfaceLocale}
  {appBootState}
  bind:fileInput
  bind:sourcePane
  bind:semanticPane
  bind:sourceTextarea
  bind:editorHost
  {focusMode}
  {isResizing}
  {contentWidthPercent}
  {theme}
  {desktopEnabled}
  {activeMenu}
  {recentFiles}
  {missingRecentPaths}
  {mode}
  {outlineVisible}
  {currentFolderPath}
  {rootFolderExpanded}
  {folderTree}
  {expandedFolders}
  {nativePath}
  {dirty}
  {fileName}
  {filePath}
  {sidebarWidth}
  {tabs}
  {activeTabId}
  {previewTabId}
  {markdown}
  {largeDocumentMode}
  {frontMatter}
  {frontMatterEditing}
  {frontMatterFocusRequest}
  {frontMatterFocusTarget}
  {readonlyDocumentMode}
  {outline}
  {activeOutlineId}
  {collapsedOutlineIds}
  {visibleOutlineIds}
  {stats}
  {writingStatsVisible}
  {writingStatsMetric}
  {readingTimeVisible}
  {zoomPercent}
  {tablePickerOpen}
  {linkPickerOpen}
  {linkText}
  {linkHref}
  {linkError}
  {linkCanRemove}
  {linkPickerPositionStyle}
  {searchPanelOpen}
  {searchReplaceVisible}
  {searchQuery}
  {searchReplacement}
  {searchCaseSensitive}
  {searchActiveIndex}
  {searchMatchCount}
  {getCompactPath}
  {getFolderName}
  {getDirectoryLabel}
  {toggleMenu}
  {closeMenu}
  {toggleTheme}
  {minimizeWindow}
  {maximizeWindow}
  {closeAppWindow}
  {exitApp}
  {createNewWindow}
  {createNewFile}
  {openFileDialog}
  {openFolderDialog}
  {openRecentEntry}
  {openPreviewFile}
  pinPreviewFile={pinPreviewTab}
  {clearRecentEntriesList}
  {removeRecentEntry}
  {closeCurrentFile}
  {closeCurrentWindow}
  {saveMarkdownFile}
  {runCommand}
  {pendingInlineMarks}
  {openTablePicker}
  {openLinkPicker}
  {openSearchPanel}
  {closeSearchPanel}
  {updateSearchQuery}
  {updateSearchReplacement}
  {toggleSearchCaseSensitive}
  {toggleSearchReplaceVisible}
  {findPreviousSearchMatch}
  {findNextSearchMatch}
  {replaceCurrentSearchMatch}
  {replaceAllSearchMatches}
  {editFrontMatter}
  {showUnavailableFeature}
  {closeTablePicker}
  {closeLinkPicker}
  {updateLinkText}
  {updateLinkHref}
  {applyLink}
  {removeLink}
  {insertTableWithSize}
  {setMode}
  {toggleOutlineVisible}
  {toggleFocusMode}
  {toggleRootFolder}
  {toggleFolderCollapse}
  {startResize}
  {switchTab}
  {closeTab}
  {pinPreviewTab}
  {updateContentWidth}
  {updateMarkdown}
  {enterFrontMatterEdit}
  {leaveFrontMatterEdit}
  {updateFrontMatterContent}
  {deleteFrontMatter}
  {updateActiveOutlineFromSourceScroll}
  {updateActiveOutlineFromSemanticScroll}
  onSourceScroll={handleSourceScroll}
  onSemanticScroll={handleSemanticScroll}
  {handleEditorPaste}
  {handleEditorDrop}
  {isOutlineItemExpandable}
  {toggleOutlineItemExpanded}
  {jumpToOutlineItem}
  {openMarkdownFile}
  {openSettings}
  {setWritingStatsMetric}
  onZoomChange={handleZoomChange}
  exportHtml={() => handleExport('html')}
  exportPdf={() => handleExport('pdf')}
  on:createNode={handleCreateNode}
  on:renameNode={handleRenameNode}
  on:refreshFolder={handleRefreshFolder}
  on:collapseAll={handleCollapseAll}
  on:closeOtherTabs={handleCloseOtherTabs}
  on:closeTabsToRight={handleCloseTabsToRight}
  on:closeAllTabs={handleCloseAllTabs}
  on:deleteNode={handleDeleteNode}
/>

<div class="app-toast" class:visible={toastMessage} role="status">{toastMessage}</div>

{#if linkOpening}
  <div class="link-opening-indicator" role="status" aria-live="polite">
    <span class="link-opening-spinner" aria-hidden="true"></span>
    <span>{t.openingLinkShort()}</span>
  </div>
{/if}

<FolderOpenDialog
  {interfaceLocale}
  open={folderOpenDialogPath !== null}
  folderPath={folderOpenDialogPath ?? ''}
  folderName={resolveFolderName(folderOpenDialogPath ?? '')}
  on:choose={handleFolderOpenChoice}
  on:cancel={() => {
    folderOpenDialogPath = null;
    folderOpenDialogName = '';
  }}
/>

{#if contextMenuOpen}
  <ContextMenu
    x={contextMenuX}
    y={contextMenuY}
    items={contextMenuItems}
    onClose={closeContextMenu}
  />
{/if}

<ConfirmDialog
  open={deleteConfirmOpen}
  title={t.confirmDelete()}
  message={t.confirmDeleteMessage({
    type: deleteConfirmIsDir ? t.folder() : t.file(),
    name: deleteConfirmName,
  })}
  detail={deleteConfirmPath}
  confirmLabel={t.delete()}
  danger={true}
  onConfirm={executeDelete}
  onCancel={closeDeleteConfirm}
/>

<UnsavedConfirmDialog
  open={confirmDialogState.open}
  title={confirmDialogState.title}
  message={confirmDialogState.message}
  confirmLabel={confirmDialogState.confirmLabel}
  cancelLabel={confirmDialogState.cancelLabel}
  saveLabel={confirmDialogState.saveLabel}
  onConfirm={() => resolveConfirmDialog(true)}
  onCancel={() => dismissConfirmDialog()}
  onSave={() => resolveConfirmDialog('save')}
/>

<CloseWindowBehaviorDialog
  open={closeWindowChoiceDialogOpen}
  title={t.closeWindowChoiceTitle()}
  message={t.closeWindowChoiceMessage()}
  closeWindowLabel={t.closeWindowBehaviorCloseWindow()}
  closeToTrayLabel={t.closeWindowBehaviorCloseToTray()}
  rememberLabel={t.rememberCloseWindowChoice()}
  remember={rememberCloseWindowChoice}
  onRememberChange={(value) => (rememberCloseWindowChoice = value)}
  onChoose={resolveCloseWindowChoice}
  onCancel={cancelCloseWindowChoice}
/>

<UnsavedConfirmDialog
  open={startupDraftConflict !== null}
  title={t.startupDraftConflictTitle()}
  message={startupDraftConflict
    ? t.startupDraftConflictMessage({ fileName: startupDraftConflict.fileName })
    : ''}
  confirmLabel={t.startupDraftConflictRestoreDraft()}
  cancelLabel={t.startupDraftConflictUseDisk()}
  saveLabel={t.startupDraftConflictSaveDraftAs()}
  onConfirm={applyStartupConflictDraft}
  onCancel={applyStartupConflictDiskVersion}
  onSave={saveStartupConflictDraftAs}
/>

<ExternalChangeDialog
  open={externalChangeDialogOpen}
  change={externalChangeDialogState}
  onReload={handleExternalChangeReload}
  onOverwrite={handleExternalChangeOverwrite}
  onDismiss={handleExternalChangeDismiss}
/>
