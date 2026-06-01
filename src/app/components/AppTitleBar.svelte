<script lang="ts">
  import { Moon, Sun } from '@lucide/svelte';
  import type { RecentDocument } from '../../lib/desktop/tauriStorage';
  import type { EditorCommand, EditorMode } from '../../lib/editor-core';
  import { clickOutside } from '../actions/clickOutside';

  export let theme: 'light' | 'dark';
  export let desktopEnabled: boolean;
  export let activeMenu: string | null;
  export let recentFiles: RecentDocument[];
  export let mode: EditorMode;
  export let getCompactPath: (path: string) => string;
  export let toggleMenu: (menu: string) => void;
  export let closeMenu: (menu: string) => void;
  export let toggleTheme: () => void;
  export let minimizeWindow: () => void;
  export let maximizeWindow: () => void;
  export let closeAppWindow: () => void;
  export let createNewWindow: () => void;
  export let createNewFile: () => void;
  export let openFileDialog: () => void;
  export let openFolderDialog: () => void;
  export let openRecentFile: (path: string) => void;
  export let saveMarkdownFile: (saveAs?: boolean) => void;
  export let runCommand: (command: EditorCommand) => void;
  export let setMode: (mode: EditorMode) => void;
  export let toggleOutlineVisible: () => void;
  export let outlineVisible: boolean;
  export let toggleFocusMode: () => void;

  function finish(action: () => void, menu: string) {
    action();
    closeMenu(menu);
  }
</script>

<header class="titlebar" data-tauri-drag-region>
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

  <div class="titlebar-row bottom-row">
    <nav class="titlebar-menu">
      <div class="menu-item" class:active={activeMenu === 'file'} use:clickOutside={() => closeMenu('file')}>
        <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('file')}>文件</button>
        {#if activeMenu === 'file'}
          <div class="dropdown-menu">
            <button on:click={() => finish(createNewFile, 'file')}>新建 <span class="shortcut">Ctrl+N</span></button>
            <button on:click={() => finish(createNewWindow, 'file')}>新建窗口 <span class="shortcut">Ctrl+Shift+N</span></button>
            <button on:click={() => finish(openFileDialog, 'file')}>打开... <span class="shortcut">Ctrl+O</span></button>
            <button on:click={() => finish(openFolderDialog, 'file')}>打开文件夹... <span class="shortcut">Ctrl+Shift+O</span></button>

            <div class="nested-trigger">
              <span>打开最近</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"><path d="M3 1l4 4-4 4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div class="dropdown-menu nested">
                {#each recentFiles.slice(0, 8) as recent}
                  <button on:click={() => finish(() => openRecentFile(recent.path), 'file')}>
                    {recent.title ?? getCompactPath(recent.path)}
                  </button>
                {/each}
                {#if recentFiles.length === 0}
                  <span class="disabled-item">无最近打开的文件</span>
                {/if}
              </div>
            </div>

            <div class="divider"></div>
            <button on:click={() => finish(() => saveMarkdownFile(), 'file')}>保存 <span class="shortcut">Ctrl+S</span></button>
            <button on:click={() => finish(() => saveMarkdownFile(true), 'file')}>另存为... <span class="shortcut">Ctrl+Shift+S</span></button>
            <div class="divider"></div>
            <button on:click={() => finish(closeAppWindow, 'file')}>退出 <span class="shortcut">Alt+F4</span></button>
          </div>
        {/if}
      </div>

      <div class="menu-item" class:active={activeMenu === 'edit'} use:clickOutside={() => closeMenu('edit')}>
        <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('edit')}>编辑</button>
        {#if activeMenu === 'edit'}
          <div class="dropdown-menu">
            <button on:click={() => finish(() => runCommand({ type: 'undo' }), 'edit')}>撤销 <span class="shortcut">Ctrl+Z</span></button>
            <button on:click={() => finish(() => runCommand({ type: 'redo' }), 'edit')}>重做 <span class="shortcut">Ctrl+Y</span></button>
          </div>
        {/if}
      </div>

      <div class="menu-item" class:active={activeMenu === 'paragraph'} use:clickOutside={() => closeMenu('paragraph')}>
        <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('paragraph')}>段落</button>
        {#if activeMenu === 'paragraph'}
          <div class="dropdown-menu">
            <button on:click={() => finish(() => runCommand({ type: 'setHeading', level: 1 }), 'paragraph')}>一级标题 <span class="shortcut">Ctrl+1</span></button>
            <button on:click={() => finish(() => runCommand({ type: 'setHeading', level: 2 }), 'paragraph')}>二级标题 <span class="shortcut">Ctrl+2</span></button>
            <button on:click={() => finish(() => runCommand({ type: 'setHeading', level: 3 }), 'paragraph')}>三级标题 <span class="shortcut">Ctrl+3</span></button>
            <button on:click={() => finish(() => runCommand({ type: 'setHeading', level: 4 }), 'paragraph')}>四级标题 <span class="shortcut">Ctrl+4</span></button>
            <button on:click={() => finish(() => runCommand({ type: 'setHeading', level: 5 }), 'paragraph')}>五级标题 <span class="shortcut">Ctrl+5</span></button>
            <button on:click={() => finish(() => runCommand({ type: 'setHeading', level: 6 }), 'paragraph')}>六级标题 <span class="shortcut">Ctrl+6</span></button>
            <button on:click={() => finish(() => runCommand({ type: 'setParagraph' }), 'paragraph')}>正文 <span class="shortcut">Ctrl+0</span></button>
          </div>
        {/if}
      </div>

      <div class="menu-item" class:active={activeMenu === 'format'} use:clickOutside={() => closeMenu('format')}>
        <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('format')}>格式</button>
        {#if activeMenu === 'format'}
          <div class="dropdown-menu">
            <button on:click={() => finish(() => runCommand({ type: 'toggleBold' }), 'format')}>粗体 <span class="shortcut">Ctrl+B</span></button>
            <button on:click={() => finish(() => runCommand({ type: 'toggleItalic' }), 'format')}>斜体 <span class="shortcut">Ctrl+I</span></button>
            <button on:click={() => finish(() => runCommand({ type: 'toggleBlockquote' }), 'format')}>引用块</button>
            <button on:click={() => finish(() => runCommand({ type: 'toggleBulletList' }), 'format')}>无序列表</button>
            <button on:click={() => finish(() => runCommand({ type: 'toggleTaskList' }), 'format')}>任务列表</button>
          </div>
        {/if}
      </div>

      <div class="menu-item" class:active={activeMenu === 'view'} use:clickOutside={() => closeMenu('view')}>
        <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('view')}>查看</button>
        {#if activeMenu === 'view'}
          <div class="dropdown-menu">
            <button on:click={() => finish(() => setMode(mode === 'source' ? 'semantic' : 'source'), 'view')}>切换源码模式 <span class="shortcut">Ctrl+E</span></button>
            <button on:click={() => finish(toggleOutlineVisible, 'view')}>{outlineVisible ? '隐藏文档大纲' : '显示文档大纲'}</button>
            <button on:click={() => finish(toggleTheme, 'view')}>切换主题 <span class="shortcut">Ctrl+Shift+L</span></button>
            <button on:click={() => finish(toggleFocusMode, 'view')}>切换专注模式 <span class="shortcut">Ctrl+Shift+F</span></button>
          </div>
        {/if}
      </div>
    </nav>
  </div>
</header>
