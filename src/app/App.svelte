<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import {
    isTauriRuntime,
    listenDesktopFileDrops,
    listenDesktopMenuCommands,
    type NativeDocument,
    type RecentDocument,
    type SnapshotRecord
  } from '../lib/desktop/tauriStorage';
  import { createEditorCore, type EditorChangeEvent, type EditorCommand, type EditorMode } from '../lib/editor-core';
  import { calculateDocumentStats, extractOutline, type DocumentStats, type OutlineItem } from '../lib/outline/outlineService';
  import { createRichMarkdownSample } from '../lib/markdown/sample';
  import { normalizeMarkdownForSave } from '../lib/markdown/normalize';
  import AppTitleBar from './components/AppTitleBar.svelte';
  import DocumentTabs from './components/DocumentTabs.svelte';
  import EditorToolbar from './components/EditorToolbar.svelte';
  import EditorWorkspace from './components/EditorWorkspace.svelte';
  import ExplorerSidebar from './components/ExplorerSidebar.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import type { FileTreeNode, Tab } from './types';
  import { getCompactPath, getDirectoryLabel, getFolderName } from './utils/pathLabels';
  import {
    exportMarkdownInBrowser,
    findDroppedMarkdownPath,
    getExternalFileWarning,
    loadDocumentSnapshots,
    loadFolderTree,
    loadRecentDocuments,
    openMarkdownFromDialog,
    pickFolderPath,
    readMarkdownFromPath,
    rememberNativeDocument,
    saveNativeMarkdownFile
  } from './services/documentFiles';
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
  import { getDefaultExpandedFolders, expandAncestors as expandFolderAncestors, toggleExpandedFolder } from './services/folderTree';
  import { createImageMarkdownSrc, getImageFiles } from './services/imageMarkdown';
  import {
    isOutlineItemExpandable as getOutlineItemExpandable,
    isOutlineItemVisible as getOutlineItemVisible,
    pruneCollapsedOutlineIds as getPrunedCollapsedOutlineIds,
    toggleOutlineItemExpanded as getToggledOutlineItemIds
  } from './services/outlineState';
  import {
    getActiveOutlineIdFromSemantic,
    getActiveOutlineIdFromSource,
    getSemanticScrollAnchor,
    getSourceHeadingSelection,
    getSourceScrollAnchor,
    getSourceLineHeight as getTextareaLineHeight,
    scrollSemanticToAnchor,
    scrollSourceToAnchor
  } from './services/outlineNavigation';
  import {
    applyEditorLayoutSettings as applyEditorLayoutSettingsToDocument,
    applyThemeSetting,
    applyTypographySettings as applyTypographySettingsToDocument,
    loadPersistedEditorSettings,
    persistEditorSetting
  } from './services/settings';
  import { writeRecoveryDraft as writeRecoveryDraftToStorage } from './services/recoveryDraft';
  import { createBlankTab, createDefaultTab, getNativeDocumentTargetTab, getOrCreateReusableTab, writeActiveTabState } from './services/tabs';

  const LARGE_DOCUMENT_LIMIT = 300_000;
  const RECOVERY_KEY = 'new-md-save-recovery';
  const initialMarkdown = createRichMarkdownSample();

  let markdown = initialMarkdown;
  let mode: EditorMode = 'semantic';
  let dirty = false;
  let version = 0;
  let theme: 'light' | 'dark' = 'light';
  let fileName = '阶段3样例.md';
  let filePath = 'D:\\Demo\\NewMd\\阶段3样例.md';
  let nativePath: string | null = null;
  let statusMessage = '阶段4：桌面体验与稳定性打磨';
  let desktopEnabled = false;
  let recentFiles: RecentDocument[] = [];
  let snapshots: SnapshotRecord[] = [];
  let outline: OutlineItem[] = extractOutline(initialMarkdown);
  let outlineVisible = true;
  let activeOutlineId = outline[0]?.id ?? '';
  let collapsedOutlineIds = new Set<string>();
  let visibleOutlineIds = new Set(outline.map((item) => item.id));
  let suppressOutlineScrollUntil = 0;
  let outlineDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let stats: DocumentStats = calculateDocumentStats(initialMarkdown);
  let fontSize = 16;
  let lineHeight = 1.75;
  let contentWidthPercent = 68;
  let focusMode = false;
  let editorHost: HTMLDivElement;
  let fileInput: HTMLInputElement;
  let sourceTextarea: HTMLTextAreaElement;
  let semanticPane: HTMLElement;
  let sourcePane: HTMLElement;
  let pendingSourceScrollTop: number | null = null;
  let largeDocumentMode = false;
  let readonlyDocumentMode = false;
  let externalFileWarning = '';
  let lastKnownModifiedAt = 0;
  let desktopUnlisteners: Array<() => void> = [];
  let currentFolderPath = '';
  let folderTree: FileTreeNode[] = [];
  let expandedFolders = new Set<string>();

  let tabs: Tab[] = [createDefaultTab(initialMarkdown)];
  let activeTabId = 'default';

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
      lastKnownModifiedAt
    });
  }

  // 加载指定 Tab 的状态并更新编辑器
  function loadTabState(tab: Tab) {
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
      editor.updateOptions({ readonly: readonlyDocumentMode, mode: largeDocumentMode ? 'source' : mode });
      editor.setMarkdown(markdown, { reason: 'switch-tab', dirty: tab.dirty });
    }

    outline = extractOutline(markdown);
    activeOutlineId = outline[0]?.id ?? '';
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

  // 递归展开路径父级目录的辅助函数
  function expandAncestors(filePathStr: string, rootPathStr: string) {
    expandedFolders = expandFolderAncestors(expandedFolders, filePathStr, rootPathStr);
  }

  function toggleFolderCollapse(folderPath: string) {
    expandedFolders = toggleExpandedFolder(expandedFolders, folderPath);
  }

  // 顶级目录展开与收起状态
  let rootFolderExpanded = true;
  function toggleRootFolder() {
    rootFolderExpanded = !rootFolderExpanded;
  }

  // 侧边栏宽度拉伸状态与函数
  let sidebarWidth = 250;
  let isResizing = false;

  function startResize(event: MouseEvent) {
    event.preventDefault();
    isResizing = true;
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResize);
  }

  function handleResize(event: MouseEvent) {
    if (!isResizing) return;
    let newWidth = event.clientX;
    const minWidth = 180;
    const maxWidth = 500;
    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;
    sidebarWidth = newWidth;
  }

  function stopResize() {
    isResizing = false;
    window.removeEventListener('mousemove', handleResize);
    window.removeEventListener('mouseup', stopResize);
  }

  let activeMenu: string | null = null;

  function toggleMenu(menu: string) {
    if (activeMenu === menu) {
      activeMenu = null;
    } else {
      activeMenu = menu;
    }
  }

  function closeMenu(menu: string) {
    if (activeMenu === menu) {
      activeMenu = null;
    }
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
    setMode: (nextMode) => setMode(nextMode),
    getMode: () => mode,
    toggleTheme: () => toggleTheme(),
    toggleFocusMode: () => toggleFocusMode()
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
    onChange: syncFromEditor
  });

  const unsubscribe = editor.subscribe(syncFromEditor);

  onMount(async () => {
    desktopEnabled = isTauriRuntime();
    editor.mount(editorHost);
    await loadPersistedSettings();
    await refreshRecentFiles();
    await setupDesktopEvents();
    window.addEventListener('keydown', handleGlobalShortcut);
    fileCheckTimer = window.setInterval(() => {
      checkExternalFileChange();
    }, 5000);
    await tick();
    syncSourceTextareaHeight();
    await updateWindowTitle().catch(() => undefined);

    const parentDir = getDirectoryLabel(filePath);
    if (parentDir && parentDir !== '当前文件夹') {
      loadFolder(parentDir).catch(() => undefined);
    }
  });

  async function loadPersistedSettings() {
    const settings = await loadPersistedEditorSettings(desktopEnabled);

    if (settings.theme) {
      theme = settings.theme;
      applyThemeSetting(theme);
      editor.updateTheme({ name: theme });
    }
    if (settings.fontSize) {
      fontSize = settings.fontSize;
      applyTypographySettings();
    }
    if (settings.lineHeight) {
      lineHeight = settings.lineHeight;
      applyTypographySettings();
    }
    if (settings.contentWidthPercent) {
      contentWidthPercent = settings.contentWidthPercent;
      applyEditorLayoutSettings();
    }
  }

  onDestroy(() => {
    for (const unlisten of desktopUnlisteners) {
      unlisten();
    }
    if (fileCheckTimer !== null) {
      window.clearInterval(fileCheckTimer);
    }
    window.removeEventListener('keydown', handleGlobalShortcut);
    unsubscribe();
    editor.destroy();
  });

  function syncFromEditor(event: EditorChangeEvent) {
    markdown = event.markdown;
    dirty = event.dirty;
    version = event.version;
    mode = event.mode;
    outline = extractOutline(event.markdown);
    if (!outline.some((item) => item.id === activeOutlineId)) {
      activeOutlineId = outline[0]?.id ?? '';
    }
    pruneCollapsedOutlineIds();
    stats = calculateDocumentStats(event.markdown);

    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab) {
      activeTab.markdown = markdown;
      activeTab.dirty = dirty;
      activeTab.version = version;
      tabs = [...tabs];
    }

    if (event.markdown.length > LARGE_DOCUMENT_LIMIT) {
      syncSourceTextareaHeight();
      return;
    }
    syncSourceTextareaHeight();
  }

  async function setMode(nextMode: EditorMode) {
    if (largeDocumentMode && nextMode === 'semantic') {
      statusMessage = '大文件已进入只读源码模式，暂不切回语义编辑以避免卡顿';
      return;
    }
    if (nextMode === mode) {
      return;
    }

    const scrollAnchor = mode === 'semantic'
      ? getSemanticScrollAnchor(outline, semanticPane)
      : getSourceScrollAnchor(outline, sourcePane?.scrollTop ?? 0, getSourceLineHeight(), sourceTextarea);

    editor.updateOptions({ mode: nextMode });
    syncSourceTextareaHeight();
    await tick();
    suppressOutlineScrollUntil = Date.now() + 300;
    requestAnimationFrame(() => {
      if (nextMode === 'semantic') {
        scrollSemanticToAnchor(outline, semanticPane, scrollAnchor);
        return;
      }

      scrollSourceToAnchor(outline, sourcePane, sourceTextarea, scrollAnchor);
    });
  }

  function updateMarkdown(event: Event) {
    pendingSourceScrollTop = sourcePane?.scrollTop ?? null;
    editor.setMarkdown((event.currentTarget as HTMLTextAreaElement).value);
    syncSourceTextareaHeight(pendingSourceScrollTop);
  }

  function runCommand(command: EditorCommand) {
    editor.execute(command);
    editor.focus();
  }

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    applyThemeSetting(theme);
    localStorage.setItem('new-md-theme', theme);
    persistSetting('theme', theme);
    editor.updateTheme({ name: theme });
  }

  function updateFontSize(event: Event) {
    fontSize = Number((event.currentTarget as HTMLInputElement).value);
    localStorage.setItem('new-md-font-size', String(fontSize));
    persistSetting('fontSize', fontSize);
    applyTypographySettings();
  }

  function updateLineHeight(event: Event) {
    lineHeight = Number((event.currentTarget as HTMLInputElement).value);
    localStorage.setItem('new-md-line-height', String(lineHeight));
    persistSetting('lineHeight', lineHeight);
    applyTypographySettings();
  }

  function updateContentWidth(event: Event) {
    contentWidthPercent = Number((event.currentTarget as HTMLInputElement).value);
    localStorage.setItem('new-md-content-width-percent', String(contentWidthPercent));
    persistSetting('contentWidthPercent', contentWidthPercent);
    applyEditorLayoutSettings();
  }

  function applyTypographySettings() {
    applyTypographySettingsToDocument(fontSize, lineHeight);
  }

  function applyEditorLayoutSettings() {
    applyEditorLayoutSettingsToDocument(contentWidthPercent);
  }

  function toggleFocusMode() {
    focusMode = !focusMode;
  }

  function toggleOutlineVisible() {
    outlineVisible = !outlineVisible;
  }

  function isOutlineItemExpandable(index: number) {
    return getOutlineItemExpandable(outline, index);
  }

  function toggleOutlineItemExpanded(item: OutlineItem) {
    collapsedOutlineIds = getToggledOutlineItemIds(collapsedOutlineIds, item);
  }

  function pruneCollapsedOutlineIds() {
    collapsedOutlineIds = getPrunedCollapsedOutlineIds(outline, collapsedOutlineIds);
  }

  $: visibleOutlineIds = new Set(outline.filter((_item, index) => getOutlineItemVisible(outline, collapsedOutlineIds, index)).map((item) => item.id));

  function syncSourceTextareaHeight(restoreScrollTop: number | null = pendingSourceScrollTop) {
    requestAnimationFrame(() => {
      if (!sourceTextarea) {
        return;
      }
      sourceTextarea.style.height = 'auto';
      sourceTextarea.style.height = `${Math.max(sourceTextarea.scrollHeight, sourceTextarea.clientHeight)}px`;
      if (restoreScrollTop !== null && sourcePane && mode === 'source') {
        sourcePane.scrollTop = restoreScrollTop;
        pendingSourceScrollTop = null;
      }
    });
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

  async function openDroppedMarkdown(paths: string[]) {
    const target = findDroppedMarkdownPath(paths);
    if (!target) {
      statusMessage = '拖放文件未包含 Markdown / 文本文件';
      return;
    }
    if (dirty) {
      writeRecoveryDraft('drag-open-blocked');
      statusMessage = '当前文档有未保存修改，已保留恢复副本；请先保存后再拖放打开';
      return;
    }

    const { document, error } = await readMarkdownFromPath(target, '拖放打开失败');
    if (error) {
      statusMessage = error;
    }
    if (document) {
      await applyNativeDocument(document, '已通过拖放打开 Markdown 文件');
    }
  }

  async function openFileDialog() {
    if (dirty) {
      writeRecoveryDraft('open-dialog');
    }
    if (desktopEnabled) {
      const { document, error } = await openMarkdownFromDialog();
      if (error) {
        statusMessage = error;
      }
      if (document) {
        await applyNativeDocument(document, '已通过 Tauri 打开 Markdown 文件');
      }
      return;
    }

    fileInput.click();
  }

  async function openMarkdownFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    saveActiveTabState();

    const browserFileTarget = getOrCreateReusableTab(tabs, activeTabId);
    tabs = browserFileTarget.tabs;
    activeTabId = browserFileTarget.activeTabId;
    const targetTab = browserFileTarget.targetTab;

    targetTab.fileName = file.name;
    targetTab.filePath = `本地浏览器文件：${file.name}`;
    targetTab.nativePath = null;
    targetTab.markdown = text;
    targetTab.dirty = false;
    targetTab.lastKnownModifiedAt = 0;
    targetTab.largeDocumentMode = text.length > LARGE_DOCUMENT_LIMIT;
    targetTab.readonlyDocumentMode = targetTab.largeDocumentMode;
    targetTab.externalFileWarning = '';

    tabs = [...tabs];
    loadTabState(targetTab);

    statusMessage = '已打开 Markdown 文件';
    input.value = '';
  }

  async function saveMarkdownFile(saveAs = false) {
    if (largeDocumentMode && !saveAs) {
      statusMessage = '大文件处于只读源码模式，请使用另存为或缩小文件后再继续编辑';
      return;
    }

    if (desktopEnabled) {
      const path = saveAs ? null : nativePath;
      const markdownToSave = normalizeMarkdownForSave(editor.getMarkdown());
      writeRecoveryDraft(saveAs ? 'before-save-as' : 'before-save');
      const { document, error } = await saveNativeMarkdownFile(path, markdownToSave, fileName, nativePath);
      if (error) {
        statusMessage = error;
      }
      if (document) {
        localStorage.removeItem(RECOVERY_KEY);
        await applyNativeDocument(document, '已通过 Tauri 保存 Markdown 文件', true);
      }
      return;
    }

    const markdownToSave = normalizeMarkdownForSave(editor.getMarkdown());
    exportMarkdownInBrowser(markdownToSave, fileName);
    statusMessage = '已导出 Markdown 文件';
    editor.setMarkdown(markdownToSave, { reason: 'save-file' });
  }

  async function openRecentFile(path: string) {
    if (!desktopEnabled) {
      return;
    }

    const { document, error } = await readMarkdownFromPath(path, '打开最近文件失败');
    if (error) {
      statusMessage = error;
    }

    if (document) {
      await applyNativeDocument(document, '已打开最近文件');
    }
  }

  async function applyNativeDocument(document: NativeDocument, message: string, saved = false) {
    const isLargeDocument = document.markdown.length > LARGE_DOCUMENT_LIMIT || document.sizeBytes > LARGE_DOCUMENT_LIMIT;

    const existingTab = tabs.find((t) => t.nativePath === document.path);
    if (existingTab && !saved) {
      switchTab(existingTab.id);
      statusMessage = '已切换到已打开的标签页';
      return;
    }

    saveActiveTabState();

    const nativeDocumentTarget = getNativeDocumentTargetTab(tabs, activeTabId, existingTab, saved);
    tabs = nativeDocumentTarget.tabs;
    activeTabId = nativeDocumentTarget.activeTabId;
    const targetTab = nativeDocumentTarget.targetTab;

    targetTab.fileName = document.fileName;
    targetTab.filePath = document.path;
    targetTab.nativePath = document.path;
    targetTab.markdown = document.markdown;
    targetTab.dirty = false;
    targetTab.lastKnownModifiedAt = document.modifiedAt;
    targetTab.largeDocumentMode = isLargeDocument;
    targetTab.readonlyDocumentMode = isLargeDocument || document.readonly;
    targetTab.externalFileWarning = document.readonly ? '当前文件是只读文件，建议使用另存为保存修改' : '';

    activeTabId = targetTab.id;
    tabs = [...tabs];
    loadTabState(targetTab);

    statusMessage = message;
    await rememberNativeDocument(document, calculateDocumentStats(document.markdown).words);
    await refreshRecentFiles();
    await refreshSnapshots();
    if (isLargeDocument) {
      statusMessage = '大文件已用只读源码模式打开，避免语义解析阻塞界面';
    }

    const parentDir = getDirectoryLabel(document.path);
    if (parentDir && parentDir !== '当前文件夹') {
      if (!currentFolderPath) {
        loadFolder(parentDir).catch(() => undefined);
      } else {
        expandAncestors(document.path, currentFolderPath);
      }
    }
  }

  async function loadFolder(folderPath: string) {
    currentFolderPath = folderPath;
    rootFolderExpanded = true;
    const result = await loadFolderTree(folderPath);
    if ('error' in result) {
      statusMessage = result.error;
      folderTree = result.tree;
    } else {
      folderTree = result;
    }

    // 默认只展开顶层
    expandedFolders = Array.isArray(folderTree) ? getDefaultExpandedFolders(folderTree) : new Set<string>();

    statusMessage = `已载入文件夹：${getFolderName(folderPath)}`;
  }

  async function openFolderDialog() {
    if (desktopEnabled) {
      const { folderPath, error } = await pickFolderPath();
      if (error) {
        statusMessage = error;
      }
      if (folderPath) {
        await loadFolder(folderPath);
      }
    }
  }

  function createNewFile() {
    if (dirty) {
      writeRecoveryDraft('new-file-blocked');
      statusMessage = '当前文档有未保存修改，已保留恢复副本并新建文档';
    }

    saveActiveTabState();

    const newTab = createBlankTab();

    tabs = [...tabs, newTab];
    activeTabId = newTab.id;
    loadTabState(newTab);
    updateWindowTitle();
  }

  // 关闭标签页
  function closeTab(tabId: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }

    const tabToClose = tabs.find((t) => t.id === tabId);
    if (!tabToClose) return;

    if (tabToClose.dirty) {
      const confirmClose = confirm(`文件 "${tabToClose.fileName}" 已修改，是否确认关闭？您的修改可能会丢失。`);
      if (!confirmClose) return;
    }

    const index = tabs.findIndex((t) => t.id === tabId);
    tabs = tabs.filter((t) => t.id !== tabId);

    if (activeTabId === tabId) {
      if (tabs.length > 0) {
        const newActiveIndex = Math.min(index, tabs.length - 1);
        activeTabId = tabs[newActiveIndex].id;
        loadTabState(tabs[newActiveIndex]);
      } else {
        createNewFile();
      }
    }
  }

  async function refreshRecentFiles() {
    recentFiles = await loadRecentDocuments(desktopEnabled);
  }

  async function refreshSnapshots() {
    snapshots = await loadDocumentSnapshots(desktopEnabled, nativePath);
  }

  async function checkExternalFileChange() {
    const warning = await getExternalFileWarning(desktopEnabled, nativePath, lastKnownModifiedAt, dirty);
    if (warning) {
      externalFileWarning = warning;
    }
  }

  function jumpToOutlineItem(item: OutlineItem) {
    activeOutlineId = item.id;
    suppressOutlineScrollUntil = Date.now() + 800;

    requestAnimationFrame(() => {
      if (mode === 'semantic') {
        scrollSemanticToAnchor(outline, semanticPane, { outlineId: item.id, sectionProgress: 0 });
        return;
      }

      const selection = getSourceHeadingSelection(markdown, item);
      sourceTextarea.focus();
      sourceTextarea.setSelectionRange(selection.start, selection.end);
      const lineHeightPx = getSourceLineHeight();
      sourcePane?.scrollTo({ top: Math.max(0, (item.line - 1) * lineHeightPx - 40), behavior: 'smooth' });
    });
  }

  function updateActiveOutlineFromSourceScroll() {
    if (Date.now() < suppressOutlineScrollUntil) {
      return;
    }
    if (!sourcePane) {
      activeOutlineId = '';
      return;
    }
    activeOutlineId = getActiveOutlineIdFromSource(outline, sourcePane.scrollTop, getSourceLineHeight());
  }

  function updateActiveOutlineFromSemanticScroll() {
    if (Date.now() < suppressOutlineScrollUntil) {
      return;
    }
    activeOutlineId = getActiveOutlineIdFromSemantic(outline, semanticPane);
  }

  function getSourceLineHeight() {
    return getTextareaLineHeight(sourceTextarea);
  }

  function handleEditorDrop(event: DragEvent) {
    const files = getImageFiles(event.dataTransfer?.files);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    insertImageFiles(files);
  }

  function handleEditorPaste(event: ClipboardEvent) {
    const files = getImageFiles(event.clipboardData?.files);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    insertImageFiles(files);
  }

  function insertImageFiles(files: File[]) {
    for (const file of files) {
      const markdownSrc = createImageMarkdownSrc(fileName, file.name);
      editor.execute({
        type: 'insertImage',
        src: markdownSrc,
        alt: file.name
      });
    }
    statusMessage = `已插入 ${files.length} 张图片相对路径`;
    editor.focus();
  }

  function persistSetting(key: string, value: unknown) {
    persistEditorSetting(desktopEnabled, key, value);
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

<div class="app-layout" class:focus-mode={focusMode} class:resizing={isResizing} style={`--md-editor-content-width-percent: ${contentWidthPercent}`}>
  <input bind:this={fileInput} class="file-input" type="file" accept=".md,.markdown,text/markdown,text/plain" on:change={openMarkdownFile} />

  <AppTitleBar
    {theme}
    {desktopEnabled}
    {activeMenu}
    {recentFiles}
    {mode}
    {outlineVisible}
    {getCompactPath}
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
    {setMode}
    {toggleOutlineVisible}
    {toggleFocusMode}
  />

  <main class="workspace" style="--sidebar-width: {sidebarWidth}px">
    <ExplorerSidebar
      {currentFolderPath}
      {rootFolderExpanded}
      {folderTree}
      {expandedFolders}
      {nativePath}
      {dirty}
      {fileName}
      {filePath}
      {isResizing}
      {getFolderName}
      {getDirectoryLabel}
      {toggleRootFolder}
      {toggleFolderCollapse}
      {openRecentFile}
      {startResize}
    />

    <section class="editor-shell" aria-label="编辑器">
      <DocumentTabs {tabs} {activeTabId} {switchTab} {closeTab} {createNewFile} />

      <EditorToolbar
        {mode}
        {fontSize}
        {lineHeight}
        {contentWidthPercent}
        {outlineVisible}
        {openFileDialog}
        {saveMarkdownFile}
        {runCommand}
        {updateFontSize}
        {updateLineHeight}
        {updateContentWidth}
        {setMode}
        {toggleOutlineVisible}
        {toggleFocusMode}
      />

      <EditorWorkspace
        bind:sourcePane
        bind:semanticPane
        bind:sourceTextarea
        bind:editorHost
        {mode}
        {markdown}
        {readonlyDocumentMode}
        {externalFileWarning}
        {outlineVisible}
        {outline}
        {activeOutlineId}
        {collapsedOutlineIds}
        {visibleOutlineIds}
        {saveMarkdownFile}
        {updateMarkdown}
        {updateActiveOutlineFromSourceScroll}
        {updateActiveOutlineFromSemanticScroll}
        {handleEditorPaste}
        {handleEditorDrop}
        {isOutlineItemExpandable}
        {toggleOutlineItemExpanded}
        {jumpToOutlineItem}
      />

      <StatusBar {dirty} {statusMessage} {version} {stats} {mode} {readonlyDocumentMode} />
    </section>
  </main>
</div>
