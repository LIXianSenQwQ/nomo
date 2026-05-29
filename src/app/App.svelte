<script lang="ts">
  import {
    Bold,
    Braces,
    CheckSquare,
    ChevronDown,
    Code2,
    FilePlus,
    FileText,
    FolderPlus,
    FolderOpen,
    Heading1,
    Image,
    Italic,
    List,
    Moon,
    PanelRightClose,
    PanelRightOpen,
    Pilcrow,
    Quote,
    RefreshCw,
    Save,
    Sigma,
    Sun,
    Table2,
    X
  } from '@lucide/svelte';
  import { onDestroy, onMount, tick } from 'svelte';
  import {
    createDocumentSnapshot,
    isTauriRuntime,
    listenDesktopFileDrops,
    listenDesktopMenuCommands,
    listAppSettings,
    listDocumentSnapshots,
    listRecentFiles,
    openFolderWithDialog,
    openMarkdownWithDialog,
    readMarkdownFile,
    rememberRecentFile,
    saveMarkdownNative,
    statMarkdownFile,
    updateAppSetting,
    type NativeDocument,
    type RecentDocument,
    type SnapshotRecord
  } from '../lib/desktop/tauriStorage';
  import { createEditorCore, type EditorChangeEvent, type EditorCommand, type EditorMode } from '../lib/editor-core';
  import { extractTechnicalBlocks, type TechnicalBlocks } from '../lib/markdown/technicalBlocks';
  import { calculateDocumentStats, extractOutline, type DocumentStats, type OutlineItem } from '../lib/outline/outlineService';
  import { createKatexMathRenderer } from '../lib/services/katexMathRenderer';
  import { createMermaidDiagramRenderer } from '../lib/services/mermaidDiagramRenderer';

  const LARGE_DOCUMENT_LIMIT = 300_000;
  const RECOVERY_KEY = 'new-md-save-recovery';
  const initialMarkdown = `---\ntitle: NewMd 阶段4\n---\n# NewMd 阶段4\n\n现在开始补齐桌面体验与稳定性。菜单快捷键、拖放打开、窗口状态、外部修改检查和保存失败恢复策略会进入桌面基线。\n\n## Desktop\n\n- [x] Tauri 原生文件打开保存\n- [x] 最近文件和设置跨启动保留\n- [ ] 文件被外部修改时提示\n- [ ] 保存失败时保留恢复副本\n\n## Mermaid\n\n\`\`\`mermaid\nflowchart LR\n  Open[Open] --> Edit[Edit]\n  Edit --> Save[Save]\n  Save --> Snapshot[Snapshot]\n\`\`\`\n`;

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
  let stats: DocumentStats = calculateDocumentStats(initialMarkdown);
  let technicalBlocks: TechnicalBlocks = extractTechnicalBlocks(initialMarkdown);
  let mathHtml: string[] = [];
  let mermaidSvg: string[] = [];
  let renderErrors: string[] = [];
  let fontSize = 16;
  let lineHeight = 1.75;
  let focusMode = false;
  let editorHost: HTMLDivElement;
  let fileInput: HTMLInputElement;
  let sourceTextarea: HTMLTextAreaElement;
  let semanticPane: HTMLElement;
  let sourcePane: HTMLElement;
  let renderVersion = 0;
  let largeDocumentMode = false;
  let readonlyDocumentMode = false;
  let externalFileWarning = '';
  let lastKnownModifiedAt = 0;
  let desktopUnlisteners: Array<() => void> = [];
  let currentFolderPath = '';
  let folderTree: FileTreeNode[] = [];
  let expandedFolders = new Set<string>();

  // 定义多标签页接口与数据结构
  interface Tab {
    id: string;
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

  interface FileTreeNode {
    name: string;
    path: string;
    is_dir: boolean;
    children: FileTreeNode[];
  }

  let tabs: Tab[] = [
    {
      id: 'default',
      fileName: '阶段3样例.md',
      filePath: 'D:\\Demo\\NewMd\\阶段3样例.md',
      nativePath: null,
      markdown: initialMarkdown,
      dirty: false,
      lastKnownModifiedAt: 0,
      largeDocumentMode: false,
      readonlyDocumentMode: false,
      externalFileWarning: '',
      version: 0
    }
  ];
  let activeTabId = 'default';

  // 保存当前活跃 Tab 的状态
  function saveActiveTabState() {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) {
      activeTab.markdown = markdown;
      activeTab.dirty = dirty;
      activeTab.version = version;
      activeTab.fileName = fileName;
      activeTab.filePath = filePath;
      activeTab.nativePath = nativePath;
      activeTab.largeDocumentMode = largeDocumentMode;
      activeTab.readonlyDocumentMode = readonlyDocumentMode;
      activeTab.externalFileWarning = externalFileWarning;
      activeTab.lastKnownModifiedAt = lastKnownModifiedAt;
      tabs = [...tabs];
    }
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
    stats = calculateDocumentStats(markdown);
    technicalBlocks = extractTechnicalBlocks(markdown);
    updateTechnicalPreviews(markdown);
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
    if (!filePathStr || !rootPathStr) return;
    const normalizedFile = filePathStr.replace(/\\/g, '/');
    const normalizedRoot = rootPathStr.replace(/\\/g, '/');
    if (normalizedFile.startsWith(normalizedRoot)) {
      const relative = normalizedFile.slice(normalizedRoot.length);
      const parts = relative.split('/').filter(Boolean);
      let currentPath = normalizedRoot;
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath + '/' + parts[i];
        const winPath = currentPath.replace(/\//g, '\\');
        expandedFolders.add(winPath);
      }
      expandedFolders = expandedFolders;
    }
  }

  function toggleFolderCollapse(folderPath: string) {
    if (expandedFolders.has(folderPath)) {
      expandedFolders.delete(folderPath);
    } else {
      expandedFolders.add(folderPath);
    }
    expandedFolders = expandedFolders;
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

  function getFolderName(path: string) {
    if (!path || path === '当前文件夹') {
      return '当前文件夹';
    }
    const normalized = path.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1] || path;
    if (lastPart.endsWith(':')) {
      return lastPart + '\\';
    }
    return lastPart;
  }

  import { getCurrentWindow } from '@tauri-apps/api/window';

  let activeMenu: string | null = null;

  function toggleMenu(menu: string) {
    if (activeMenu === menu) {
      activeMenu = null;
    } else {
      activeMenu = menu;
    }
  }

  function clickOutside(node: HTMLElement, handler: () => void) {
    const onClick = (event: MouseEvent) => {
      if (node && !node.contains(event.target as Node)) {
        handler();
      }
    };
    document.addEventListener('click', onClick, true);
    return {
      destroy() {
        document.removeEventListener('click', onClick, true);
      }
    };
  }

  async function minimizeWindow() {
    if (desktopEnabled) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('minimize_window');
      } catch (error) {
        console.error('最小化窗口失败:', error);
      }
    }
  }

  async function maximizeWindow() {
    if (desktopEnabled) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('maximize_window');
      } catch (error) {
        console.error('最大化窗口失败:', error);
      }
    }
  }

  async function closeAppWindow() {
    if (desktopEnabled) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('close_window');
      } catch (error) {
        console.error('关闭窗口失败:', error);
      }
    }
  }

  async function createNewWindow() {
    if (desktopEnabled) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('create_new_window').catch(() => undefined);
    }
  }

  async function updateWindowTitle() {
    if (!desktopEnabled) return;
    const win = getCurrentWindow();
    const title = `${fileName}${dirty ? ' *' : ''} - NewMd`;
    await win.setTitle(title).catch(() => undefined);
  }

  $: {
    if (desktopEnabled && (fileName || dirty !== undefined)) {
      updateWindowTitle();
    }
  }
  let fileCheckTimer: number | null = null;

  const mathRenderer = createKatexMathRenderer();
  const diagramRenderer = createMermaidDiagramRenderer();

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
    updateTechnicalPreviews(markdown);
    await tick();
    syncSourceTextareaHeight();
    await updateWindowTitle().catch(() => undefined);

    const parentDir = getDirectoryLabel(filePath);
    if (parentDir && parentDir !== '当前文件夹') {
      loadFolder(parentDir).catch(() => undefined);
    }
  });

  async function loadPersistedSettings() {
    const nativeSettings = desktopEnabled ? await listAppSettings().catch(() => []) : [];
    const settings = new Map(nativeSettings.map((setting) => [setting.key, setting.valueJson]));
    const savedTheme = parseSetting<string>(settings, 'theme') ?? localStorage.getItem('new-md-theme');
    const savedFontSize = Number(parseSetting<number>(settings, 'fontSize') ?? localStorage.getItem('new-md-font-size'));
    const savedLineHeight = Number(parseSetting<number>(settings, 'lineHeight') ?? localStorage.getItem('new-md-line-height'));

    if (savedTheme === 'dark' || savedTheme === 'light') {
      theme = savedTheme;
      document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : '';
      editor.updateTheme({ name: theme });
    }
    if (Number.isFinite(savedFontSize) && savedFontSize >= 14 && savedFontSize <= 22) {
      fontSize = savedFontSize;
      applyTypographySettings();
    }
    if (Number.isFinite(savedLineHeight) && savedLineHeight >= 1.4 && savedLineHeight <= 2.1) {
      lineHeight = savedLineHeight;
      applyTypographySettings();
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
    stats = calculateDocumentStats(event.markdown);
    technicalBlocks = extractTechnicalBlocks(event.markdown);

    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab) {
      activeTab.markdown = markdown;
      activeTab.dirty = dirty;
      activeTab.version = version;
      tabs = [...tabs];
    }

    if (event.markdown.length > LARGE_DOCUMENT_LIMIT) {
      mathHtml = [];
      mermaidSvg = [];
      renderErrors = [];
      syncSourceTextareaHeight();
      return;
    }
    syncSourceTextareaHeight();
    updateTechnicalPreviews(event.markdown);
  }

  function setMode(nextMode: EditorMode) {
    if (largeDocumentMode && nextMode === 'semantic') {
      statusMessage = '大文件已进入只读源码模式，暂不切回语义编辑以避免卡顿';
      return;
    }
    editor.updateOptions({ mode: nextMode });
    syncSourceTextareaHeight();
  }

  function updateMarkdown(event: Event) {
    editor.setMarkdown((event.currentTarget as HTMLTextAreaElement).value);
    syncSourceTextareaHeight();
  }

  function runCommand(command: EditorCommand) {
    editor.execute(command);
    editor.focus();
  }

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : '';
    localStorage.setItem('new-md-theme', theme);
    persistSetting('theme', theme);
    editor.updateTheme({ name: theme });
    updateTechnicalPreviews(markdown);
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

  function applyTypographySettings() {
    document.documentElement.style.setProperty('--md-editor-font-size', `${fontSize}px`);
    document.documentElement.style.setProperty('--md-editor-line-height', String(lineHeight));
  }

  function toggleFocusMode() {
    focusMode = !focusMode;
  }

  function toggleOutlineVisible() {
    outlineVisible = !outlineVisible;
  }

  function syncSourceTextareaHeight() {
    requestAnimationFrame(() => {
      if (!sourceTextarea) {
        return;
      }
      sourceTextarea.style.height = 'auto';
      sourceTextarea.style.height = `${Math.max(sourceTextarea.scrollHeight, sourceTextarea.clientHeight)}px`;
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
    if (command === 'new-file') {
      createNewFile();
    } else if (command === 'open-file') {
      openFileDialog();
    } else if (command === 'open-directory') {
      openFolderDialog();
    } else if (command.startsWith('open-recent:')) {
      const path = command.slice('open-recent:'.length);
      openRecentFile(path);
    } else if (command === 'save-file') {
      saveMarkdownFile();
    } else if (command === 'save-file-as') {
      saveMarkdownFile(true);
    } else if (command === 'undo') {
      runCommand({ type: 'undo' });
    } else if (command === 'redo') {
      runCommand({ type: 'redo' });
    } else if (command === 'toggle-source') {
      setMode(mode === 'source' ? 'semantic' : 'source');
    } else if (command === 'toggle-theme') {
      toggleTheme();
    } else if (command === 'toggle-focus') {
      toggleFocusMode();
    }
  }

  function handleGlobalShortcut(event: KeyboardEvent) {
    if (!event.ctrlKey || event.altKey) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'n' && !event.shiftKey) {
      event.preventDefault();
      createNewFile();
    } else if (key === 'n' && event.shiftKey) {
      event.preventDefault();
      createNewWindow();
    } else if (key === 'o' && !event.shiftKey) {
      event.preventDefault();
      openFileDialog();
    } else if (key === 'o' && event.shiftKey) {
      event.preventDefault();
      openFolderDialog();
    } else if (key === 's') {
      event.preventDefault();
      saveMarkdownFile(event.shiftKey);
    } else if (key === 'e') {
      event.preventDefault();
      setMode(mode === 'source' ? 'semantic' : 'source');
    } else if (key === 'l' && event.shiftKey) {
      event.preventDefault();
      toggleTheme();
    } else if (key === 'f' && event.shiftKey) {
      event.preventDefault();
      toggleFocusMode();
    } else if (['1', '2', '3', '4'].includes(key)) {
      event.preventDefault();
      runCommand({ type: 'setHeading', level: Number(key) as 1 | 2 | 3 | 4 });
    } else if (key === '0') {
      event.preventDefault();
      runCommand({ type: 'setParagraph' });
    }
  }

  async function openDroppedMarkdown(paths: string[]) {
    const target = paths.find((path) => /\.(md|markdown|txt)$/i.test(path));
    if (!target) {
      statusMessage = '拖放文件未包含 Markdown / 文本文件';
      return;
    }
    if (dirty) {
      writeRecoveryDraft('drag-open-blocked');
      statusMessage = '当前文档有未保存修改，已保留恢复副本；请先保存后再拖放打开';
      return;
    }

    const document = await readMarkdownFile(target).catch((error) => {
      statusMessage = error instanceof Error ? error.message : '拖放打开失败';
      return null;
    });
    if (document) {
      await applyNativeDocument(document, '已通过拖放打开 Markdown 文件');
    }
  }

  async function openFileDialog() {
    if (dirty) {
      writeRecoveryDraft('open-dialog');
    }
    if (desktopEnabled) {
      const document = await openMarkdownWithDialog().catch((error) => {
        statusMessage = error instanceof Error ? error.message : '打开文件失败';
        return null;
      });
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

    let targetTab: Tab;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab && activeTab.fileName === 'untitled.md' && !activeTab.dirty && activeTab.markdown.trim() === '' && !activeTab.nativePath) {
      targetTab = activeTab;
    } else {
      const newId = 'tab-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
      const newTab: Tab = {
        id: newId,
        fileName: '',
        filePath: '',
        nativePath: null,
        markdown: '',
        dirty: false,
        lastKnownModifiedAt: 0,
        largeDocumentMode: false,
        readonlyDocumentMode: false,
        externalFileWarning: '',
        version: 0
      };
      tabs = [...tabs, newTab];
      activeTabId = newId;
      targetTab = newTab;
    }

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
      writeRecoveryDraft(saveAs ? 'before-save-as' : 'before-save');
      if (nativePath) {
        await createDocumentSnapshot(nativePath, editor.getMarkdown(), 'before-save').catch(() => undefined);
      }
      const document = await saveMarkdownNative(path, editor.getMarkdown(), fileName).catch((error) => {
        statusMessage = error instanceof Error ? error.message : '保存文件失败';
        return null;
      });
      if (document) {
        localStorage.removeItem(RECOVERY_KEY);
        await applyNativeDocument(document, '已通过 Tauri 保存 Markdown 文件', true);
      }
      return;
    }

    const blob = new Blob([editor.getMarkdown()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    statusMessage = '已导出 Markdown 文件';
    editor.setMarkdown(editor.getMarkdown(), { reason: 'save-file' });
  }

  async function openRecentFile(path: string) {
    if (!desktopEnabled) {
      return;
    }

    const document = await readMarkdownFile(path).catch((error) => {
      statusMessage = error instanceof Error ? error.message : '打开最近文件失败';
      return null;
    });

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

    let targetTab: Tab;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab && activeTab.fileName === 'untitled.md' && !activeTab.dirty && activeTab.markdown.trim() === '' && !activeTab.nativePath) {
      targetTab = activeTab;
    } else if (existingTab && saved) {
      targetTab = existingTab;
    } else {
      const newId = 'tab-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
      const newTab: Tab = {
        id: newId,
        fileName: '',
        filePath: '',
        nativePath: null,
        markdown: '',
        dirty: false,
        lastKnownModifiedAt: 0,
        largeDocumentMode: false,
        readonlyDocumentMode: false,
        externalFileWarning: '',
        version: 0
      };
      tabs = [...tabs, newTab];
      activeTabId = newId;
      targetTab = newTab;
    }

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
    await rememberRecentFile(document.path, document.fileName, calculateDocumentStats(document.markdown).words).catch(() => undefined);
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
    const { invoke } = await import('@tauri-apps/api/core');
    folderTree = await invoke<FileTreeNode[]>('get_folder_tree', { path: folderPath }).catch((error) => {
      statusMessage = error instanceof Error ? error.message : '载入文件夹文件树失败';
      return [];
    });

    // 默认只展开顶层
    expandedFolders = new Set<string>();
    if (Array.isArray(folderTree)) {
      for (const item of folderTree) {
        if (item.is_dir && item.path) {
          expandedFolders.add(item.path);
        }
      }
    }
    expandedFolders = expandedFolders;

    statusMessage = `已载入文件夹：${getFolderName(folderPath)}`;
  }

  async function openFolderDialog() {
    if (desktopEnabled) {
      const folderPath = await openFolderWithDialog().catch((error) => {
        statusMessage = error instanceof Error ? error.message : '打开文件夹失败';
        return null;
      });
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

    const newId = 'tab-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
    const newTab: Tab = {
      id: newId,
      fileName: 'untitled.md',
      filePath: '无标题.md',
      nativePath: null,
      markdown: '',
      dirty: false,
      lastKnownModifiedAt: 0,
      largeDocumentMode: false,
      readonlyDocumentMode: false,
      externalFileWarning: '',
      version: 0
    };

    tabs = [...tabs, newTab];
    activeTabId = newId;
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
    if (!desktopEnabled) {
      return;
    }
    recentFiles = await listRecentFiles().catch(() => []);
  }

  async function refreshSnapshots() {
    if (!desktopEnabled || !nativePath) {
      snapshots = [];
      return;
    }
    snapshots = await listDocumentSnapshots(nativePath).catch(() => []);
  }

  async function checkExternalFileChange() {
    if (!desktopEnabled || !nativePath || lastKnownModifiedAt === 0) {
      return;
    }

    const status = await statMarkdownFile(nativePath).catch((error) => {
      externalFileWarning = error instanceof Error ? error.message : '文件状态检查失败';
      return null;
    });
    if (!status) {
      return;
    }
    if (!status.exists) {
      externalFileWarning = '当前文件已被外部删除或移动，保存前请另存为新路径';
      return;
    }
    if (status.modifiedAt > lastKnownModifiedAt) {
      externalFileWarning = dirty ? '文件已被外部修改；保存会覆盖外部版本，已建议先另存为' : '文件已被外部修改，请从最近文件重新打开以刷新内容';
    }
  }

  function jumpToOutlineItem(item: OutlineItem) {
    setMode('source');
    requestAnimationFrame(() => {
      const lines = markdown.split(/\r?\n/);
      const start = lines.slice(0, item.line - 1).join('\n').length + (item.line > 1 ? 1 : 0);
      sourceTextarea.focus();
      sourceTextarea.setSelectionRange(start, start + lines[item.line - 1].length);
      const lineHeightPx = getSourceLineHeight();
      sourcePane?.scrollTo({ top: Math.max(0, (item.line - 1) * lineHeightPx - 40), behavior: 'smooth' });
      activeOutlineId = item.id;
    });
  }

  function updateActiveOutlineFromSourceScroll() {
    if (!outline.length || !sourcePane) {
      activeOutlineId = '';
      return;
    }
    const visibleLine = Math.max(1, Math.floor(sourcePane.scrollTop / getSourceLineHeight()) + 1);
    activeOutlineId = getOutlineItemAtLine(visibleLine)?.id ?? outline[0]?.id ?? '';
  }

  function updateActiveOutlineFromSemanticScroll() {
    if (!outline.length || !semanticPane || !editorHost) {
      activeOutlineId = '';
      return;
    }

    const headings = Array.from(editorHost.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    if (headings.length === 0) {
      activeOutlineId = outline[0]?.id ?? '';
      return;
    }

    const viewportTop = semanticPane.getBoundingClientRect().top;
    const threshold = viewportTop + 96;
    let activeIndex = 0;
    headings.forEach((heading, index) => {
      if (heading.getBoundingClientRect().top <= threshold) {
        activeIndex = index;
      }
    });
    activeOutlineId = outline[Math.min(activeIndex, outline.length - 1)]?.id ?? '';
  }

  function getOutlineItemAtLine(line: number) {
    let current = outline[0] ?? null;
    for (const item of outline) {
      if (item.line > line) {
        break;
      }
      current = item;
    }
    return current;
  }

  function getSourceLineHeight() {
    if (!sourceTextarea) {
      return 24;
    }
    const parsed = Number.parseFloat(getComputedStyle(sourceTextarea).lineHeight);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
  }

  function handleEditorDrop(event: DragEvent) {
    const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    insertImageFiles(files);
  }

  function handleEditorPaste(event: ClipboardEvent) {
    const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    insertImageFiles(files);
  }

  function insertImageFiles(files: File[]) {
    for (const file of files) {
      const markdownSrc = createImageMarkdownSrc(file.name);
      editor.execute({
        type: 'insertImage',
        src: markdownSrc,
        alt: file.name
      });
    }
    statusMessage = `已插入 ${files.length} 张图片相对路径`;
    editor.focus();
  }

  function createImageMarkdownSrc(name: string) {
    const baseName = fileName.replace(/\.(md|markdown)$/i, '') || 'document';
    const safeName = name.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-');
    return `./${baseName}.assets/${safeName}`;
  }

  function getDirectoryLabel(path: string) {
    const normalizedPath = path.replace(/\//g, '\\');
    const separatorIndex = normalizedPath.lastIndexOf('\\');
    if (separatorIndex <= 0) {
      return '当前文件夹';
    }
    return normalizedPath.slice(0, separatorIndex);
  }

  function getCompactPath(path: string) {
    const normalizedPath = path.replace(/\//g, '\\');
    const parts = normalizedPath.split('\\').filter(Boolean);
    if (parts.length <= 3) {
      return normalizedPath;
    }
    return `...\\${parts.slice(-3).join('\\')}`;
  }

  async function updateTechnicalPreviews(nextMarkdown: string) {
    const currentVersion = (renderVersion += 1);
    const blocks = extractTechnicalBlocks(nextMarkdown);
    const mathResults = await Promise.all(blocks.mathBlocks.map((block) => mathRenderer.render(block.tex, { displayMode: block.displayMode })));
    const mermaidResults = await Promise.all(blocks.mermaidBlocks.map((block) => diagramRenderer.renderMermaid(block.code, { theme })));

    if (currentVersion !== renderVersion) {
      return;
    }

    mathHtml = mathResults.map((result) => result.html);
    mermaidSvg = mermaidResults.map((result) => result.svg);
    renderErrors = [...mathResults, ...mermaidResults].flatMap((result) => (result.error ? [result.error] : []));
  }

  function persistSetting(key: string, value: unknown) {
    if (!desktopEnabled) {
      return;
    }
    updateAppSetting(key, value).catch(() => undefined);
  }

  function writeRecoveryDraft(reason: string) {
    localStorage.setItem(
      RECOVERY_KEY,
      JSON.stringify({
        reason,
        fileName,
        filePath,
        nativePath,
        markdown: editor.getMarkdown(),
        savedAt: Date.now()
      })
    );
  }

  function parseSetting<T>(settings: Map<string, string>, key: string): T | null {
    const value = settings.get(key);
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
</script>

<svelte:head>
  <title>NewMd 阶段4</title>
</svelte:head>

<div class="app-layout" class:focus-mode={focusMode} class:resizing={isResizing}>
  <input bind:this={fileInput} class="file-input" type="file" accept=".md,.markdown,text/markdown,text/plain" on:change={openMarkdownFile} />

  <header class="titlebar" data-tauri-drag-region>
    <!-- 第一层：品牌名与窗口控件 -->
    <div class="titlebar-row top-row" data-tauri-drag-region>
      <div class="titlebar-left" data-tauri-drag-region>
        <span class="app-logo">M</span>
        <span class="app-name" data-tauri-drag-region>NewMd</span>
      </div>
      <span class="titlebar-spacer" data-tauri-drag-region></span>
      <div class="titlebar-right">
        <button class="icon-btn" title="切换主题" on:click={toggleTheme}>
          {#if theme === 'light'}
            <Moon size={14} />
          {:else}
            <Sun size={14} />
          {/if}
        </button>

        {#if desktopEnabled}
          <div class="window-controls">
            <button class="control-btn" title="最小化" on:click={minimizeWindow}>
              <svg width="10" height="1" viewBox="0 0 10 1"><line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
            <button class="control-btn" title="最大化" on:click={maximizeWindow}>
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
            </button>
            <button class="control-btn close" title="关闭" on:click={closeAppWindow}>
              <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.2"/></svg>
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- 第二层：横向菜单按钮 -->
    <div class="titlebar-row bottom-row">
      <nav class="titlebar-menu">
        <!-- 文件菜单 -->
        <div class="menu-item" class:active={activeMenu === 'file'} use:clickOutside={() => { if(activeMenu === 'file') activeMenu = null; }}>
          <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('file')}>文件</button>
          {#if activeMenu === 'file'}
            <div class="dropdown-menu">
              <button on:click={() => { createNewFile(); activeMenu = null; }}>新建 <span class="shortcut">Ctrl+N</span></button>
              <button on:click={() => { createNewWindow(); activeMenu = null; }}>新建窗口 <span class="shortcut">Ctrl+Shift+N</span></button>
              <button on:click={() => { openFileDialog(); activeMenu = null; }}>打开... <span class="shortcut">Ctrl+O</span></button>
              <button on:click={() => { openFolderDialog(); activeMenu = null; }}>打开文件夹... <span class="shortcut">Ctrl+Shift+O</span></button>
              
              <div class="nested-trigger">
                <span>打开最近</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"><path d="M3 1l4 4-4 4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <div class="dropdown-menu nested">
                  {#each recentFiles.slice(0, 8) as recent}
                    <button on:click={() => { openRecentFile(recent.path); activeMenu = null; }}>
                      {recent.title ?? getCompactPath(recent.path)}
                    </button>
                  {/each}
                  {#if recentFiles.length === 0}
                    <span class="disabled-item">无最近打开的文件</span>
                  {/if}
                </div>
              </div>

              <div class="divider"></div>
              <button on:click={() => { saveMarkdownFile(); activeMenu = null; }}>保存 <span class="shortcut">Ctrl+S</span></button>
              <button on:click={() => { saveMarkdownFile(true); activeMenu = null; }}>另存为... <span class="shortcut">Ctrl+Shift+S</span></button>
              <div class="divider"></div>
              <button on:click={() => { closeAppWindow(); activeMenu = null; }}>退出 <span class="shortcut">Alt+F4</span></button>
            </div>
          {/if}
        </div>

        <!-- 编辑菜单 -->
        <div class="menu-item" class:active={activeMenu === 'edit'} use:clickOutside={() => { if(activeMenu === 'edit') activeMenu = null; }}>
          <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('edit')}>编辑</button>
          {#if activeMenu === 'edit'}
            <div class="dropdown-menu">
              <button on:click={() => { runCommand({ type: 'undo' }); activeMenu = null; }}>撤销 <span class="shortcut">Ctrl+Z</span></button>
              <button on:click={() => { runCommand({ type: 'redo' }); activeMenu = null; }}>重做 <span class="shortcut">Ctrl+Y</span></button>
            </div>
          {/if}
        </div>

        <!-- 段落菜单 -->
        <div class="menu-item" class:active={activeMenu === 'paragraph'} use:clickOutside={() => { if(activeMenu === 'paragraph') activeMenu = null; }}>
          <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('paragraph')}>段落</button>
          {#if activeMenu === 'paragraph'}
            <div class="dropdown-menu">
              <button on:click={() => { runCommand({ type: 'setHeading', level: 1 }); activeMenu = null; }}>一级标题 <span class="shortcut">Ctrl+1</span></button>
              <button on:click={() => { runCommand({ type: 'setHeading', level: 2 }); activeMenu = null; }}>二级标题 <span class="shortcut">Ctrl+2</span></button>
              <button on:click={() => { runCommand({ type: 'setHeading', level: 3 }); activeMenu = null; }}>三级标题 <span class="shortcut">Ctrl+3</span></button>
              <button on:click={() => { runCommand({ type: 'setHeading', level: 4 }); activeMenu = null; }}>四级标题 <span class="shortcut">Ctrl+4</span></button>
              <button on:click={() => { runCommand({ type: 'setParagraph' }); activeMenu = null; }}>正文 <span class="shortcut">Ctrl+0</span></button>
            </div>
          {/if}
        </div>

        <!-- 格式菜单 -->
        <div class="menu-item" class:active={activeMenu === 'format'} use:clickOutside={() => { if(activeMenu === 'format') activeMenu = null; }}>
          <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('format')}>格式</button>
          {#if activeMenu === 'format'}
            <div class="dropdown-menu">
              <button on:click={() => { runCommand({ type: 'toggleBold' }); activeMenu = null; }}>粗体 <span class="shortcut">Ctrl+B</span></button>
              <button on:click={() => { runCommand({ type: 'toggleItalic' }); activeMenu = null; }}>斜体 <span class="shortcut">Ctrl+I</span></button>
              <button on:click={() => { runCommand({ type: 'toggleBlockquote' }); activeMenu = null; }}>引用块</button>
              <button on:click={() => { runCommand({ type: 'toggleBulletList' }); activeMenu = null; }}>无序列表</button>
              <button on:click={() => { runCommand({ type: 'toggleTaskList' }); activeMenu = null; }}>任务列表</button>
            </div>
          {/if}
        </div>

        <!-- 查看菜单 -->
        <div class="menu-item" class:active={activeMenu === 'view'} use:clickOutside={() => { if(activeMenu === 'view') activeMenu = null; }}>
          <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('view')}>查看</button>
          {#if activeMenu === 'view'}
            <div class="dropdown-menu">
              <button on:click={() => { setMode(mode === 'source' ? 'semantic' : 'source'); activeMenu = null; }}>切换源码模式 <span class="shortcut">Ctrl+E</span></button>
              <button on:click={() => { toggleOutlineVisible(); activeMenu = null; }}>{outlineVisible ? '隐藏文档大纲' : '显示文档大纲'}</button>
              <button on:click={() => { toggleTheme(); activeMenu = null; }}>切换主题 <span class="shortcut">Ctrl+Shift+L</span></button>
              <button on:click={() => { toggleFocusMode(); activeMenu = null; }}>切换专注模式 <span class="shortcut">Ctrl+Shift+F</span></button>
            </div>
          {/if}
        </div>
      </nav>
    </div>
  </header>

  <main class="workspace" style="--sidebar-width: {sidebarWidth}px">
    <aside class="rail" aria-label="资源管理器">
      <header class="explorer-header">
        <span>资源管理器</span>
      </header>

      <section class="file-tree" aria-label="文件夹结构">
        {#snippet renderTree(nodes: FileTreeNode[], depth: number)}
          {#each nodes as node}
            {#if node.is_dir}
              {@const isExpanded = expandedFolders.has(node.path)}
              <div class="tree-folder-wrapper">
                <button
                  type="button"
                  class="tree-folder nested-dir"
                  class:collapsed={!isExpanded}
                  style="padding-left: {12 + depth * 12}px"
                  title={node.path}
                  on:click={() => toggleFolderCollapse(node.path)}
                >
                  <span class="chevron-icon">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M3 4.5l3 3 3-3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </span>
                  <FolderOpen size={13} />
                  <span>{node.name}</span>
                </button>
                {#if isExpanded && node.children && node.children.length > 0}
                  {@render renderTree(node.children, depth + 1)}
                {/if}
              </div>
            {:else}
              <button
                type="button"
                class="tree-file"
                class:active={nativePath === node.path}
                style="padding-left: {34 + depth * 12}px"
                title={node.path}
                on:click={() => openRecentFile(node.path)}
              >
                <FileText size={13} />
                <span>{node.name}</span>
                {#if nativePath === node.path}
                  <small>{dirty ? '未保存' : '已同步'}</small>
                {/if}
              </button>
            {/if}
          {/each}
        {/snippet}

        <div class="tree-root">
          {#if currentFolderPath}
            <button
              type="button"
              class="tree-folder-root-title"
              class:collapsed={!rootFolderExpanded}
              title={currentFolderPath}
              on:click={toggleRootFolder}
            >
              <span class="chevron-icon">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M3 4.5l3 3 3-3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
              <FolderOpen size={14} />
              <span>{getFolderName(currentFolderPath)}</span>
            </button>

            {#if rootFolderExpanded}
              <div class="recent-tree recursive-tree-container">
                {@render renderTree(folderTree, 1)}
                {#if folderTree.length === 0}
                  <p class="empty-note">目录下暂无 Markdown 文件</p>
                {/if}
              </div>
            {/if}
          {:else}
            <button
              type="button"
              class="tree-folder-root-title"
              class:collapsed={!rootFolderExpanded}
              title={getDirectoryLabel(filePath)}
              on:click={toggleRootFolder}
            >
              <span class="chevron-icon">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="M3 4.5l3 3 3-3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
              <FolderOpen size={14} />
              <span>{getFolderName(getDirectoryLabel(filePath))}</span>
            </button>

            {#if rootFolderExpanded}
              <button type="button" class="tree-file active" title={filePath}>
                <FileText size={13} />
                <span>{fileName}</span>
                <small>{dirty ? '未保存' : '已同步'}</small>
              </button>
            {/if}
          {/if}
        </div>
      </section>
      <div class="sidebar-resizer" class:active={isResizing} on:mousedown={startResize}></div>
    </aside>

    <section class="editor-shell" aria-label="编辑器">
      <header class="topbar" aria-label="文档标签">
        <div class="tabs-container">
          {#each tabs as tab}
            <button
              type="button"
              class="doc-tab"
              class:active={activeTabId === tab.id}
              title={tab.filePath}
              on:click={() => switchTab(tab.id)}
            >
              <FileText size={13} />
              <span class="tab-title">{tab.fileName}</span>
              {#if tab.dirty}
                <span class="dirty-indicator" title="未保存修改"></span>
              {/if}
              <span
                class="close-tab-btn"
                role="button"
                tabindex="0"
                title="关闭标签页"
                on:click|stopPropagation={(e) => closeTab(tab.id, e)}
                on:keydown|stopPropagation={(e) => { if(e.key === 'Enter') closeTab(tab.id, e); }}
              >
                <X size={12} />
              </span>
            </button>
          {/each}
        </div>
        <div class="tab-actions" aria-label="标签页操作">
          <button
            type="button"
            class="tab-action"
            title={outlineVisible ? '隐藏文档大纲' : '显示文档大纲'}
            aria-label={outlineVisible ? '隐藏文档大纲' : '显示文档大纲'}
            aria-pressed={outlineVisible}
            on:click={toggleOutlineVisible}
          >
            {#if outlineVisible}
              <PanelRightClose size={16} />
            {:else}
              <PanelRightOpen size={16} />
            {/if}
          </button>
          <button type="button" class="tab-add" title="新建文件" aria-label="新建文件" on:click={createNewFile}>+</button>
        </div>
      </header>

    <div class="toolbar" aria-label="格式工具">
      <button title="打开 Markdown" on:click={openFileDialog}>
        <FolderOpen size={17} />
      </button>
      <button title="导出保存" on:click={() => saveMarkdownFile()}>
        <Save size={17} />
      </button>
      <span class="divider"></span>
      <button title="标题" on:click={() => runCommand({ type: 'setHeading', level: 1 })}>
        <Heading1 size={17} />
      </button>
      <button title="粗体" on:click={() => runCommand({ type: 'toggleBold' })}>
        <Bold size={17} />
      </button>
      <button title="斜体" on:click={() => runCommand({ type: 'toggleItalic' })}>
        <Italic size={17} />
      </button>
      <button title="引用" on:click={() => runCommand({ type: 'toggleBlockquote' })}>
        <Quote size={17} />
      </button>
      <button title="列表" on:click={() => runCommand({ type: 'toggleBulletList' })}>
        <List size={17} />
      </button>
      <button title="任务列表" on:click={() => runCommand({ type: 'toggleTaskList' })}>
        <CheckSquare size={17} />
      </button>
      <button title="表格" on:click={() => runCommand({ type: 'insertTable', rows: 2, columns: 3 })}>
        <Table2 size={17} />
      </button>
      <button title="代码块" on:click={() => runCommand({ type: 'insertCodeBlock', language: 'ts', code: 'console.log(\"NewMd\");' })}>
        <Code2 size={17} />
      </button>
      <button title="数学公式" on:click={() => runCommand({ type: 'insertMathBlock', tex: 'E = mc^2' })}>
        <Sigma size={17} />
      </button>
      <button title="图片" on:click={() => runCommand({ type: 'insertImage', src: './assets/image.png', alt: 'image' })}>
        <Image size={17} />
      </button>
      <button title="Mermaid 占位" on:click={() => runCommand({ type: 'insertMermaidBlock', code: 'flowchart TD\\n  A --> B' })}>
        <Braces size={17} />
      </button>
      <span class="divider"></span>
      <label class="range-control" title="字号">
        <span>{fontSize}px</span>
        <input type="range" min="14" max="22" step="1" value={fontSize} on:input={updateFontSize} />
      </label>
      <label class="range-control" title="行高">
        <span>{lineHeight.toFixed(2)}</span>
        <input type="range" min="1.4" max="2.1" step="0.05" value={lineHeight} on:input={updateLineHeight} />
      </label>
      <span class="toolbar-spacer"></span>
      <div class="mode-switch" aria-label="编辑模式">
        <button class:active={mode === 'semantic'} on:click={() => setMode('semantic')}>语义</button>
        <button class:active={mode === 'source'} on:click={() => setMode('source')}>源码</button>
      </div>
      <button
        class="icon-button"
        class:active={outlineVisible}
        title={outlineVisible ? '隐藏文档大纲' : '显示文档大纲'}
        aria-label={outlineVisible ? '隐藏文档大纲' : '显示文档大纲'}
        aria-pressed={outlineVisible}
        on:click={toggleOutlineVisible}
      >
        {#if outlineVisible}
          <PanelRightClose size={18} />
        {:else}
          <PanelRightOpen size={18} />
        {/if}
      </button>
      <button class="icon-button" title="刷新渲染" on:click={() => updateTechnicalPreviews(markdown)}>
        <RefreshCw size={18} />
      </button>
      <button class="icon-button" title="专注模式" on:click={toggleFocusMode}>
        <Pilcrow size={18} />
      </button>
    </div>

    {#if externalFileWarning}
      <div class="desktop-alert" role="status">
        <strong>文件状态</strong>
        <span>{externalFileWarning}</span>
        <button on:click={() => saveMarkdownFile(true)}>另存为</button>
      </div>
    {/if}

    <div class="editor-grid" class:source-only={mode === 'source'}>
      <section bind:this={sourcePane} class="editor-pane source-pane" aria-label="Markdown 源文本" on:scroll={updateActiveOutlineFromSourceScroll}>
        <div class="document-layout">
          <textarea
            bind:this={sourceTextarea}
            class="source-editor"
            bind:value={markdown}
            readonly={readonlyDocumentMode}
            on:input={updateMarkdown}
            on:paste={handleEditorPaste}
            on:drop={handleEditorDrop}
            spellcheck="false"
          ></textarea>
          {#if outlineVisible}
            <aside class="content-outline" aria-label="文档大纲">
              <strong>文档大纲</strong>
              {#if outline.length > 0}
                <div class="content-outline-list">
                  {#each outline as item}
                    <button type="button" class:active={activeOutlineId === item.id} style={`padding-left: ${(item.level - 1) * 16}px`} title={item.title} on:click={() => jumpToOutlineItem(item)}>
                      {#if item.level === 1}
                        <ChevronDown size={13} />
                      {:else}
                        <span></span>
                      {/if}
                      <span>{item.title}</span>
                    </button>
                  {/each}
                </div>
              {:else}
                <p>当前文档还没有标题</p>
              {/if}
            </aside>
          {/if}
        </div>
      </section>

      <section bind:this={semanticPane} class="semantic-pane" aria-label="语义编辑区" on:scroll={updateActiveOutlineFromSemanticScroll} on:paste={handleEditorPaste} on:drop={handleEditorDrop} on:dragover|preventDefault>
        <div class="document-layout">
          <div bind:this={editorHost} class="prosemirror-host"></div>
          {#if outlineVisible}
            <aside class="content-outline" aria-label="文档大纲">
              <strong>文档大纲</strong>
              {#if outline.length > 0}
                <div class="content-outline-list">
                  {#each outline as item}
                    <button type="button" class:active={activeOutlineId === item.id} style={`padding-left: ${(item.level - 1) * 16}px`} title={item.title} on:click={() => jumpToOutlineItem(item)}>
                      {#if item.level === 1}
                        <ChevronDown size={13} />
                      {:else}
                        <span></span>
                      {/if}
                      <span>{item.title}</span>
                    </button>
                  {/each}
                </div>
              {:else}
                <p>当前文档还没有标题</p>
              {/if}
            </aside>
          {/if}
        </div>
      </section>
    </div>

    <footer class="statusbar">
      <span>{dirty ? '未保存更改' : '已同步'}</span>
      <span>{statusMessage}</span>
      <span>version {version}</span>
      <span>{stats.chars} chars</span>
      <span>{stats.words} words</span>
      <span>{mode}</span>
      {#if readonlyDocumentMode}
        <span>readonly</span>
      {/if}
    </footer>
  </section>
</main>
</div>

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--md-editor-bg);
  }

  .app-layout.resizing {
    user-select: none;
    cursor: col-resize;
  }

  .workspace {
    display: grid;
    grid-template-columns: var(--sidebar-width, 250px) minmax(0, 1fr);
    flex: 1;
    min-height: 0;
    min-width: 0;
    background: var(--md-editor-bg);
  }

  .file-input {
    position: fixed;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  .rail {
    position: relative; /* 允许 sidebar-resizer 相对定位 */
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    border-right: 1px solid var(--md-editor-border);
    background: var(--md-editor-rail);
  }

  .sidebar-resizer {
    position: absolute;
    top: 0;
    right: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 1000;
    transition: background-color 0.15s;
  }

  .sidebar-resizer:hover,
  .sidebar-resizer.active {
    background-color: var(--md-editor-accent, #007acc);
  }

  .explorer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 54px;
    padding: 0 18px 0 20px;
    border-bottom: 1px solid var(--md-editor-border);
    color: var(--md-editor-heading-fg);
    font-size: 14px;
    font-weight: 700;
  }

  .explorer-header button,
  .explorer-actions button {
    display: inline-grid;
    place-items: center;
    min-width: 32px;
    min-height: 32px;
    border: 0;
    border-radius: var(--md-editor-radius-sm);
    background: transparent;
    color: var(--md-editor-muted-fg);
    cursor: pointer;
  }

  .explorer-header button:hover,
  .explorer-actions button:hover {
    background: var(--md-editor-surface);
    color: var(--md-editor-accent-strong);
  }

  .app-layout.focus-mode .workspace {
    grid-template-columns: 1fr;
  }

  .app-layout.focus-mode .rail {
    display: none;
  }

  .explorer-header button:focus-visible,
  .explorer-actions button:focus-visible,
  .menu-bar button:focus-visible,
  .mode-switch button:focus-visible,
  .icon-button:focus-visible,
  .tab-action:focus-visible,
  .tab-add:focus-visible,
  .toolbar button:focus-visible,
  .tree-file:focus-visible,
  .content-outline button:focus-visible {
    outline: 2px solid var(--md-editor-accent);
    outline-offset: -2px;
  }

  .file-tree {
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 14px 16px 18px;
  }

  .tree-file:hover {
    background: var(--md-editor-surface);
  }

  .tree-root,
  .recent-tree {
    display: grid;
    gap: 2px;
    margin-top: 0;
  }

  .tree-folder,
  .tree-file {
    display: grid;
    grid-template-columns: 14px 18px minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-height: 30px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--md-editor-radius-sm);
    background: transparent;
    color: var(--md-editor-fg);
    text-align: left;
  }

  .tree-folder {
    font-weight: 600;
  }

  .tree-file {
    cursor: pointer;
  }

  .tree-file.active {
    background: linear-gradient(90deg, var(--md-editor-sidebar-active), color-mix(in srgb, var(--md-editor-sidebar-active) 55%, transparent));
    color: var(--md-editor-accent-strong);
    font-weight: 700;
  }

  .tree-indent {
    width: 14px;
  }

  .tree-folder span:last-child,
  .tree-folder.nested-dir span:last-child,
  .tree-file span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .tree-folder :global(svg),
  .tree-file :global(svg) {
    color: var(--md-editor-muted-fg);
  }

  .tree-file small {
    color: var(--md-editor-muted-fg);
    font-size: 11px;
    white-space: nowrap;
  }

  .tree-section-title {
    margin: 22px 8px 8px;
    color: var(--md-editor-muted-fg);
    font-size: 12px;
    font-weight: 600;
  }

  .explorer-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    margin-top: auto;
    padding: 0 18px;
    border-top: 1px solid var(--md-editor-border);
    background: var(--md-editor-chrome);
  }

  .empty-note {
    color: var(--md-editor-muted-fg);
    font-size: 11px;
  }

  .empty-note {
    margin: 10px 8px 0;
  }

  .editor-shell {
    display: grid;
    grid-template-rows: auto auto auto minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 0;
    background: var(--md-editor-surface);
  }

  .menu-bar,
  .topbar,
  .toolbar,
  .statusbar {
    display: flex;
    align-items: center;
    min-width: 0;
    border-bottom: 1px solid var(--md-editor-border);
    background: var(--md-editor-chrome);
  }

  .menu-bar {
    gap: 10px;
    min-height: 54px;
    padding: 0 18px 0 22px;
  }

  .menu-bar button {
    display: inline-grid;
    place-items: center;
    min-width: 44px;
    min-height: 30px;
    padding: 0 9px;
    border: 0;
    border-radius: var(--md-editor-radius-sm);
    background: transparent;
    color: var(--md-editor-fg);
    font-size: 13px;
    cursor: pointer;
  }

  .app-mark {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    margin-right: 10px;
    border-radius: 6px;
    background: var(--md-editor-accent-strong);
    color: var(--md-editor-surface);
    font-family: var(--md-editor-font-mono);
    font-size: 11px;
    font-weight: 800;
  }

  .menu-bar button:hover {
    background: var(--md-editor-surface);
  }

  .menu-spacer {
    flex: 1;
  }

  .menu-bar .menu-icon {
    min-width: 34px;
    color: var(--md-editor-muted-fg);
  }

  .topbar {
    display: flex;
    align-items: flex-end;
    min-height: 40px;
    padding: 0 10px;
    background: var(--md-editor-chrome);
    border-bottom: 1px solid var(--md-editor-border);
    overflow: hidden;
  }

  .tab-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    min-height: 40px;
    margin-left: 4px;
  }

  .tab-action {
    display: inline-grid;
    place-items: center;
    min-width: 32px;
    min-height: 32px;
    border: 0;
    border-radius: var(--md-editor-radius-sm);
    background: transparent;
    color: var(--md-editor-muted-fg);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .tab-action:hover,
  .tab-action[aria-pressed='true'] {
    background: var(--md-editor-surface);
    color: var(--md-editor-accent-strong);
  }

  .tabs-container {
    display: flex;
    align-items: flex-end;
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .tabs-container::-webkit-scrollbar {
    display: none;
  }

  .doc-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 120px;
    max-width: 180px;
    height: 36px;
    padding: 0 12px;
    border: 0;
    border-right: 1px solid var(--md-editor-border);
    background: transparent;
    color: var(--md-editor-muted-fg);
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    position: relative;
    transition: background 0.15s, color 0.15s;
    box-sizing: border-box;
  }

  .doc-tab:hover {
    background: rgba(128, 128, 128, 0.06);
    color: var(--md-editor-fg);
  }

  .doc-tab.active {
    background: var(--md-editor-surface);
    color: var(--md-editor-heading-fg);
    font-weight: 600;
    border-bottom: 2px solid var(--md-editor-accent);
  }

  .doc-tab.active:hover {
    background: var(--md-editor-surface);
  }

  .tab-title {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .doc-tab :global(svg:first-child) {
    color: var(--md-editor-accent);
    flex-shrink: 0;
  }

  .dirty-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--md-editor-accent, #007acc);
    flex-shrink: 0;
  }

  .close-tab-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    color: var(--md-editor-muted-fg);
    transition: background-color 0.15s, color 0.15s;
    flex-shrink: 0;
  }

  .close-tab-btn:hover {
    background-color: rgba(128, 128, 128, 0.2);
    color: var(--md-editor-danger, #e81123) !important;
  }

  .tab-add {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    font-size: 20px;
    border: 0;
    background: transparent;
    color: var(--md-editor-muted-fg);
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.15s;
  }

  .tab-add:hover {
    background: rgba(128, 128, 128, 0.1);
    color: var(--md-editor-fg);
  }

  .mode-switch {
    display: grid;
    grid-template-columns: repeat(2, minmax(50px, 1fr));
    min-width: 104px;
    padding: 2px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-chrome);
  }

  .mode-switch button,
  .icon-button,
  .toolbar button {
    display: inline-grid;
    place-items: center;
    min-width: 32px;
    min-height: 32px;
    border: 0;
    border-radius: var(--md-editor-radius-sm);
    background: transparent;
    cursor: pointer;
  }

  .mode-switch button {
    padding: 0 10px;
    color: var(--md-editor-muted-fg);
    font-size: 12px;
    font-weight: 700;
  }

  .mode-switch button.active,
  .icon-button:hover,
  .icon-button.active,
  .toolbar button:hover {
    background: var(--md-editor-surface);
    color: var(--md-editor-accent-strong);
  }

  .icon-button {
    border: 1px solid var(--md-editor-border);
    background: transparent;
    color: var(--md-editor-muted-fg);
  }

  .toolbar {
    gap: 4px;
    min-height: 44px;
    padding: 5px 16px;
    overflow: hidden;
  }

  .toolbar button {
    color: var(--md-editor-muted-fg);
  }

  .toolbar-spacer {
    flex: 1;
    min-width: 16px;
  }

  .divider {
    width: 1px;
    height: 24px;
    margin: 0 4px;
    background: var(--md-editor-border);
  }

  .range-control {
    display: inline-grid;
    grid-template-columns: 46px 96px;
    align-items: center;
    gap: 6px;
    min-height: 34px;
    color: var(--md-editor-muted-fg);
    font-family: var(--md-editor-font-mono);
    font-size: 12px;
  }

  .range-control input {
    width: 96px;
    accent-color: var(--md-editor-accent);
  }

  .editor-grid {
    display: grid;
    grid-template-columns: 1fr;
    min-width: 0;
    min-height: 0;
  }

  .desktop-alert {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    min-height: 42px;
    padding: 8px 18px;
    border-bottom: 1px solid color-mix(in srgb, var(--md-editor-danger) 35%, var(--md-editor-border));
    background: color-mix(in srgb, var(--md-editor-danger) 9%, var(--md-editor-bg));
    color: var(--md-editor-fg);
    font-size: 13px;
  }

  .desktop-alert strong {
    color: var(--md-editor-danger);
  }

  .desktop-alert span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .desktop-alert button {
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid var(--md-editor-border);
    border-radius: var(--md-editor-radius-sm);
    background: var(--md-editor-surface);
    cursor: pointer;
  }

  .editor-pane,
  .semantic-pane {
    min-width: 0;
    min-height: 0;
  }

  .editor-pane {
    display: none;
    background: var(--md-editor-document-bg);
  }

  .editor-grid.source-only .source-pane {
    display: block;
  }

  .editor-grid.source-only .semantic-pane {
    display: none;
  }

  .semantic-pane {
    overflow-x: hidden;
    overflow-y: auto;
    background: var(--md-editor-document-bg);
  }

  .source-pane {
    overflow-x: hidden;
    overflow-y: auto;
  }

  .document-layout {
    position: relative;
    display: flex;
    justify-content: center;
    min-height: 100%;
    padding: 44px 20px 64px;
    background:
      radial-gradient(circle at 50% 12%, color-mix(in srgb, var(--md-editor-accent) 7%, transparent), transparent 34%),
      var(--md-editor-document-bg);
  }

  .prosemirror-host {
    min-height: 100%;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 0;
    background: transparent;
  }

  .prosemirror-host :global(.ProseMirror) {
    min-height: calc(100vh - 235px);
    outline: none;
    color: var(--md-editor-fg);
    font-size: var(--md-editor-font-size);
    line-height: var(--md-editor-line-height);
    white-space: pre-wrap;
  }

  .prosemirror-host :global(.ProseMirror h1),
  .prosemirror-host :global(.ProseMirror h2),
  .prosemirror-host :global(.ProseMirror h3) {
    color: var(--md-editor-heading-fg);
    line-height: 1.2;
  }

  .prosemirror-host :global(.ProseMirror h1) {
    margin: 0 0 22px;
    font-size: 32px;
  }

  .prosemirror-host :global(.ProseMirror h2) {
    margin-top: 30px;
    font-size: 26px;
  }

  .prosemirror-host :global(.ProseMirror blockquote) {
    margin: 18px 0;
    padding: 2px 0 2px 16px;
    border-left: 3px solid var(--md-editor-blockquote-border);
    color: var(--md-editor-blockquote-fg);
  }

  .prosemirror-host :global(.ProseMirror code) {
    padding: 2px 5px;
    border-radius: var(--md-editor-radius-sm);
    background: color-mix(in srgb, var(--md-editor-code-bg) 12%, transparent);
    font-family: var(--md-editor-font-mono);
  }

  .prosemirror-host :global(.ProseMirror pre) {
    overflow: auto;
    padding: 16px;
    border: 1px solid var(--md-editor-code-border);
    border-radius: var(--md-editor-radius-md);
    background: var(--md-editor-code-bg);
    color: var(--md-editor-code-fg);
  }

  .prosemirror-host :global(.ProseMirror pre code) {
    padding: 0;
    background: transparent;
    color: inherit;
  }

  .prosemirror-host :global(.ProseMirror a) {
    color: var(--md-editor-link-fg);
  }

  .prosemirror-host :global(.ProseMirror img) {
    max-width: 100%;
    min-width: 160px;
    min-height: 90px;
    border: 1px dashed var(--md-editor-border);
    border-radius: var(--md-editor-radius-md);
    object-fit: contain;
  }

  .prosemirror-host :global(.ProseMirror ul li p:first-child) {
    margin-bottom: 0;
  }

  .prosemirror-host :global(.ProseMirror-selectednode) {
    outline: 2px solid var(--md-editor-accent);
  }

  textarea {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    padding: 0;
    border: 0;
    outline: none;
    resize: none;
    background: transparent;
    color: var(--md-editor-fg);
    font-family: var(--md-editor-font-mono);
    font-size: 14px;
    line-height: 1.75;
  }

  .source-editor {
    display: block;
    width: 100%;
    max-width: 800px;
    min-height: calc(100vh - 235px);
    margin: 0 auto;
    overflow: hidden;
  }

  .content-outline {
    position: absolute;
    top: 44px;
    right: 20px;
    z-index: 10;
    width: 200px;
    max-height: calc(100vh - 260px);
    overflow: auto;
    padding: 12px;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(4px);
    color: var(--md-editor-muted-fg);
    font-size: 12px;
  }

  .content-outline strong {
    display: block;
    margin-bottom: 12px;
    color: var(--md-editor-heading-fg);
    font-size: 13px;
    font-weight: 800;
  }

  .content-outline-list {
    display: grid;
    gap: 8px;
  }

  .content-outline button {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    align-items: center;
    gap: 7px;
    min-height: 24px;
    border: 0;
    border-radius: var(--md-editor-radius-sm);
    background: transparent;
    color: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .content-outline button:hover {
    color: var(--md-editor-accent-strong);
  }

  .content-outline button.active {
    background: color-mix(in srgb, var(--md-editor-accent) 10%, transparent);
    color: var(--md-editor-accent-strong);
    font-weight: 700;
  }

  .content-outline button span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .content-outline p {
    margin: 0;
    line-height: 1.5;
  }

  textarea::selection {
    background: var(--md-editor-selection-bg);
  }

  .statusbar {
    justify-content: flex-end;
    gap: 14px;
    min-height: 28px;
    padding: 4px 14px;
    border-top: 1px solid var(--md-editor-border);
    border-bottom: 0;
    color: var(--md-editor-muted-fg);
    font-family: var(--md-editor-font-mono);
    font-size: 12px;
  }

  @media (max-width: 920px) {
    .workspace {
      grid-template-columns: 1fr;
    }

    .rail {
      display: none;
    }

    .topbar {
      flex-wrap: wrap;
      min-height: 76px;
    }

    .document-layout {
      padding-right: 20px;
      padding-left: 20px;
    }

    .content-outline {
      display: none;
    }

    .prosemirror-host,
    .source-editor {
      width: min(820px, 100%);
    }
  }

  .titlebar {
    display: flex;
    flex-direction: column;
    height: 60px;
    background: var(--md-titlebar-bg);
    border-bottom: 1px solid var(--md-titlebar-border);
    user-select: none;
    padding: 0;
    font-size: 12px;
    color: var(--md-titlebar-fg);
    z-index: 1000;
    -webkit-app-region: drag;
  }

  .titlebar-row {
    display: flex;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
  }

  .titlebar-row.top-row {
    height: 32px;
    padding: 0 4px 0 14px;
    border-bottom: 1px dashed var(--md-titlebar-border);
    -webkit-app-region: drag;
  }

  .titlebar-row.bottom-row {
    height: 27px;
    padding: 0 12px;
    -webkit-app-region: no-drag;
  }

  .titlebar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
  }

  .app-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--md-editor-accent, #2f7d6f), var(--md-editor-accent-strong, #174e45));
    color: #ffffff;
    font-weight: 800;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    font-size: 11px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  .app-name {
    font-size: 11px;
    letter-spacing: 0.5px;
    opacity: 0.85;
  }

  .titlebar-menu {
    display: flex;
    align-items: center;
    -webkit-app-region: no-drag;
  }

  .menu-item {
    position: relative;
  }

  .menu-btn {
    background: transparent;
    border: none;
    padding: 2px 8px;
    font-size: 11.5px;
    color: inherit;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, color 0.15s;
  }

  .menu-btn:hover, .menu-item.active .menu-btn {
    background: rgba(128, 128, 128, 0.15);
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: var(--md-dropdown-bg);
    border: 1px solid var(--md-dropdown-border);
    box-shadow: var(--md-editor-shadow);
    border-radius: 6px;
    padding: 4px 0;
    min-width: 185px;
    z-index: 1000;
    backdrop-filter: blur(12px);
    display: flex;
    flex-direction: column;
  }

  .dropdown-menu button, .dropdown-menu .nested-trigger {
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    padding: 6px 16px;
    font-size: 12px;
    color: var(--md-editor-fg);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: background 0.1s, color 0.1s;
    font-family: inherit;
    -webkit-app-region: no-drag;
  }

  .dropdown-menu button:hover, .dropdown-menu .nested-trigger:hover {
    background: var(--md-editor-accent, #007acc);
    color: #ffffff !important;
  }

  .dropdown-menu .divider {
    height: 1px;
    background: var(--md-dropdown-border);
    margin: 4px 0;
  }

  .shortcut {
    font-size: 10.5px;
    color: var(--md-editor-muted-fg, #888888);
    margin-left: 24px;
  }

  .dropdown-menu button:hover .shortcut, .dropdown-menu .nested-trigger:hover :global(svg) {
    color: rgba(255, 255, 255, 0.8) !important;
  }

  .nested-trigger {
    position: relative;
    user-select: none;
  }

  .nested-trigger :global(svg) {
    color: var(--md-editor-muted-fg);
  }

  .dropdown-menu.nested {
    position: absolute;
    top: -4px;
    left: 100%;
    margin-left: 2px;
    display: none;
  }

  .nested-trigger:hover .dropdown-menu.nested {
    display: flex;
  }

  .disabled-item {
    font-size: 12px;
    color: var(--md-editor-muted-fg);
    padding: 6px 16px;
    font-style: italic;
  }

  .titlebar-spacer {
    flex: 1;
    height: 100%;
  }

  .titlebar-right {
    display: flex;
    align-items: center;
    height: 100%;
    -webkit-app-region: no-drag;
  }

  .titlebar-right .icon-btn {
    background: transparent;
    border: none;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    cursor: pointer;
    color: inherit;
    transition: background 0.15s;
    margin-right: 4px;
  }

  .titlebar-right .icon-btn:hover {
    background: rgba(128, 128, 128, 0.15);
  }

  .window-controls {
    display: flex;
    height: 100%;
    align-items: center;
    -webkit-app-region: no-drag;
  }

  .control-btn {
    background: transparent;
    border: none;
    width: 46px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    -webkit-app-region: no-drag;
    pointer-events: auto;
  }

  .control-btn:hover {
    background: rgba(128, 128, 128, 0.15);
  }

  .control-btn.close:hover {
    background: #e81123 !important;
    color: #ffffff !important;
  }

  /* Chevron指示标旋转微动效 */
  .chevron-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    height: 12px;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    margin-right: 4px;
    color: var(--md-editor-muted-fg);
  }

  .tree-folder.collapsed .chevron-icon,
  .tree-folder-root-title.collapsed .chevron-icon {
    transform: rotate(-90deg);
  }

  /* 嵌套文件树样式打磨 */
  .tree-folder-root-title {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    margin: 1px 0;
    padding: 4px 12px;
    border: none;
    background: transparent;
    text-align: left;
    font-family: inherit;
    font-weight: 600;
    font-size: 12px;
    color: var(--md-editor-muted-fg);
    letter-spacing: 0.3px;
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
    border-radius: 4px;
    box-sizing: border-box;
  }

  .tree-folder-root-title:hover {
    background-color: rgba(128, 128, 128, 0.08);
    color: var(--md-editor-fg);
  }

  .tree-folder-root-title :global(svg) {
    color: var(--md-editor-accent, #007acc);
  }

  .recursive-tree-container {
    display: flex;
    flex-direction: column;
    padding: 2px 0;
  }

  .tree-folder-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .tree-folder.nested-dir {
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    font-size: 12px;
    color: var(--md-editor-fg);
    cursor: pointer;
    border-radius: 4px;
    margin: 1px 0;
    transition: background 0.15s;
    font-family: inherit;
    min-width: 0;
    box-sizing: border-box;
  }

  .tree-folder.nested-dir:hover {
    background: rgba(128, 128, 128, 0.08);
  }

  .tree-folder.nested-dir :global(svg) {
    color: var(--md-editor-muted-fg);
    flex-shrink: 0;
  }

  .tree-folder.nested-dir :global(svg:first-child) {
    opacity: 0.75;
    transition: transform 0.2s;
  }

  /* 嵌套树中文件高亮与微调 */
  .file-tree button.tree-file {
    margin: 1px 0 1px 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
    text-align: left;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--md-editor-fg);
    font-family: inherit;
    font-size: 12px;
    padding: 4px 12px;
    width: calc(100% - 8px);
    transition: background 0.15s, color 0.15s;
    min-width: 0;
    box-sizing: border-box;
  }

  .file-tree button.tree-file:hover {
    background: rgba(128, 128, 128, 0.08);
  }

  .file-tree button.tree-file.active {
    background: rgba(0, 122, 204, 0.12) !important;
    color: var(--md-editor-accent, #007acc) !important;
    font-weight: 500;
  }

  .file-tree button.tree-file.active :global(svg) {
    color: var(--md-editor-accent, #007acc) !important;
  }

  .file-tree button.tree-file :global(svg) {
    color: var(--md-editor-muted-fg);
    flex-shrink: 0;
  }

  /* 夜晚模式左侧侧边栏修正 */
  :global([data-theme="dark"]) .rail {
    background: #1e1e1e !important;
    border-right-color: #2e2e2e !important;
  }

  .topbar-spacer {
    flex: 1;
  }

  .theme-toggle-btn {
    background: transparent;
    border: none;
    color: var(--md-editor-fg);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    margin-right: 8px;
    transition: background 0.2s;
  }

  .theme-toggle-btn:hover {
    background: rgba(128, 128, 128, 0.15);
  }
</style>
