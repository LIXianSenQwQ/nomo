<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import {
    listenDesktopFileDrops,
    listenDesktopMenuCommands,
    isTauriRuntime,
    type RecentDocument
  } from '../lib/desktop/tauriStorage';
  import { createEditorCore, setCodeBlockMathRenderer, type EditorChangeEvent, type EditorCommand, type EditorMode } from '../lib/editor-core';
  import { calculateDocumentStats, extractOutline, type DocumentStats, type OutlineItem } from '../lib/outline/outlineService';
  import { createRichMarkdownSample } from '../lib/markdown/sample';
  import AppShell from './components/AppShell.svelte';
  import type { FileTreeNode, Tab } from './types';
  import { getCompactPath, getDirectoryLabel, getFolderName } from './utils/pathLabels';
  import {
    executeDesktopCommand as executeDesktopAppCommand,
    handleGlobalShortcut as handleGlobalAppShortcut,
    type AppCommandHandlers
  } from './services/appCommands';
  import {
    closeAppWindow as closeDesktopWindow,
    createAppWindow,
    maximizeAppWindow,
    minimizeAppWindow,
    updateAppWindowTitle
  } from './services/desktopWindow';
  import { createImageInsertionHandlers } from './services/imageInsertion';
  import { isOutlineItemVisible as getOutlineItemVisible } from './services/outlineState';
  import { writeRecoveryDraft as writeRecoveryDraftToStorage } from './services/recoveryDraft';
  import { createDefaultTab, writeActiveTabState } from './services/tabs';
  import { closeActiveMenu, createSidebarResizeHandlers, getNextActiveMenu } from './services/appUiState';
  import { createEditorSettingsController } from './services/editorSettingsController';
  import { createFolderExplorerController } from './services/folderExplorerController';
  import { createDocumentActionsController } from './services/documentActionsController';
  import { createOutlineInteractionController } from './services/outlineInteractionController';
  import { createEditorInteractionController } from './services/editorInteractionController';
  import { createKatexMathRenderer } from '../lib/services/katexMathRenderer';

  const LARGE_DOCUMENT_LIMIT = 300_000;
  const RECOVERY_KEY = 'new-md-save-recovery';
  const initialMarkdown = createRichMarkdownSample();

  setCodeBlockMathRenderer(createKatexMathRenderer());

  let markdown = initialMarkdown, dirty = false, version = 0;
  let mode: EditorMode = 'semantic';
  let theme: 'light' | 'dark' = 'light';
  let fileName = '阶段3样例.md', filePath = 'D:\\Demo\\NewMd\\阶段3样例.md';
  let nativePath: string | null = null;
  let statusMessage = '阶段4：桌面体验与稳定性打磨';
  let desktopEnabled = false;
  let recentFiles: RecentDocument[] = [];
  let outline: OutlineItem[] = extractOutline(initialMarkdown);
  let outlineVisible = true, activeOutlineId = outline[0]?.id ?? '';
  let collapsedOutlineIds = new Set<string>();
  let visibleOutlineIds = new Set(outline.map((item) => item.id));
  let suppressOutlineScrollUntil = 0;
  let stats: DocumentStats = calculateDocumentStats(initialMarkdown);
  let fontSize = 16, lineHeight = 1.75, contentWidthPercent = 68, focusMode = false;
  let editorHost: HTMLDivElement, fileInput: HTMLInputElement, sourceTextarea: HTMLTextAreaElement, semanticPane: HTMLElement, sourcePane: HTMLElement;
  let pendingSourceScrollTop: number | null = null;
  let largeDocumentMode = false, readonlyDocumentMode = false, externalFileWarning = '', lastKnownModifiedAt = 0;
  let desktopUnlisteners: Array<() => void> = [];
  let currentFolderPath = '', folderTree: FileTreeNode[] = [];
  let expandedFolders = new Set<string>();

  let tabs: Tab[] = [createDefaultTab(initialMarkdown)];
  let activeTabId = 'default';

  // 保存当前活跃 Tab 的状态
  function saveActiveTabState() {
    tabs = writeActiveTabState(tabs, activeTabId, {
      markdown, dirty, version, fileName, filePath, nativePath, largeDocumentMode, readonlyDocumentMode, externalFileWarning, lastKnownModifiedAt
    });
  }

  // 加载指定 Tab 的状态并更新编辑器
  function loadTabState(tab: Tab) {
    markdown = tab.markdown; dirty = tab.dirty; version = tab.version; fileName = tab.fileName; filePath = tab.filePath; nativePath = tab.nativePath;
    largeDocumentMode = tab.largeDocumentMode; readonlyDocumentMode = tab.readonlyDocumentMode; externalFileWarning = tab.externalFileWarning; lastKnownModifiedAt = tab.lastKnownModifiedAt;

    if (editor) {
      editor.updateOptions({ readonly: readonlyDocumentMode, mode: largeDocumentMode ? 'source' : mode });
      editor.setMarkdown(markdown, { reason: 'switch-tab', dirty: tab.dirty });
    }

    outline = extractOutline(markdown); activeOutlineId = outline[0]?.id ?? '';
    pruneCollapsedOutlineIds();
    stats = calculateDocumentStats(markdown);
    syncSourceTextareaHeight();
  }

  // 切换活动标签页
  function switchTab(tabId: string) {
    if (activeTabId === tabId) return;
    saveActiveTabState();
    const targetTab = tabs.find(t => t.id === tabId);
    if (targetTab) {
      activeTabId = tabId;
      loadTabState(targetTab);
      updateWindowTitle();
    }
  }

  // 顶级目录展开与收起状态
  let rootFolderExpanded = true;
  const folderExplorer = createFolderExplorerController({
    getDesktopEnabled: () => desktopEnabled,
    getFolderTree: () => folderTree,
    setFolderTree: (value) => { folderTree = value; },
    getExpandedFolders: () => expandedFolders,
    setExpandedFolders: (value) => { expandedFolders = value; },
    getRootFolderExpanded: () => rootFolderExpanded,
    setRootFolderExpanded: (value) => { rootFolderExpanded = value; },
    setCurrentFolderPath: (value) => { currentFolderPath = value; },
    setStatusMessage: (value) => { statusMessage = value; }
  });
  const expandAncestors = folderExplorer.expandAncestors;
  const toggleFolderCollapse = folderExplorer.toggleFolderCollapse;
  const toggleRootFolder = folderExplorer.toggleRootFolder;

  // 侧边栏宽度拉伸状态与函数
  let sidebarWidth = 250;
  let isResizing = false;
  const sidebarResize = createSidebarResizeHandlers({
    setResizing: (value) => { isResizing = value; },
    setSidebarWidth: (value) => { sidebarWidth = value; }
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
  const createNewWindow = () => createAppWindow(desktopEnabled);

  const commandHandlers: AppCommandHandlers = {
    createNewFile: () => createNewFile(), createNewWindow, openFileDialog: () => openFileDialog(), openFolderDialog: () => openFolderDialog(),
    openRecentFile: (path) => openRecentFile(path), saveMarkdownFile: (saveAs) => saveMarkdownFile(saveAs), runCommand: (command) => runCommand(command),
    setMode: (nextMode) => setMode(nextMode), getMode: () => mode, toggleTheme: () => toggleTheme(), toggleFocusMode: () => toggleFocusMode()
  };

  async function updateWindowTitle() {
    await updateAppWindowTitle(desktopEnabled, fileName, dirty);
  }

  $: {
    if (desktopEnabled && (fileName || dirty !== undefined)) {
      updateWindowTitle();
    }
  }
  let fileCheckTimer: number | null = null;

  const editor = createEditorCore({ markdown, mode, theme: { name: theme }, onChange: syncFromEditor });
  const editorSettings = createEditorSettingsController({
    getDesktopEnabled: () => desktopEnabled, getEditor: () => editor, getTheme: () => theme, setTheme: (value) => { theme = value; },
    getFontSize: () => fontSize, setFontSize: (value) => { fontSize = value; }, getLineHeight: () => lineHeight, setLineHeight: (value) => { lineHeight = value; },
    getContentWidthPercent: () => contentWidthPercent, setContentWidthPercent: (value) => { contentWidthPercent = value; }
  });
  const documentActions = createDocumentActionsController({
    largeDocumentLimit: LARGE_DOCUMENT_LIMIT, recoveryKey: RECOVERY_KEY, getDesktopEnabled: () => desktopEnabled, getDirty: () => dirty,
    getNativePath: () => nativePath, getFileName: () => fileName, getLastKnownModifiedAt: () => lastKnownModifiedAt, getCurrentFolderPath: () => currentFolderPath,
    getFileInput: () => fileInput, getEditor: () => editor, getTabs: () => tabs, setTabs: (value) => { tabs = value; },
    getActiveTabId: () => activeTabId, setActiveTabId: (value) => { activeTabId = value; }, setStatusMessage: (value) => { statusMessage = value; },
    setRecentFiles: (value) => { recentFiles = value; }, setExternalFileWarning: (value) => { externalFileWarning = value; },
    saveActiveTabState, loadTabState, switchTab, writeRecoveryDraft, updateWindowTitle, loadFolder, expandAncestors
  });
  const outlineInteraction = createOutlineInteractionController({
    getMode: () => mode, getMarkdown: () => markdown, getOutline: () => outline, getCollapsedOutlineIds: () => collapsedOutlineIds,
    setCollapsedOutlineIds: (value) => { collapsedOutlineIds = value; }, getOutlineVisible: () => outlineVisible, setOutlineVisible: (value) => { outlineVisible = value; },
    setActiveOutlineId: (value) => { activeOutlineId = value; }, getSuppressOutlineScrollUntil: () => suppressOutlineScrollUntil,
    setSuppressOutlineScrollUntil: (value) => { suppressOutlineScrollUntil = value; }, getSemanticPane: () => semanticPane, getSourcePane: () => sourcePane, getSourceTextarea: () => sourceTextarea
  });
  const editorInteraction = createEditorInteractionController({
    getEditor: () => editor, getLargeDocumentMode: () => largeDocumentMode, getMode: () => mode, getOutline: () => outline,
    getSemanticPane: () => semanticPane, getSourcePane: () => sourcePane, getSourceTextarea: () => sourceTextarea, getPendingSourceScrollTop: () => pendingSourceScrollTop,
    setPendingSourceScrollTop: (value) => { pendingSourceScrollTop = value; }, setSuppressOutlineScrollUntil: (value) => { suppressOutlineScrollUntil = value; },
    setStatusMessage: (value) => { statusMessage = value; }, getSourceLineHeight
  });
  const imageInsertion = createImageInsertionHandlers({
    getEditor: () => editor,
    getFileName: () => fileName,
    setStatusMessage: (message) => { statusMessage = message; }
  });
  const handleEditorDrop = imageInsertion.handleEditorDrop;
  const handleEditorPaste = imageInsertion.handleEditorPaste;
  const loadPersistedSettings = editorSettings.loadPersistedSettings;
  const setMode = editorInteraction.setMode;
  const updateMarkdown = editorInteraction.updateMarkdown;
  const runCommand = editorInteraction.runCommand;
  const toggleTheme = editorSettings.toggleTheme;
  const updateFontSize = editorSettings.updateFontSize;
  const updateLineHeight = editorSettings.updateLineHeight;
  const updateContentWidth = editorSettings.updateContentWidth;
  const toggleOutlineVisible = outlineInteraction.toggleOutlineVisible;
  const isOutlineItemExpandable = outlineInteraction.isOutlineItemExpandable;
  const toggleOutlineItemExpanded = outlineInteraction.toggleOutlineItemExpanded;
  const pruneCollapsedOutlineIds = outlineInteraction.pruneCollapsedOutlineIds;
  const syncSourceTextareaHeight = editorInteraction.syncSourceTextareaHeight;
  const openDroppedMarkdown = documentActions.openDroppedMarkdown;
  const openFileDialog = documentActions.openFileDialog;
  const openMarkdownFile = documentActions.openMarkdownFile;
  const saveMarkdownFile = documentActions.saveMarkdownFile;
  const openRecentFile = documentActions.openRecentFile;
  const openFolderDialog = folderExplorer.openFolderDialog;
  const createNewFile = documentActions.createNewFile;
  const closeTab = documentActions.closeTab;
  const refreshRecentFiles = documentActions.refreshRecentFiles;
  const checkExternalFileChange = documentActions.checkExternalFileChange;
  const jumpToOutlineItem = outlineInteraction.jumpToOutlineItem;
  const updateActiveOutlineFromSourceScroll = outlineInteraction.updateActiveOutlineFromSourceScroll;
  const updateActiveOutlineFromSemanticScroll = outlineInteraction.updateActiveOutlineFromSemanticScroll;

  const unsubscribe = editor.subscribe(syncFromEditor);

  onMount(async () => {
    desktopEnabled = isTauriRuntime();
    editor.mount(editorHost);
    await loadPersistedSettings();
    await refreshRecentFiles();
    await setupDesktopEvents();
    window.addEventListener('keydown', handleGlobalShortcut);
    fileCheckTimer = window.setInterval(() => { checkExternalFileChange(); }, 5000);
    await tick();
    syncSourceTextareaHeight();
    await updateWindowTitle().catch(() => undefined);

    const parentDir = getDirectoryLabel(filePath);
    if (parentDir && parentDir !== '当前文件夹') loadFolder(parentDir).catch(() => undefined);
  });

  onDestroy(() => {
    for (const unlisten of desktopUnlisteners) unlisten();
    if (fileCheckTimer !== null) window.clearInterval(fileCheckTimer);
    window.removeEventListener('keydown', handleGlobalShortcut);
    sidebarResize.destroy();
    unsubscribe();
    editor.destroy();
  });

  function syncFromEditor(event: EditorChangeEvent) {
    markdown = event.markdown; dirty = event.dirty; version = event.version; mode = event.mode;
    outline = extractOutline(event.markdown);
    if (!outline.some((item) => item.id === activeOutlineId)) activeOutlineId = outline[0]?.id ?? '';
    pruneCollapsedOutlineIds();
    stats = calculateDocumentStats(event.markdown);

    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab) {
      activeTab.markdown = markdown;
      activeTab.dirty = dirty;
      activeTab.version = version;
      tabs = [...tabs];
    }

    if (event.markdown.length > LARGE_DOCUMENT_LIMIT) { syncSourceTextareaHeight(); return; }
    syncSourceTextareaHeight();
  }

  function toggleFocusMode() {
    focusMode = !focusMode;
  }

  $: visibleOutlineIds = new Set(outline.filter((_item, index) => getOutlineItemVisible(outline, collapsedOutlineIds, index)).map((item) => item.id));

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
      }).catch(() => null)
    ]);

    desktopUnlisteners = [menuUnlisten, dropUnlisten].filter((value): value is () => void => Boolean(value));
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

  function writeRecoveryDraft(reason: string) {
    writeRecoveryDraftToStorage(RECOVERY_KEY, {
      reason,
      fileName,
      filePath,
      nativePath,
      markdown: editor.getMarkdown()
    });
  }
</script>

<svelte:head>
  <title>NewMd 阶段4</title>
</svelte:head>

<AppShell
  bind:fileInput bind:sourcePane bind:semanticPane bind:sourceTextarea bind:editorHost
  {focusMode} {isResizing} {contentWidthPercent} {theme} {desktopEnabled} {activeMenu} {recentFiles} {mode} {outlineVisible}
  {currentFolderPath} {rootFolderExpanded} {folderTree} {expandedFolders} {nativePath} {dirty} {fileName} {filePath}
  {sidebarWidth} {tabs} {activeTabId} {fontSize} {lineHeight} {markdown} {readonlyDocumentMode} {externalFileWarning}
  {outline} {activeOutlineId} {collapsedOutlineIds} {visibleOutlineIds} {statusMessage} {version} {stats}
  {getCompactPath} {getFolderName} {getDirectoryLabel} {toggleMenu} {closeMenu} {toggleTheme} {minimizeWindow}
  {maximizeWindow} {closeAppWindow} {createNewWindow} {createNewFile} {openFileDialog} {openFolderDialog} {openRecentFile}
  {saveMarkdownFile} {runCommand} {setMode} {toggleOutlineVisible} {toggleFocusMode} {toggleRootFolder} {toggleFolderCollapse}
  {startResize} {switchTab} {closeTab} {updateFontSize} {updateLineHeight} {updateContentWidth} {updateMarkdown}
  {updateActiveOutlineFromSourceScroll} {updateActiveOutlineFromSemanticScroll} {handleEditorPaste} {handleEditorDrop}
  {isOutlineItemExpandable} {toggleOutlineItemExpanded} {jumpToOutlineItem} {openMarkdownFile}
/>
