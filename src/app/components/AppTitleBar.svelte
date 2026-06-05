<script lang="ts">
  import { onMount } from 'svelte';
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
  export let openTablePicker: () => void;
  export let showUnavailableFeature: (featureName: string) => void;
  export let setMode: (mode: EditorMode) => void;
  export let toggleOutlineVisible: () => void;
  export let outlineVisible: boolean;
  export let toggleFocusMode: () => void;
  export let openSettings: () => void;

  let isMac = false;
  let isWin = false;
  let isFullscreen = false;
  let isMaximized = false;
  let unlistenResized: (() => void) | null = null;

  onMount(() => {
    isMac = navigator.userAgent.includes('Mac');
    isWin = navigator.userAgent.includes('Win');
    
    let isDestroyed = false;

    if (desktopEnabled) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        if (isDestroyed) return;
        const appWindow = getCurrentWindow();
        
        // 初始化状态
        appWindow.isFullscreen().then(fullscreen => {
          if (!isDestroyed) isFullscreen = fullscreen;
        });
        appWindow.isMaximized().then(maximized => {
          if (!isDestroyed) isMaximized = maximized;
        });

        // 监听窗口改变事件
        appWindow.onResized(async () => {
          if (!isDestroyed) {
            isFullscreen = await appWindow.isFullscreen();
            // 在 Mac 上双击 topbar 放大其实是 zoom，但原生的红绿灯还在！
            // 所以即使 isMaximized 变成了 true，我们也不应该去掉 80px 的左内边距。
            // 只有 isFullscreen 才会让红绿灯消失。
            isMaximized = await appWindow.isMaximized();
          }
        }).then(unlisten => {
          if (isDestroyed) {
            unlisten();
          } else {
            unlistenResized = unlisten;
          }
        });
      });
    }

    return () => {
      isDestroyed = true;
      if (unlistenResized) {
        unlistenResized();
      }
    };
  });

  async function handleDrag(e: MouseEvent) {
    if (!desktopEnabled || e.buttons !== 1) return;

    const target = e.target as HTMLElement;
    
    // 排除交互元素，避免影响按钮点击
    if (target.closest('button') || target.closest('.titlebar-right') || target.closest('.titlebar-menu')) {
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
      } else {
        await appWindow.startDragging();
      }
    } catch (err) {
      console.error('Failed to start dragging:', err);
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
</script>

<header class="titlebar" class:is-mac={isMac} class:is-win={isWin} class:is-fullscreen={isFullscreen}>
  <div class="titlebar-row top-row" data-drag-region role="presentation" on:mousedown={handleDrag}>
    <div class="titlebar-left" data-drag-region>
      <span class="app-logo">M</span>
      <span class="app-name" data-drag-region>NewMd</span>
    </div>
    <span class="titlebar-spacer" data-drag-region></span>
    <div class="titlebar-right">
      <button class="icon-btn" title="切换主题" on:click={toggleTheme}>
        {#if theme === 'light'}
          <Moon size={14} />
        {:else}
          <Sun size={14} />
        {/if}
      </button>

      {#if desktopEnabled && isWin}
        <div class="window-controls">
          <button class="control-btn" title="最小化" on:click={minimizeWindow}>
            <svg width="10" height="1" viewBox="0 0 10 1"
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
          <button class="control-btn" title="最大化" on:click={maximizeWindow}>
            <svg width="10" height="10" viewBox="0 0 10 10"
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
          </button>
          <button class="control-btn close" title="关闭" on:click={closeAppWindow}>
            <svg width="10" height="10" viewBox="0 0 10 10"
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

  <div class="titlebar-row bottom-row">
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
              >新建 <span class="shortcut">Ctrl + N</span></button
            >
            <button on:click={() => finish(createNewWindow, 'file')}
              >新建窗口 <span class="shortcut">Ctrl + Shift + N</span></button
            >
            <button on:click={() => finish(openFileDialog, 'file')}
              >打开... <span class="shortcut">Ctrl + O</span></button
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
            <button on:click={() => finish(() => saveMarkdownFile(), 'file')}
              >保存 <span class="shortcut">Ctrl + S</span></button
            >
            <button on:click={() => finish(() => saveMarkdownFile(true), 'file')}
              >另存为... <span class="shortcut">Ctrl + Shift + S</span></button
            >
            <div class="divider"></div>
            <button on:click={() => finish(closeAppWindow, 'file')}
              >退出 <span class="shortcut">Alt + F4</span></button
            >
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
                  on:click={() =>
                    finish(() => runCommand({ type: 'setHeading', level: 1 }), 'paragraph')}
                  >一级标题 <span class="shortcut">Ctrl + 1</span></button
                >
                <button
                  on:click={() =>
                    finish(() => runCommand({ type: 'setHeading', level: 2 }), 'paragraph')}
                  >二级标题 <span class="shortcut">Ctrl + 2</span></button
                >
                <button
                  on:click={() =>
                    finish(() => runCommand({ type: 'setHeading', level: 3 }), 'paragraph')}
                  >三级标题 <span class="shortcut">Ctrl + 3</span></button
                >
                <button
                  on:click={() =>
                    finish(() => runCommand({ type: 'setHeading', level: 4 }), 'paragraph')}
                  >四级标题 <span class="shortcut">Ctrl + 4</span></button
                >
                <button
                  on:click={() =>
                    finish(() => runCommand({ type: 'setHeading', level: 5 }), 'paragraph')}
                  >五级标题 <span class="shortcut">Ctrl + 5</span></button
                >
                <button
                  on:click={() =>
                    finish(() => runCommand({ type: 'setHeading', level: 6 }), 'paragraph')}
                  >六级标题 <span class="shortcut">Ctrl + 6</span></button
                >
              </div>
            </div>
            <button on:click={() => finish(() => runCommand({ type: 'setParagraph' }), 'paragraph')}
              >段落 <span class="shortcut">Ctrl + 0</span></button
            >
            <button
              on:click={() => finish(() => runCommand({ type: 'increaseHeadingLevel' }), 'paragraph')}
              >提升标题 <span class="shortcut">Ctrl + =</span></button
            >
            <button
              on:click={() => finish(() => runCommand({ type: 'decreaseHeadingLevel' }), 'paragraph')}
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
              on:click={() =>
                finish(() => runCommand({ type: 'toggleBlockquote' }), 'paragraph')}
              >引用 <span class="shortcut">Ctrl + Shift + Q</span></button
            >
            <button
              on:click={() =>
                finish(() => runCommand({ type: 'insertCallout' }), 'paragraph')}
              >提示块 <span class="shortcut">Ctrl + Shift + A</span></button
            >
            <button
              on:click={() =>
                finish(() => runCommand({ type: 'toggleOrderedList' }), 'paragraph')}
              >有序列表 <span class="shortcut">Ctrl + Shift + [</span></button
            >
            <button
              on:click={() =>
                finish(() => runCommand({ type: 'toggleBulletList' }), 'paragraph')}
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
            <button on:click={() => comingSoon('图表', 'paragraph')}>图表</button>
            <button on:click={() => comingSoon('脚注', 'paragraph')}>脚注</button>
            <button on:click={() => finish(() => runCommand({ type: 'insertHorizontalRule' }), 'paragraph')}
              >水平分割线 <span class="shortcut">Ctrl + Shift + H</span></button
            >
            <button on:click={() => finish(() => runCommand({ type: 'insertToc' }), 'paragraph')}
              >正文目录</button
            >
            <button on:click={() => comingSoon('YAML Front Matter', 'paragraph')}>YAML Front Matter</button>
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
            <button on:click={() => finish(() => runCommand({ type: 'toggleStrikethrough' }), 'format')}
              >删除线 <span class="shortcut">Alt + Shift + 5</span></button
            >
            <button on:click={() => comingSoon('高亮', 'format')}>高亮</button>
            <button on:click={() => comingSoon('注释', 'format')}>注释</button>
            <div class="divider"></div>
            <button on:click={() => comingSoon('超链接', 'format')}
              >超链接 <span class="shortcut">Ctrl + K</span></button
            >
            <button on:click={() => comingSoon('图像', 'format')}>图像</button>
            <div class="divider"></div>
            <button on:click={() => comingSoon('清除样式', 'format')}
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
              >切换专注模式 <span class="shortcut">Ctrl + Shift + F</span></button
            >
          </div>
        {/if}
      </div>

      <div class="menu-item">
        <button class="menu-btn" on:click|stopPropagation={() => finish(openSettings, 'settings')}>设置</button>
      </div>
    </nav>
  </div>
</header>
