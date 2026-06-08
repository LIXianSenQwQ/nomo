<script lang="ts">
  import { onMount } from 'svelte';
  import { Moon, PanelLeftClose, PanelLeftOpen, Sun } from '@lucide/svelte';
  import type { RecentEntry } from '../../lib/desktop/tauriStorage';
  import {
    DIAGRAM_TEMPLATES,
    type DiagramType,
    type EditorCommand,
    type EditorMode,
  } from '../../lib/editor-core';
  import { clickOutside } from '../actions/clickOutside';
  import { getPlatformCapabilities } from '../services/platform';

  export let theme: 'light' | 'dark';
  export let desktopEnabled: boolean;
  export let activeMenu: string | null;
  export let recentFiles: RecentEntry[];
  export let missingRecentPaths: Set<string>;
  export let mode: EditorMode;
  export let focusMode: boolean;
  export let getCompactPath: (path: string) => string;
  export let toggleMenu: (menu: string) => void;
  export let closeMenu: (menu: string) => void;
  export let toggleTheme: () => void;
  export let minimizeWindow: () => void;
  export let maximizeWindow: () => void;
  export let closeAppWindow: () => void;
  export let exitApp: () => void;
  export let createNewWindow: () => void;
  export let createNewFile: () => void;
  export let openFileDialog: () => void;
  export let openFolderDialog: () => void;
  export let openRecentEntry: (path: string, entryType: 'file' | 'folder') => void;
  export let saveMarkdownFile: (saveAs?: boolean) => void;
  export let clearRecentEntriesList: () => void;
  export let removeRecentEntry: (path: string) => void;
  export let closeCurrentFile: () => void;
  export let closeCurrentWindow: () => void;
  export let runCommand: (command: EditorCommand) => void;
  export let openTablePicker: () => void;
  export let openLinkPicker: () => void;
  export let editFrontMatter: () => void;
  export let showUnavailableFeature: (featureName: string) => void;
  export let setMode: (mode: EditorMode) => void;
  export let toggleOutlineVisible: () => void;
  export let outlineVisible: boolean;
  export let toggleFocusMode: () => void;
  export let openSettings: () => void;

  let platformCapabilities = getPlatformCapabilities();
  let isFullscreen = false;
  let isMaximized = false;
  let unlistenResized: (() => void) | null = null;
  let canSyncWindowState = false;
  let windowStateListenerReady = false;

  async function syncWindowState() {
    if (!desktopEnabled || !canSyncWindowState) {
      return;
    }

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      const [fullscreen, maximized] = await Promise.all([
        appWindow.isFullscreen(),
        appWindow.isMaximized(),
      ]);

      if (canSyncWindowState) {
        isFullscreen = fullscreen;
        isMaximized = maximized;
      }
    } catch {
      // ignore
    }
  }

  async function setupWindowStateListener() {
    if (!desktopEnabled || !canSyncWindowState || windowStateListenerReady) {
      return;
    }

    windowStateListenerReady = true;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      if (!canSyncWindowState) return;

      const appWindow = getCurrentWindow();
      await syncWindowState();
      const unlisten = await appWindow.onResized(syncWindowState);

      if (canSyncWindowState) {
        unlistenResized = unlisten;
      } else {
        unlisten();
      }
    } catch {
      windowStateListenerReady = false;
    }
  }

  $: void setupWindowStateListener();

  onMount(() => {
    platformCapabilities = getPlatformCapabilities();
    canSyncWindowState = true;
    void setupWindowStateListener();

    return () => {
      canSyncWindowState = false;
      if (unlistenResized) {
        unlistenResized();
        unlistenResized = null;
      }
      windowStateListenerReady = false;
    };
  });

  async function handleDrag(e: MouseEvent) {
    if (!desktopEnabled || e.buttons !== 1) {
      return;
    }

    const target = e.target as HTMLElement;

    // 排除交互元素，避免影响按钮点击
    if (
      target.closest('button') ||
      target.closest('.titlebar-right') ||
      target.closest('.titlebar-menu')
    ) {
      return;
    }

    // 只在拖动区域触发
    if (!target.closest('[data-drag-region]')) {
      return;
    }

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();

      if (e.detail === 2) {
        // 双击最大化/还原
        await appWindow.toggleMaximize();
        await syncWindowState();
      } else {
        await appWindow.startDragging();
      }
    } catch {
      // ignore
    }
  }

  function finish(action: () => void, menu: string) {
    action();
    closeMenu(menu);
  }

  function comingSoon(featureName: string, menu: string) {
    showUnavailableFeature(featureName);
    closeMenu(menu);
  }

  function insertBlankDiagram(menu: string) {
    runCommand({ type: 'insertMermaidBlock' });
    closeMenu(menu);
  }

  function insertDiagram(diagramType: DiagramType, menu: string) {
    runCommand({ type: 'insertDiagramBlock', diagramType });
    closeMenu(menu);
  }

  async function handleMaximizeWindow() {
    await Promise.resolve(maximizeWindow());
    await syncWindowState();
  }
</script>

<header
  class="titlebar"
  class:is-mac={platformCapabilities.isMac}
  class:is-win={platformCapabilities.isWindows}
  class:is-fullscreen={isFullscreen}
>
  <div class="titlebar-row top-row" data-drag-region role="presentation" on:mousedown={handleDrag}>
    <button
      class="icon-btn sidebar-toggle-btn"
      title={focusMode ? '显示资源管理器侧边栏' : '隐藏资源管理器侧边栏'}
      aria-label={focusMode ? '显示资源管理器侧边栏' : '隐藏资源管理器侧边栏'}
      aria-pressed={!focusMode}
      on:click={toggleFocusMode}
    >
      {#if focusMode}
        <PanelLeftOpen size={16} />
      {:else}
        <PanelLeftClose size={16} />
      {/if}
    </button>

    <div class="titlebar-left" data-drag-region>
      <span class="app-name" data-drag-region>Nomo</span>
    </div>

    <nav class="titlebar-menu">
      <div
        class="menu-item"
        class:active={activeMenu === 'file'}
        use:clickOutside={() => closeMenu('file')}
      >
        <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('file')}>文件</button>
        {#if activeMenu === 'file'}
          <div class="dropdown-menu">
            <button on:click={() => finish(createNewFile, 'file')}
              >新建 Markdown <span class="shortcut">Ctrl + N</span></button
            >
            <button on:click={() => finish(createNewWindow, 'file')}
              >新建窗口 <span class="shortcut">Ctrl + Shift + N</span></button
            >
            <div class="divider"></div>
            <button on:click={() => finish(openFileDialog, 'file')}
              >打开文件... <span class="shortcut">Ctrl + O</span></button
            >
            <button on:click={() => finish(openFolderDialog, 'file')}
              >打开文件夹... <span class="shortcut">Ctrl + Shift + O</span></button
            >

            <div class="nested-trigger">
              <span>打开最近</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
                ><path
                  d="M3 1l4 4-4 4"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                /></svg
              >
              <div class="dropdown-menu nested recent-submenu">
                {#each recentFiles.slice(0, 10) as recent}
                  {@const isMissing = missingRecentPaths.has(recent.path)}
                  <button
                    class="recent-entry"
                    class:recent-folder={recent.entryType === 'folder'}
                    class:recent-missing={isMissing}
                    disabled={isMissing}
                    title={isMissing ? `${recent.path}（路径已失效，点击移除）` : recent.path}
                    on:click={() =>
                      isMissing
                        ? finish(() => removeRecentEntry(recent.path), 'file')
                        : finish(() => openRecentEntry(recent.path, recent.entryType), 'file')}
                  >
                    <span class="recent-icon">
                      {#if recent.entryType === 'folder'}
                        📁
                      {:else}
                        📄
                      {/if}
                    </span>
                    <span class="recent-label">
                      {recent.title ?? getCompactPath(recent.path)}
                    </span>
                  </button>
                {/each}
                {#if recentFiles.length === 0}
                  <span class="disabled-item">无最近打开的记录</span>
                {/if}
                {#if recentFiles.length > 0}
                  <div class="divider"></div>
                  <button
                    class="recent-clear"
                    on:click={() => finish(clearRecentEntriesList, 'file')}
                  >
                    清除最近打开
                  </button>
                {/if}
              </div>
            </div>

            <div class="divider"></div>
            <button on:click={() => finish(() => saveMarkdownFile(), 'file')}
              >保存 <span class="shortcut">Ctrl + S</span></button
            >
            <button on:click={() => finish(() => saveMarkdownFile(true), 'file')}
              >另存为... <span class="shortcut">Ctrl + Shift + S</span></button
            >
            <div class="divider"></div>
            <button on:click={() => finish(closeCurrentFile, 'file')}
              >关闭当前文件 <span class="shortcut">Ctrl + W</span></button
            >
            <button on:click={() => finish(closeCurrentWindow, 'file')}
              >关闭窗口 <span class="shortcut">Alt + F4</span></button
            >
            <div class="divider"></div>
            <button on:click={() => finish(exitApp, 'file')}>退出</button>
          </div>
        {/if}
      </div>

      <div
        class="menu-item"
        class:active={activeMenu === 'edit'}
        use:clickOutside={() => closeMenu('edit')}
      >
        <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('edit')}>编辑</button>
        {#if activeMenu === 'edit'}
          <div class="dropdown-menu">
            <button on:click={() => finish(() => runCommand({ type: 'undo' }), 'edit')}
              >撤销 <span class="shortcut">Ctrl + Z</span></button
            >
            <button on:click={() => finish(() => runCommand({ type: 'redo' }), 'edit')}
              >重做 <span class="shortcut">Ctrl + Y</span></button
            >
          </div>
        {/if}
      </div>

      <div
        class="menu-item"
        class:active={activeMenu === 'paragraph'}
        use:clickOutside={() => closeMenu('paragraph')}
      >
        <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('paragraph')}
          >段落</button
        >
        {#if activeMenu === 'paragraph'}
          <div class="dropdown-menu">
            <div class="nested-trigger">
              <span>标题</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
                ><path
                  d="M3 1l4 4-4 4"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                /></svg
              >
              <div class="dropdown-menu nested">
                <button
                  on:mousedown|preventDefault
                  on:click={() =>
                    finish(() => runCommand({ type: 'setHeading', level: 1 }), 'paragraph')}
                  >一级标题 <span class="shortcut">Ctrl + 1</span></button
                >
                <button
                  on:mousedown|preventDefault
                  on:click={() =>
                    finish(() => runCommand({ type: 'setHeading', level: 2 }), 'paragraph')}
                  >二级标题 <span class="shortcut">Ctrl + 2</span></button
                >
                <button
                  on:mousedown|preventDefault
                  on:click={() =>
                    finish(() => runCommand({ type: 'setHeading', level: 3 }), 'paragraph')}
                  >三级标题 <span class="shortcut">Ctrl + 3</span></button
                >
                <button
                  on:mousedown|preventDefault
                  on:click={() =>
                    finish(() => runCommand({ type: 'setHeading', level: 4 }), 'paragraph')}
                  >四级标题 <span class="shortcut">Ctrl + 4</span></button
                >
                <button
                  on:mousedown|preventDefault
                  on:click={() =>
                    finish(() => runCommand({ type: 'setHeading', level: 5 }), 'paragraph')}
                  >五级标题 <span class="shortcut">Ctrl + 5</span></button
                >
                <button
                  on:mousedown|preventDefault
                  on:click={() =>
                    finish(() => runCommand({ type: 'setHeading', level: 6 }), 'paragraph')}
                  >六级标题 <span class="shortcut">Ctrl + 6</span></button
                >
              </div>
            </div>
            <button
              on:mousedown|preventDefault
              on:click={() => finish(() => runCommand({ type: 'setParagraph' }), 'paragraph')}
              >段落 <span class="shortcut">Ctrl + 0</span></button
            >
            <button
              on:mousedown|preventDefault
              on:click={() =>
                finish(() => runCommand({ type: 'increaseHeadingLevel' }), 'paragraph')}
              >提升标题 <span class="shortcut">Ctrl + =</span></button
            >
            <button
              on:mousedown|preventDefault
              on:click={() =>
                finish(() => runCommand({ type: 'decreaseHeadingLevel' }), 'paragraph')}
              >降低标题 <span class="shortcut">Ctrl + -</span></button
            >
            <div class="divider"></div>
            <button on:click={() => finish(openTablePicker, 'paragraph')}
              >表格 <span class="shortcut">Ctrl + Shift + T</span></button
            >
            <button
              on:click={() =>
                finish(() => runCommand({ type: 'insertCodeBlock', language: 'ts' }), 'paragraph')}
              >代码块 <span class="shortcut">Ctrl + Shift + K</span></button
            >
            <button
              on:click={() =>
                finish(() => runCommand({ type: 'insertMathBlock', tex: '' }), 'paragraph')}
              >公式块 <span class="shortcut">Ctrl + Shift + M</span></button
            >
            <div class="divider"></div>
            <button
              on:click={() => finish(() => runCommand({ type: 'toggleBlockquote' }), 'paragraph')}
              >引用 <span class="shortcut">Ctrl + Shift + Q</span></button
            >
            <button
              on:click={() => finish(() => runCommand({ type: 'insertCallout' }), 'paragraph')}
              >提示块 <span class="shortcut">Ctrl + Shift + A</span></button
            >
            <button
              on:click={() => finish(() => runCommand({ type: 'insertCommentBlock' }), 'paragraph')}
              >注释块</button
            >
            <button
              on:click={() => finish(() => runCommand({ type: 'toggleOrderedList' }), 'paragraph')}
              >有序列表 <span class="shortcut">Ctrl + Shift + [</span></button
            >
            <button
              on:click={() => finish(() => runCommand({ type: 'toggleBulletList' }), 'paragraph')}
              >无序列表 <span class="shortcut">Ctrl + Shift + ]</span></button
            >
            <button
              on:click={() => finish(() => runCommand({ type: 'toggleTaskList' }), 'paragraph')}
              >任务列表 <span class="shortcut">Ctrl + Shift + X</span></button
            >
            <div class="divider"></div>
            <button on:click={() => comingSoon('在上方插入段落', 'paragraph')}
              >上插段落 <span class="shortcut">Ctrl + Shift + Enter</span></button
            >
            <button on:click={() => comingSoon('在下方插入段落', 'paragraph')}
              >下插段落 <span class="shortcut">Ctrl + Enter</span></button
            >
            <div class="divider"></div>
            <div class="nested-trigger">
              <span>图表</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
                ><path
                  d="M3 1l4 4-4 4"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                /></svg
              >
              <div class="dropdown-menu nested">
                <button on:click={() => insertBlankDiagram('paragraph')}>
                  空白图表 <span class="shortcut">mermaid</span>
                </button>
                <div class="divider"></div>
                {#each DIAGRAM_TEMPLATES as template}
                  <button on:click={() => insertDiagram(template.type, 'paragraph')}>
                    {template.label} <span class="shortcut">{template.type}</span>
                  </button>
                {/each}
              </div>
            </div>
            <button
              on:click={() => finish(() => runCommand({ type: 'insertFootnote' }), 'paragraph')}
              >脚注</button
            >
            <button
              on:click={() =>
                finish(() => runCommand({ type: 'insertHorizontalRule' }), 'paragraph')}
              >水平分割线 <span class="shortcut">Ctrl + Shift + H</span></button
            >
            <button on:click={() => finish(() => runCommand({ type: 'insertToc' }), 'paragraph')}
              >正文目录</button
            >
            <button on:click={() => finish(editFrontMatter, 'paragraph')}>文档元数据</button>
          </div>
        {/if}
      </div>

      <div
        class="menu-item"
        class:active={activeMenu === 'format'}
        use:clickOutside={() => closeMenu('format')}
      >
        <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('format')}>格式</button>
        {#if activeMenu === 'format'}
          <div class="dropdown-menu">
            <button on:click={() => finish(() => runCommand({ type: 'toggleBold' }), 'format')}
              >加粗 <span class="shortcut">Ctrl + B</span></button
            >
            <button on:click={() => finish(() => runCommand({ type: 'toggleItalic' }), 'format')}
              >斜体 <span class="shortcut">Ctrl + I</span></button
            >
            <button on:click={() => finish(() => runCommand({ type: 'toggleUnderline' }), 'format')}
              >下划线 <span class="shortcut">Ctrl + U</span></button
            >
            <button on:click={() => finish(() => runCommand({ type: 'toggleCode' }), 'format')}
              >行代码 <span class="shortcut">Ctrl + `</span></button
            >
            <button on:click={() => comingSoon('行公式', 'format')}>行公式</button>
            <div class="divider"></div>
            <button
              on:click={() => finish(() => runCommand({ type: 'toggleStrikethrough' }), 'format')}
              >删除线 <span class="shortcut">Alt + Shift + 5</span></button
            >
            <button on:click={() => finish(() => runCommand({ type: 'toggleHighlight' }), 'format')}
              >高亮</button
            >
            <button
              on:click={() => finish(() => runCommand({ type: 'insertCommentInline' }), 'format')}
              >注释</button
            >
            <div class="divider"></div>
            <button on:click={() => finish(openLinkPicker, 'format')}
              >超链接 <span class="shortcut">Ctrl + K</span></button
            >
            <button on:click={() => comingSoon('图像', 'format')}>图像</button>
            <div class="divider"></div>
            <button
              on:click={() => finish(() => runCommand({ type: 'clearInlineStyles' }), 'format')}
              >清除样式 <span class="shortcut">Ctrl + \</span></button
            >
          </div>
        {/if}
      </div>

      <div
        class="menu-item"
        class:active={activeMenu === 'view'}
        use:clickOutside={() => closeMenu('view')}
      >
        <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('view')}>查看</button>
        {#if activeMenu === 'view'}
          <div class="dropdown-menu">
            <button
              on:click={() =>
                finish(() => setMode(mode === 'source' ? 'semantic' : 'source'), 'view')}
              >切换源码模式 <span class="shortcut">Ctrl + E</span></button
            >
            <button on:click={() => finish(toggleOutlineVisible, 'view')}
              >{outlineVisible ? '隐藏文档大纲' : '显示文档大纲'}</button
            >
            <button on:click={() => finish(toggleTheme, 'view')}
              >切换主题 <span class="shortcut">Ctrl + Shift + L</span></button
            >
            <button on:click={() => finish(toggleFocusMode, 'view')}
              >显示/隐藏资源管理器 <span class="shortcut">Ctrl + Shift + F</span></button
            >
          </div>
        {/if}
      </div>

      <div class="menu-item">
        <button class="menu-btn" on:click|stopPropagation={() => finish(openSettings, 'settings')}
          >设置</button
        >
      </div>
    </nav>

    <span class="titlebar-spacer" data-drag-region></span>
    <div class="titlebar-right">
      <button
        class="icon-btn theme-toggle-icon-btn"
        title="切换主题"
        aria-label="切换主题"
        on:click={toggleTheme}
      >
        {#if theme === 'light'}
          <Moon size={14} />
        {:else}
          <Sun size={14} />
        {/if}
      </button>

      {#if desktopEnabled && platformCapabilities.usesCustomWindowsTitlebar}
        <div class="window-controls">
          <button class="control-btn" title="最小化" aria-label="最小化" on:click={minimizeWindow}>
            <svg width="10" height="1" viewBox="0 0 10 1" aria-hidden="true"
              ><line
                x1="0"
                y1="0.5"
                x2="10"
                y2="0.5"
                stroke="currentColor"
                stroke-width="1.5"
              /></svg
            >
          </button>
          <button
            class="control-btn"
            title={isMaximized ? '还原窗口' : '最大化'}
            aria-label={isMaximized ? '还原窗口' : '最大化'}
            on:click={handleMaximizeWindow}
          >
            {#if isMaximized}
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <rect
                  x="3.5"
                  y="1.5"
                  width="7"
                  height="7"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.1"
                />
                <path
                  d="M1.5 3.5h7v7h-7z"
                  fill="var(--md-titlebar-bg)"
                  stroke="currentColor"
                  stroke-width="1.1"
                />
              </svg>
            {:else}
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"
                ><rect
                  x="0.5"
                  y="0.5"
                  width="9"
                  height="9"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.2"
                /></svg
              >
            {/if}
          </button>
          <button
            class="control-btn close"
            title="关闭"
            aria-label="关闭"
            on:click={closeAppWindow}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"
              ><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.2" /><line
                x1="9"
                y1="1"
                x2="1"
                y2="9"
                stroke="currentColor"
                stroke-width="1.2"
              /></svg
            >
          </button>
        </div>
      {/if}
    </div>
  </div>
</header>
