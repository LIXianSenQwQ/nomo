<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import {
    listenDesktopFileDrops,
    listenDesktopMenuCommands,
    isTauriRuntime,
    listAppSettings,
    openExternalLink,
    updateAppSetting,
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
  } from '../lib/editor-core';
  import {
    calculateDocumentStats,
    extractOutline,
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
  import SettingsDrawer from './components/SettingsDrawer.svelte';
  import FolderOpenDialog from './components/FolderOpenDialog.svelte';
  import type { FileTreeNode, Tab, WorkspaceState } from './types';
  import { getCompactPath, getDirectoryLabel, getFolderName } from './utils/pathLabels';
  import {
    executeDesktopCommand as executeDesktopAppCommand,
    handleGlobalShortcut as handleGlobalAppShortcut,
    type AppCommandHandlers,
  } from './services/appCommands';
  import {
    closeAppWindow as closeDesktopWindow,
    createAppWindow,
    maximizeAppWindow,
    minimizeAppWindow,
    updateAppWindowTitle,
  } from './services/desktopWindow';
  import { createImageInsertionHandlers } from './services/imageInsertion';
  import { createDesktopImageLoader } from './services/desktopImageLoader';
  import { isOutlineItemVisible as getOutlineItemVisible } from './services/outlineState';
  import { writeRecoveryDraft as writeRecoveryDraftToStorage } from './services/recoveryDraft';
  import { createBlankTab, writeActiveTabState } from './services/tabs';
import { readMarkdownFromPath, rememberNativeFolder, pickFolderPath } from './services/documentFiles';
  import {
    closeActiveMenu,
    createSidebarResizeHandlers,
    getNextActiveMenu,
  } from './services/appUiState';
  import { createEditorSettingsController } from './services/editorSettingsController';
  import ContextMenu from './components/ContextMenu.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import type { ContextMenuOpenEvent, ContextMenuItem } from '../lib/editor-core/plugins/contextMenu';
  import {
    applyBlockStyleSetting,
    loadPersistedImageSettings,
    persistImageSettings,
  } from './services/settings';
  import { createFolderExplorerController } from './services/folderExplorerController';
  import { createDocumentActionsController } from './services/documentActionsController';
  import { createOutlineInteractionController } from './services/outlineInteractionController';
  import { createEditorInteractionController } from './services/editorInteractionController';
  import { createKatexMathRenderer } from '../lib/services/katexMathRenderer';
  import { createMermaidDiagramRenderer } from '../lib/services/mermaidDiagramRenderer';
  import { createShikiCodeTokenizer } from '../lib/services/shikiCodeTokenizer';
  import {
    DEFAULT_IMAGE_HANDLING_SETTINGS,
    type ImageContext,
    type ImageHandlingSettings,
  } from '../lib/services/render';

  const LARGE_DOCUMENT_LIMIT = 300_000;
  const RECOVERY_KEY = 'new-md-save-recovery';
  type EditorAppearanceSettings = {
    fontSize: number;
    lineHeight: number;
    blockStyle: 'classic' | 'modern';
  };
  type WorkspaceBehaviorSettings = {
    folderOpenDefaultBehavior: 'current-window' | 'new-window' | 'ask-every-time';
    filePreviewEnabled: boolean;
    autoSaveEnabled: boolean;
    editorMode: EditorMode;
    sidebarHidden: boolean;
    outlineVisible: boolean;
  };

  setCodeBlockTokenizer(createShikiCodeTokenizer());
  setCodeBlockDiagramRenderer(createMermaidDiagramRenderer());
  setCodeBlockMathRenderer(createKatexMathRenderer());
  setImageLoader(createDesktopImageLoader());

  let markdown = '',
    dirty = false,
    version = 0;
  let mode: EditorMode = 'semantic';
  let theme: 'light' | 'dark' = 'light';
  let fileName = '',
    filePath = '';
  let nativePath: string | null = null;
  let statusMessage = '准备就绪';
  let desktopEnabled = false;
  let recentFiles: RecentEntry[] = [];
  let missingRecentPaths = new Set<string>();
  let outline: OutlineItem[] = [];
  let outlineVisible = true,
    activeOutlineId = outline[0]?.id ?? '';
  let collapsedOutlineIds = new Set<string>();
  let visibleOutlineIds = new Set(outline.map((item) => item.id));
  let suppressOutlineScrollUntil = 0;
  let stats: DocumentStats = calculateDocumentStats('');
  let fontSize = 16,
    lineHeight = 1.75,
    contentWidthPercent = 68,
    focusMode = false,
    blockStyle: 'classic' | 'modern' = 'modern';
  let imageSettings: ImageHandlingSettings = { ...DEFAULT_IMAGE_HANDLING_SETTINGS };
  let folderOpenDefaultBehavior: 'current-window' | 'new-window' | 'ask-every-time' =
    'ask-every-time';
  let folderOpenDialogPath: string | null = null;
  let folderOpenDialogName = '';
  let editorHost: HTMLDivElement,
    fileInput: HTMLInputElement,
    sourceTextarea: HTMLTextAreaElement,
    semanticPane: HTMLElement,
    sourcePane: HTMLElement;
  let pendingSourceScrollTop: number | null = null;
  let largeDocumentMode = false,
    readonlyDocumentMode = false,
    externalFileWarning = '',
    lastKnownModifiedAt = 0;
  let desktopUnlisteners: Array<() => void> = [];
  let currentFolderPath = '',
    folderTree: FileTreeNode[] = [];
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
  let frontMatter: FrontMatterBlock | null = extractFrontMatterBlock(markdown);

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

  let tabs: Tab[] = [];
  let activeTabId = '';
  let previewTabId: string | null = null;
  let filePreviewEnabled = true;
  let autoSaveEnabled = false;
  let windowLabel = '';

  function persistWorkspaceState() {
    if (desktopEnabled && windowLabel) {
      updateAppSetting(`workspaceTabs:${windowLabel}`, { tabs, activeTabId }).catch(() => undefined);
    }
  }

  // 保存当前活跃 Tab 的状态
  function saveActiveTabState() {
    if (!activeTabId) return;
    tabs = writeActiveTabState(tabs, activeTabId, {
      markdown,
      dirty,
      version,
      fileName,
      filePath,
      nativePath,
      largeDocumentMode,
      readonlyDocumentMode,
      externalFileWarning,
      lastKnownModifiedAt,
    });
    persistWorkspaceState();
  }

  let isSwitchingTab = false;

  // 加载指定 Tab 的状态并更新编辑器
  function loadTabState(tab: Tab) {
    isSwitchingTab = true;
    try {
      markdown = tab.markdown;
      dirty = tab.dirty;
      version = tab.version;
      fileName = tab.fileName;
      filePath = tab.filePath;
      nativePath = tab.nativePath;
      largeDocumentMode = tab.largeDocumentMode;
      readonlyDocumentMode = tab.readonlyDocumentMode;
      externalFileWarning = tab.externalFileWarning;
      lastKnownModifiedAt = tab.lastKnownModifiedAt;

      if (editor) {
        const nextMode = largeDocumentMode ? 'source' : mode;
        editor.updateOptions({
          readonly: readonlyDocumentMode,
          mode: nextMode,
        });
        mode = nextMode;
        editor.setMarkdown(markdown, { reason: 'switch-tab', dirty: tab.dirty });
      }

      outline = extractOutline(markdown);
      activeOutlineId = outline[0]?.id ?? '';
      pruneCollapsedOutlineIds();
      stats = calculateDocumentStats(markdown);
      syncSourceTextareaHeight();
    } finally {
      isSwitchingTab = false;
    }
  }

  // 切换活动标签页
  function switchTab(tabId: string) {
    if (!tabId || activeTabId === tabId) return;
    saveActiveTabState();
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
    setCurrentFolderPath: (value) => {
      currentFolderPath = value;
    },
    setStatusMessage: (value) => {
      statusMessage = value;
    },
  });
  const expandAncestors = folderExplorer.expandAncestors;
  const toggleFolderCollapse = folderExplorer.toggleFolderCollapse;
  const toggleRootFolder = folderExplorer.toggleRootFolder;

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
  const closeAppWindow = () => closeDesktopWindow(desktopEnabled);
  const createNewWindow = (folderPath?: string) => createAppWindow(desktopEnabled, folderPath);

  function resolveFolderName(path: string): string {
    const normalized = path.replace(/\\/g, '/').replace(/\/$/, '');
    const idx = normalized.lastIndexOf('/');
    return idx >= 0 ? normalized.slice(idx + 1) || path : path;
  }

  async function openFolderInCurrentWindow(folderPath: string) {
    currentFolderPath = folderPath;
    await loadFolder(folderPath);
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
      await openFolderWithBehavior(path);
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

  function closeCurrentFile() {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab) return;
    closeTab(activeTab.id);
  }

  async function closeCurrentWindow() {
    const dirtyTabs = tabs.filter((t) => t.dirty && t.id !== previewTabId);
    if (dirtyTabs.length > 0) {
      const names = dirtyTabs.map((t) => t.fileName).join('、');
      const ok = confirm(
        `以下文件有未保存修改：${names}。关闭窗口将丢失这些更改，是否继续？`,
      );
      if (!ok) return;
    }
    closeAppWindow();
  }

  function persistEditorModePreference(nextMode: EditorMode) {
    updateAppSetting('editorMode', nextMode).catch(() => undefined);
  }

  function setMode(nextMode: EditorMode) {
    editorInteraction
      .setMode(nextMode)
      .then(() => {
        if (!(largeDocumentMode && nextMode === 'semantic')) {
          persistEditorModePreference(nextMode);
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

  const commandHandlers: AppCommandHandlers = {
    createNewFile: () => createNewFile(),
    createNewWindow,
    openFileDialog: () => openFileDialog(),
    openFolderDialog: () => openFolderDialog(),
    openRecentEntry: (path, entryType) => openRecentEntry(path, entryType),
    saveMarkdownFile: (saveAs) => saveMarkdownFile(saveAs),
    runCommand: (command) => runCommand(command),
    openTablePicker: () => openTablePicker(),
    openLinkPicker: () => openLinkPicker(),
    editFrontMatter: () => editFrontMatter(),
    showUnavailableFeature: (featureName) => showUnavailableFeature(featureName),
    setMode: (nextMode) => setMode(nextMode),
    getMode: () => mode,
    toggleTheme: () => toggleTheme(),
    toggleFocusMode: () => toggleFocusMode(),
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
    theme: { name: theme },
    onChange: syncFromEditor,
    onLinkShortcut: () => openLinkPicker(),
    onOpenLink: (href) => openLinkFromEditor(href),
    getImageContext: () => getImageContext(),
    onImagesDeleted: (event) => handleDeletedImageResources(event),
    onContextMenuOpen: handleContextMenuOpen,
  });
  const editorSettings = createEditorSettingsController({
    getDesktopEnabled: () => desktopEnabled,
    getEditor: () => editor,
    getTheme: () => theme,
    setTheme: (value) => {
      theme = value;
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
  });
  let isSettingsOpen = false;

  function openSettings() {
    isSettingsOpen = true;
  }

  function closeSettings() {
    isSettingsOpen = false;
  }

  async function handleSaveSettings(
    nextImageSettings: ImageHandlingSettings,
    nextAppearanceSettings: EditorAppearanceSettings,
    nextWorkspaceBehaviorSettings: WorkspaceBehaviorSettings,
  ) {
    imageSettings = nextImageSettings;
    persistImageSettings(desktopEnabled, imageSettings);
    updateFontSizeValue(nextAppearanceSettings.fontSize);
    updateLineHeightValue(nextAppearanceSettings.lineHeight);
    updateBlockStyle(nextAppearanceSettings.blockStyle);
    const nextFilePreviewEnabled = nextWorkspaceBehaviorSettings.filePreviewEnabled;
    const nextAutoSaveEnabled = nextWorkspaceBehaviorSettings.autoSaveEnabled;
    if (nextWorkspaceBehaviorSettings.folderOpenDefaultBehavior !== folderOpenDefaultBehavior) {
      folderOpenDefaultBehavior = nextWorkspaceBehaviorSettings.folderOpenDefaultBehavior;
      await updateAppSetting('folderOpenDefaultBehavior', folderOpenDefaultBehavior).catch(
        () => undefined,
      );
    }
    if (nextFilePreviewEnabled !== filePreviewEnabled) {
      filePreviewEnabled = nextFilePreviewEnabled;
      if (!filePreviewEnabled) {
        previewTabId = null;
        persistWorkspaceState();
      }
      await updateAppSetting('filePreviewEnabled', nextFilePreviewEnabled).catch(() => undefined);
    }
    if (nextAutoSaveEnabled !== autoSaveEnabled) {
      autoSaveEnabled = nextAutoSaveEnabled;
      if (!autoSaveEnabled) {
        documentActions.cancelPendingAutoSaves();
      }
      await updateAppSetting('autoSaveEnabled', nextAutoSaveEnabled).catch(() => undefined);
    }
    if (nextWorkspaceBehaviorSettings.sidebarHidden !== focusMode) {
      setSidebarHidden(nextWorkspaceBehaviorSettings.sidebarHidden);
    }
    if (nextWorkspaceBehaviorSettings.outlineVisible !== outlineVisible) {
      setOutlineVisiblePreference(nextWorkspaceBehaviorSettings.outlineVisible);
    }
    if (nextWorkspaceBehaviorSettings.editorMode !== mode) {
      setMode(nextWorkspaceBehaviorSettings.editorMode);
    } else {
      persistEditorModePreference(nextWorkspaceBehaviorSettings.editorMode);
    }
    closeSettings();
  }

  // 打开预览标签页（文件树单击）
  async function openPreviewFile(path: string) {
    if (!desktopEnabled) return;

    // 已有固定标签页打开此文件 → 切换到它
    const existingFixedTab = tabs.find((t) => t.nativePath === path && t.id !== previewTabId);
    if (existingFixedTab) {
      if (activeTabId !== previewTabId) {
        saveActiveTabState();
      }
      switchTab(existingFixedTab.id);
      return;
    }

    const { document, error } = await readMarkdownFromPath(path, '预览打开失败');
    if (error) {
      statusMessage = error;
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
      document.markdown.length > LARGE_DOCUMENT_LIMIT ||
      document.sizeBytes > LARGE_DOCUMENT_LIMIT;

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
    targetTab.version = 0;

    tabs = [...tabs];
    activeTabId = targetTab.id;
    loadTabState(targetTab);

    const parentDir = getDirectoryLabel(document.path);
    if (parentDir && parentDir !== '当前文件夹') {
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
  function handleCloseOtherTabs(event: CustomEvent<{ tabId: string }>) {
    const keepTabId = event.detail.tabId;
    const keepTab = tabs.find((t) => t.id === keepTabId);
    if (!keepTab) return;

    const dirtyTabs = tabs.filter((t) => t.id !== keepTabId && t.dirty && t.id !== previewTabId);
    if (dirtyTabs.length > 0) {
      const names = dirtyTabs.map((t) => t.fileName).join('、');
      const ok = confirm(`以下文件有未保存修改：${names}。关闭将丢失这些更改，是否继续？`);
      if (!ok) return;
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
  function handleCloseTabsToRight(event: CustomEvent<{ tabId: string }>) {
    const tabId = event.detail.tabId;
    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    if (tabIndex < 0) return;

    const rightTabs = tabs.slice(tabIndex + 1);
    const dirtyRightTabs = rightTabs.filter((t) => t.dirty && t.id !== previewTabId);
    if (dirtyRightTabs.length > 0) {
      const names = dirtyRightTabs.map((t) => t.fileName).join('、');
      const ok = confirm(`以下文件有未保存修改：${names}。关闭将丢失这些更改，是否继续？`);
      if (!ok) return;
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
    const dirtyTabs = tabs.filter((t) => t.dirty && t.id !== previewTabId);
    if (dirtyTabs.length > 0) {
      const names = dirtyTabs.map((t) => t.fileName).join('、');
      const ok = confirm(`以下文件有未保存修改：${names}。关闭将丢失这些更改，是否继续？`);
      if (!ok) return;
    }

    isSwitchingTab = true;
    try {
      tabs = [];
      activeTabId = '';
      previewTabId = null;
      markdown = '';
      fileName = '';
      filePath = '';
      nativePath = null;
      dirty = false;
      lastKnownModifiedAt = 0;
      largeDocumentMode = false;
      readonlyDocumentMode = false;
      externalFileWarning = '';
      outline = [];
      if (editor) {
        editor.setMarkdown('', { reason: 'switch-tab', dirty: false });
      }
    } finally {
      isSwitchingTab = false;
    }
    updateWindowTitle();
    persistWorkspaceState();
  }

  const documentActions = createDocumentActionsController({
    largeDocumentLimit: LARGE_DOCUMENT_LIMIT,
    recoveryKey: RECOVERY_KEY,
    getDesktopEnabled: () => desktopEnabled,
    getDirty: () => dirty,
    getAutoSaveEnabled: () => autoSaveEnabled,
    setMarkdown: (value) => {
      markdown = value;
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
    setStatusMessage: (value) => {
      statusMessage = value;
    },
    setRecentFiles: (value) => {
      recentFiles = value;
    },
    setExternalFileWarning: (value) => {
      externalFileWarning = value;
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
  const loadPersistedSettings = editorSettings.loadPersistedSettings;
  const updateMarkdown = editorInteraction.updateMarkdown;
  const runCommand = editorInteraction.runCommand;
  const toggleTheme = editorSettings.toggleTheme;
  const updateFontSizeValue = editorSettings.updateFontSizeValue;
  const updateLineHeightValue = editorSettings.updateLineHeightValue;
  const updateContentWidth = editorSettings.updateContentWidth;
  const updateBlockStyle = editorSettings.updateBlockStyle;
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
  const checkExternalFileChange = documentActions.checkExternalFileChange;

  // 包装 closeTab：预览标签页直接关闭无需确认
  function closeTab(tabId: string, event?: Event) {
    event?.stopPropagation();

    if (tabId === previewTabId) {
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
          fileName = '';
          filePath = '';
          nativePath = null;
          dirty = false;
          lastKnownModifiedAt = 0;
          largeDocumentMode = false;
          readonlyDocumentMode = false;
          externalFileWarning = '';
          outline = [];
          isSwitchingTab = true;
          try {
            if (editor) {
              editor.setMarkdown('', { reason: 'switch-tab', dirty: false });
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

    _documentCloseTab(tabId, event);

    // 关闭最后一个普通标签后清空编辑器状态
    if (tabs.length === 0) {
      markdown = '';
      fileName = '';
      filePath = '';
      nativePath = null;
      dirty = false;
      lastKnownModifiedAt = 0;
      largeDocumentMode = false;
      readonlyDocumentMode = false;
      externalFileWarning = '';
      outline = [];
      isSwitchingTab = true;
      try {
        if (editor) {
          editor.setMarkdown('', { reason: 'switch-tab', dirty: false });
        }
      } finally {
        isSwitchingTab = false;
      }
      updateWindowTitle();
    }
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
    const typeLabel = isDir ? '文件夹' : '文件';
    deleteConfirmOpen = false;

    try {
      await deleteFile(path);
      // 关闭受影响的标签页（精确匹配或以文件夹路径开头）
      const sep = path.includes('\\') ? '\\' : '/';
      const affectedTabs = tabs.filter((t) =>
        isDir
          ? t.nativePath && (t.nativePath === path || t.nativePath.startsWith(path + sep))
          : t.nativePath === path,
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
        fileName = '';
        filePath = '';
        nativePath = null;
        dirty = false;
        lastKnownModifiedAt = 0;
        largeDocumentMode = false;
        readonlyDocumentMode = false;
        externalFileWarning = '';
        outline = [];
        isSwitchingTab = true;
        try {
          if (editor) {
            editor.setMarkdown('', { reason: 'switch-tab', dirty: false });
          }
        } finally {
          isSwitchingTab = false;
        }
      }
      // 刷新文件夹
      if (currentFolderPath) {
        await loadFolder(currentFolderPath);
      }
      statusMessage = `已删除${typeLabel}`;
    } catch (error) {
      statusMessage = `删除失败: ${error}`;
    }
  }

  function closeDeleteConfirm() {
    deleteConfirmOpen = false;
  }

  async function handleCreateNode(
    event: CustomEvent<{ parentPath: string; type: 'folder' | 'file'; name: string }>,
  ) {
    const { parentPath, type, name } = event.detail;
    let finalName = name || (type === 'folder' ? '新建文件夹' : '无标题.md');
    finalName = finalName.replace(/[<>:"/\\|?*]/g, '');
    if (!finalName) finalName = type === 'folder' ? '新建文件夹' : '无标题.md';
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
        statusMessage = `创建文件夹失败: ${err}`;
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
      statusMessage = `重命名失败: ${err}`;
    });

    await loadFolder(currentFolderPath);

    tabs.forEach((t) => {
      if (t.nativePath === path || t.nativePath?.startsWith(path + '/')) {
        const newNativePath = t.nativePath.replace(path, targetPath);
        t.nativePath = newNativePath;
        t.filePath = newNativePath;
        if (t.nativePath === targetPath) {
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

  onMount(async () => {
    desktopEnabled = isTauriRuntime();
    let persistedEditorMode: EditorMode | null = null;

    if (desktopEnabled) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      windowLabel = getCurrentWindow().label;
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('refresh_window_menu')
        .catch(() => undefined);

      const settings = await listAppSettings().catch(() => []);
      // 优先读取窗口独立的状态，兼容旧的全局 key
      const workspaceTabsKey = windowLabel ? `workspaceTabs:${windowLabel}` : 'workspaceTabs';
      const workspaceTabsSetting = settings.find((s) => s.key === workspaceTabsKey)
        ?? settings.find((s) => s.key === 'workspaceTabs');
      if (workspaceTabsSetting) {
        try {
          const state = JSON.parse(workspaceTabsSetting.valueJson) as WorkspaceState;
          if (state.tabs && state.tabs.length > 0) {
            tabs = state.tabs;
            activeTabId = state.activeTabId;
            const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
            activeTabId = activeTab.id;
            loadTabState(activeTab);
          }
        } catch {
          // ignore
        }
      }

      const folderBehaviorSetting = settings.find((s) => s.key === 'folderOpenDefaultBehavior');
      if (folderBehaviorSetting) {
        try {
          const value = JSON.parse(folderBehaviorSetting.valueJson) as
            | 'current-window'
            | 'new-window'
            | 'ask-every-time';
          if (['current-window', 'new-window', 'ask-every-time'].includes(value)) {
            folderOpenDefaultBehavior = value;
          }
        } catch {
          // ignore
        }
      }

      const filePreviewSetting = settings.find((s) => s.key === 'filePreviewEnabled');
      if (filePreviewSetting) {
        try {
          const value = JSON.parse(filePreviewSetting.valueJson);
          if (typeof value === 'boolean') {
            filePreviewEnabled = value;
            if (!filePreviewEnabled) {
              previewTabId = null;
            }
          }
        } catch {
          // ignore
        }
      }

      const autoSaveSetting = settings.find((s) => s.key === 'autoSaveEnabled');
      if (autoSaveSetting) {
        try {
          const value = JSON.parse(autoSaveSetting.valueJson);
          if (typeof value === 'boolean') {
            autoSaveEnabled = value;
          }
        } catch {
          // ignore
        }
      }

      const editorModeSetting = settings.find((s) => s.key === 'editorMode');
      if (editorModeSetting) {
        try {
          const value = JSON.parse(editorModeSetting.valueJson);
          if (value === 'semantic' || value === 'source') {
            persistedEditorMode = value;
          }
        } catch {
          // ignore
        }
      }

      const sidebarHiddenSetting = settings.find((s) => s.key === 'sidebarHidden');
      if (sidebarHiddenSetting) {
        try {
          const value = JSON.parse(sidebarHiddenSetting.valueJson);
          if (typeof value === 'boolean') {
            focusMode = value;
          }
        } catch {
          // ignore
        }
      }

      const outlineVisibleSetting = settings.find((s) => s.key === 'outlineVisible');
      if (outlineVisibleSetting) {
        try {
          const value = JSON.parse(outlineVisibleSetting.valueJson);
          if (typeof value === 'boolean') {
            outlineVisible = value;
          }
        } catch {
          // ignore
        }
      }

      // 步骤2：检查是否由后端携带了待打开路径（新窗口打开文件夹）
      const pendingFolderSetting = settings.find((s) => s.key === `pendingFolder:${windowLabel}`);
      if (pendingFolderSetting) {
        try {
          const folderPath = JSON.parse(pendingFolderSetting.valueJson);
          if (folderPath && typeof folderPath === 'string' && folderPath.length > 0) {
            currentFolderPath = folderPath;
            await loadFolder(folderPath)
              .catch(() => undefined);
            // 标记为已消费，避免刷新时重复处理
            await updateAppSetting(`pendingFolder:${windowLabel}`, '').catch(() => undefined);
          }
        } catch {
          // ignore
        }
      }
    }

    editor.mount(editorHost);
    // 监听图片右键菜单自定义事件（冒泡自 ImageNodeView）
    editorHost.addEventListener('image-context-menu', handleImageContextMenu);
    await loadPersistedSettings();
    if (persistedEditorMode && !largeDocumentMode) {
      mode = persistedEditorMode;
      editor.updateOptions({ mode: persistedEditorMode });
    }
    imageSettings = await loadPersistedImageSettings(desktopEnabled);
    // 确保 blockStyle 默认值写入 DOM（loadPersistedSettings 可能跳过）
    applyBlockStyleSetting(blockStyle);
    await refreshRecentFiles();
    await setupDesktopEvents();
    window.addEventListener('keydown', handleGlobalShortcut);
    fileCheckTimer = window.setInterval(() => {
      checkExternalFileChange();
    }, 5000);
    await tick();
    syncSourceTextareaHeight();
    await updateWindowTitle().catch(() => undefined);

    if (currentFolderPath) {
      loadFolder(currentFolderPath).catch(() => undefined);
    } else {
      const parentDir = getDirectoryLabel(filePath);
      if (parentDir && parentDir !== '当前文件夹') loadFolder(parentDir).catch(() => undefined);
    }
  });

  onDestroy(() => {
    for (const unlisten of desktopUnlisteners) unlisten();
    if (fileCheckTimer !== null) window.clearInterval(fileCheckTimer);
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    if (linkOpeningTimer !== null) window.clearTimeout(linkOpeningTimer);
    window.removeEventListener('keydown', handleGlobalShortcut);
    sidebarResize.destroy();
    unsubscribe();
    editor.destroy();
  });

  function syncFromEditor(event: EditorChangeEvent) {
    if (isSwitchingTab) return;

    // 预览标签页开始编辑 → 自动固定
    if (previewTabId && previewTabId === activeTabId && event.dirty) {
      previewTabId = null;
    }

    markdown = event.markdown;
    dirty = event.dirty;
    version = event.version;
    mode = event.mode;
    pendingInlineMarks = event.pendingInlineMarks;
    outline = extractOutline(event.markdown);
    if (!outline.some((item) => item.id === activeOutlineId))
      activeOutlineId = outline[0]?.id ?? '';
    pruneCollapsedOutlineIds();
    stats = calculateDocumentStats(event.markdown);

    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab) {
      activeTab.markdown = markdown;
      activeTab.dirty = dirty;
      activeTab.version = version;
      tabs = [...tabs];
      persistWorkspaceState();
    }

    if (autoSaveEnabled && desktopEnabled && dirty && nativePath) {
      documentActions.debouncedAutoSave(event.markdown);
    }

    if (event.markdown.length > LARGE_DOCUMENT_LIMIT) {
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
      statusMessage = '当前文档只读，无法编辑超链接';
      return;
    }
    if (mode !== 'semantic') {
      statusMessage = '请切换到语义模式后编辑超链接';
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
    statusMessage = '正在打开链接...';
    if (linkOpeningTimer !== null) window.clearTimeout(linkOpeningTimer);

    const minimumVisibleTime = new Promise<void>((resolve) => {
      linkOpeningTimer = window.setTimeout(resolve, 700);
    });

    Promise.all([
      openExternalLink(href).catch((error) => {
        statusMessage = `打开链接失败：${error}`;
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
      linkError = '请输入链接地址';
      return;
    }

    const applied = editor.execute({
      type: 'insertLink',
      href: linkHref,
      title: linkDraftTitle ?? undefined,
      text: linkText,
    });
    if (!applied) {
      linkError = '链接地址不可用，请使用 http(s)、mailto、锚点或相对路径';
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
      linkError = '当前选区没有可移除的超链接';
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
      statusMessage = '当前文档只读，无法编辑元数据';
      return;
    }
    if (!extractFrontMatterBlock(editor.getMarkdown())) {
      editor.execute({ type: 'insertFrontMatter' });
    }
    frontMatterEditing = true;
  }

  function enterFrontMatterEdit() {
    if (readonlyDocumentMode) {
      statusMessage = '当前文档只读，无法编辑元数据';
      return;
    }
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
      statusMessage = '当前文档只读，无法删除元数据';
      return;
    }
    frontMatterEditing = false;
    editor.setMarkdown(removeFrontMatter(editor.getMarkdown()));
  }

  function showUnavailableFeature(featureName: string) {
    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
    }
    toastMessage = `${featureName}功能开发中`;
    toastTimer = window.setTimeout(() => {
      toastMessage = '';
      toastTimer = null;
    }, 1500);
  }

  $: visibleOutlineIds = new Set(
    outline
      .filter((_item, index) => getOutlineItemVisible(outline, collapsedOutlineIds, index))
      .map((item) => item.id),
  );

  $: frontMatter = extractFrontMatterBlock(markdown);
  $: if (!frontMatter) {
    frontMatterEditing = false;
  }

  async function setupDesktopEvents() {
    if (!desktopEnabled) {
      return;
    }

    const [menuUnlisten, dropUnlisten] = await Promise.all([
      listenDesktopMenuCommands((command) => {
        executeDesktopCommand(command);
      }).catch(() => null),
      listenDesktopFileDrops((paths) => {
        openDroppedMarkdown(paths);
      }).catch(() => null),
    ]);

    desktopUnlisteners = [menuUnlisten, dropUnlisten].filter((value): value is () => void =>
      Boolean(value),
    );
  }

  function executeDesktopCommand(command: string) {
    executeDesktopAppCommand(command, commandHandlers);
  }

  function handleGlobalShortcut(event: KeyboardEvent) {
    handleGlobalAppShortcut(event, commandHandlers);
  }

  async function loadFolder(folderPath: string) {
    await folderExplorer.loadFolder(folderPath);
  }

  function getSourceLineHeight() {
    return outlineInteraction.getSourceLineHeight();
  }

  function handleDeletedImageResources(event: EditorImageDeletionEvent) {
    const loader = getImageLoader();
    if (
      !imageSettings.autoDeleteUnusedLocalImages ||
      !loader?.remove ||
      event.srcs.length === 0
    ) {
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
        statusMessage = `已删除 ${removed} 个图片文件，${failed} 个删除失败`;
      } else if (removed > 0) {
        statusMessage = `已删除 ${removed} 个图片文件`;
      } else if (failed > 0) {
        statusMessage = `${failed} 个图片文件删除失败`;
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
      strikethrough: false,
      underline: false,
      highlight: false,
    };
  }
</script>

<svelte:head>
  <title>NewMd 阶段4</title>
</svelte:head>

<AppShell
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
  {readonlyDocumentMode}
  {externalFileWarning}
  {outline}
  {activeOutlineId}
  {collapsedOutlineIds}
  {visibleOutlineIds}
  {statusMessage}
  {version}
  {stats}
  {tablePickerOpen}
  {linkPickerOpen}
  {linkText}
  {linkHref}
  {linkError}
  {linkCanRemove}
  {linkPickerPositionStyle}
  {getCompactPath}
  {getFolderName}
  {getDirectoryLabel}
  {toggleMenu}
  {closeMenu}
  {toggleTheme}
  {minimizeWindow}
  {maximizeWindow}
  {closeAppWindow}
  {createNewWindow}
  {createNewFile}
  {openFileDialog}
  {openFolderDialog}
  {openRecentEntry}
  {openPreviewFile}
  {clearRecentEntriesList}
  {removeRecentEntry}
  {closeCurrentFile}
  {closeCurrentWindow}
  {saveMarkdownFile}
  {runCommand}
  {pendingInlineMarks}
  {openTablePicker}
  {openLinkPicker}
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
  {handleEditorPaste}
  {handleEditorDrop}
  {isOutlineItemExpandable}
  {toggleOutlineItemExpanded}
  {jumpToOutlineItem}
  {openMarkdownFile}
  {openSettings}
  on:createNode={handleCreateNode}
  on:renameNode={handleRenameNode}
  on:refreshFolder={handleRefreshFolder}
  on:collapseAll={handleCollapseAll}
  on:closeOtherTabs={handleCloseOtherTabs}
  on:closeTabsToRight={handleCloseTabsToRight}
  on:closeAllTabs={handleCloseAllTabs}
  on:deleteNode={handleDeleteNode}
/>

<SettingsDrawer
  isOpen={isSettingsOpen}
  {imageSettings}
  {fontSize}
  {lineHeight}
  {blockStyle}
  {filePreviewEnabled}
  {autoSaveEnabled}
  editorMode={mode}
  sidebarHidden={focusMode}
  {outlineVisible}
  folderOpenDefaultBehavior={folderOpenDefaultBehavior}
  {closeSettings}
  saveSettings={handleSaveSettings}
/>

<div class="app-toast" class:visible={toastMessage} role="status">{toastMessage}</div>

{#if linkOpening}
  <div class="link-opening-indicator" role="status" aria-live="polite">
    <span class="link-opening-spinner" aria-hidden="true"></span>
    <span>正在打开链接</span>
  </div>
{/if}

<FolderOpenDialog
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
  title="确认删除"
  message={`确定要删除 ${deleteConfirmIsDir ? '文件夹' : '文件'} "${deleteConfirmName}" 吗？`}
  detail={deleteConfirmPath}
  confirmLabel="删除"
  danger={true}
  onConfirm={executeDelete}
  onCancel={closeDeleteConfirm}
/>
