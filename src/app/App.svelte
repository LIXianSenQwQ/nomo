<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import {
    listenDesktopFileDrops,
    listenDesktopMenuCommands,
    isTauriRuntime,
    listAppSettings,
    updateAppSetting,
    type RecentDocument,
  } from '../lib/desktop/tauriStorage';
  import {
    createEditorCore,
    setCodeBlockDiagramRenderer,
    setCodeBlockMathRenderer,
    setCodeBlockTokenizer,
    type EditorChangeEvent,
    type EditorCommand,
    type InlinePendingMarks,
    type EditorMode,
  } from '../lib/editor-core';
  import {
    calculateDocumentStats,
    extractOutline,
    type DocumentStats,
    type OutlineItem,
  } from '../lib/outline/outlineService';
  import { createRichMarkdownSample } from '../lib/markdown/sample';
  import {
    extractFrontMatterBlock,
    removeFrontMatter,
    replaceFrontMatterContent,
    type FrontMatterBlock,
  } from '../lib/markdown/frontMatter';
  import AppShell from './components/AppShell.svelte';
  import SettingsDrawer from './components/SettingsDrawer.svelte';
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
  import { isOutlineItemVisible as getOutlineItemVisible } from './services/outlineState';
  import { writeRecoveryDraft as writeRecoveryDraftToStorage } from './services/recoveryDraft';
  import { createDefaultTab, writeActiveTabState } from './services/tabs';
  import {
    closeActiveMenu,
    createSidebarResizeHandlers,
    getNextActiveMenu,
  } from './services/appUiState';
  import { createEditorSettingsController } from './services/editorSettingsController';
  import { applyBlockStyleSetting } from './services/settings';
  import { createFolderExplorerController } from './services/folderExplorerController';
  import { createDocumentActionsController } from './services/documentActionsController';
  import { createOutlineInteractionController } from './services/outlineInteractionController';
  import { createEditorInteractionController } from './services/editorInteractionController';
  import { createKatexMathRenderer } from '../lib/services/katexMathRenderer';
  import { createMermaidDiagramRenderer } from '../lib/services/mermaidDiagramRenderer';
  import { createShikiCodeTokenizer } from '../lib/services/shikiCodeTokenizer';

  const LARGE_DOCUMENT_LIMIT = 300_000;
  const RECOVERY_KEY = 'new-md-save-recovery';
  const initialMarkdown = createRichMarkdownSample();

  setCodeBlockTokenizer(createShikiCodeTokenizer());
  setCodeBlockDiagramRenderer(createMermaidDiagramRenderer());
  setCodeBlockMathRenderer(createKatexMathRenderer());

  let markdown = initialMarkdown,
    dirty = false,
    version = 0;
  let mode: EditorMode = 'semantic';
  let theme: 'light' | 'dark' = 'light';
  let fileName = '阶段3样例.md',
    filePath = 'D:\\Demo\\NewMd\\阶段3样例.md';
  let nativePath: string | null = null;
  let statusMessage = '阶段4：桌面体验与稳定性打磨';
  let desktopEnabled = false;
  let recentFiles: RecentDocument[] = [];
  let outline: OutlineItem[] = extractOutline(initialMarkdown);
  let outlineVisible = true,
    activeOutlineId = outline[0]?.id ?? '';
  let collapsedOutlineIds = new Set<string>();
  let visibleOutlineIds = new Set(outline.map((item) => item.id));
  let suppressOutlineScrollUntil = 0;
  let stats: DocumentStats = calculateDocumentStats(initialMarkdown);
  let fontSize = 16,
    lineHeight = 1.75,
    contentWidthPercent = 68,
    focusMode = false,
    blockStyle: 'classic' | 'modern' = 'modern';
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
  let toastMessage = '';
  let toastTimer: number | null = null;
  let pendingInlineMarks: InlinePendingMarks = createEmptyPendingInlineMarks();
  let frontMatterEditing = false;
  let frontMatter: FrontMatterBlock | null = extractFrontMatterBlock(markdown);

  let tabs: Tab[] = [createDefaultTab(initialMarkdown)];
  let activeTabId = 'default';

  function persistWorkspaceState() {
    if (desktopEnabled) {
      updateAppSetting('workspaceTabs', { tabs, activeTabId }).catch(() => undefined);
    }
  }

  // 保存当前活跃 Tab 的状态
  function saveActiveTabState() {
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
    if (activeTabId === tabId) return;
    saveActiveTabState();
    const targetTab = tabs.find((t) => t.id === tabId);
    if (targetTab) {
      activeTabId = tabId;
      persistWorkspaceState();
      loadTabState(targetTab);
      updateWindowTitle();
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
  const createNewWindow = () => createAppWindow(desktopEnabled);

  const commandHandlers: AppCommandHandlers = {
    createNewFile: () => createNewFile(),
    createNewWindow,
    openFileDialog: () => openFileDialog(),
    openFolderDialog: () => openFolderDialog(),
    openRecentFile: (path) => openRecentFile(path),
    saveMarkdownFile: (saveAs) => saveMarkdownFile(saveAs),
    runCommand: (command) => runCommand(command),
    openTablePicker: () => openTablePicker(),
    editFrontMatter: () => editFrontMatter(),
    showUnavailableFeature: (featureName) => showUnavailableFeature(featureName),
    setMode: (nextMode) => setMode(nextMode),
    getMode: () => mode,
    toggleTheme: () => toggleTheme(),
    toggleFocusMode: () => toggleFocusMode(),
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

  const editor = createEditorCore({
    markdown,
    mode,
    theme: { name: theme },
    onChange: syncFromEditor,
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

  async function handleSaveSettings(newWorkspaceDir: string) {
    if (newWorkspaceDir && newWorkspaceDir !== currentFolderPath) {
      await updateAppSetting('workspaceDir', newWorkspaceDir).catch(() => undefined);
      currentFolderPath = newWorkspaceDir;
      await loadFolder(newWorkspaceDir).catch(() => undefined);
    }
    closeSettings();
  }

  const documentActions = createDocumentActionsController({
    largeDocumentLimit: LARGE_DOCUMENT_LIMIT,
    recoveryKey: RECOVERY_KEY,
    getDesktopEnabled: () => desktopEnabled,
    getDirty: () => dirty,
    setMarkdown: (value) => { markdown = value; },
    setDirty: (value) => { dirty = value; },
    setLargeDocumentMode: (value) => { largeDocumentMode = value; },
    setReadonlyDocumentMode: (value) => { readonlyDocumentMode = value; },
    getNativePath: () => nativePath,
    setNativePath: (value) => { nativePath = value; },
    getFileName: () => fileName,
    setFileName: (value) => { fileName = value; },
    getFilePath: () => filePath,
    setFilePath: (value) => { filePath = value; },
    getLastKnownModifiedAt: () => lastKnownModifiedAt,
    setLastKnownModifiedAt: (value) => { lastKnownModifiedAt = value; },
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
    getFileName: () => fileName,
    setStatusMessage: (message) => {
      statusMessage = message;
    },
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
  const updateBlockStyle = editorSettings.updateBlockStyle;
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
  const updateActiveOutlineFromSourceScroll =
    outlineInteraction.updateActiveOutlineFromSourceScroll;
  const updateActiveOutlineFromSemanticScroll =
    outlineInteraction.updateActiveOutlineFromSemanticScroll;

  async function handleCreateNode(event: CustomEvent<{ parentPath: string; type: 'folder' | 'file'; name: string }>) {
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
        openRecentFile(targetPath);
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
    
    tabs.forEach(t => {
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
    
    if (desktopEnabled) {
      const settings = await listAppSettings().catch(() => []);
      const workspaceTabsSetting = settings.find((s) => s.key === 'workspaceTabs');
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

      const workspaceDirSetting = settings.find((s) => s.key === 'workspaceDir');
      if (workspaceDirSetting) {
        try {
          currentFolderPath = JSON.parse(workspaceDirSetting.valueJson);
        } catch {
          // ignore
        }
      } else {
        const { getDefaultWorkspaceDir } = await import('../lib/desktop/tauriStorage');
        currentFolderPath = await getDefaultWorkspaceDir().catch(() => '');
        if (currentFolderPath) {
          await updateAppSetting('workspaceDir', currentFolderPath).catch(() => undefined);
        }
      }
    }

    editor.mount(editorHost);
    await loadPersistedSettings();
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
    window.removeEventListener('keydown', handleGlobalShortcut);
    sidebarResize.destroy();
    unsubscribe();
    editor.destroy();
  });

  function syncFromEditor(event: EditorChangeEvent) {
    if (isSwitchingTab) return;

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

    if (desktopEnabled && dirty && nativePath) {
      documentActions.debouncedAutoSave(event.markdown);
    }

    if (event.markdown.length > LARGE_DOCUMENT_LIMIT) {
      syncSourceTextareaHeight();
      return;
    }
    syncSourceTextareaHeight();
  }

  function toggleFocusMode() {
    focusMode = !focusMode;
  }

  function openTablePicker() {
    tablePickerOpen = true;
  }

  function closeTablePicker() {
    tablePickerOpen = false;
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
  {fontSize}
  {lineHeight}
  {blockStyle}
  {markdown}
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
  {openRecentFile}
  {saveMarkdownFile}
  {runCommand}
  {pendingInlineMarks}
  {openTablePicker}
  {editFrontMatter}
  {showUnavailableFeature}
  {closeTablePicker}
  {insertTableWithSize}
  {setMode}
  {toggleOutlineVisible}
  {toggleFocusMode}
  {toggleRootFolder}
  {toggleFolderCollapse}
  {startResize}
  {switchTab}
  {closeTab}
  {updateFontSize}
  {updateLineHeight}
  {updateContentWidth}
  {updateBlockStyle}
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
/>

<SettingsDrawer
  isOpen={isSettingsOpen}
  currentWorkspaceDir={currentFolderPath}
  {closeSettings}
  saveSettings={handleSaveSettings}
/>

<div class="app-toast" class:visible={toastMessage} role="status">{toastMessage}</div>
