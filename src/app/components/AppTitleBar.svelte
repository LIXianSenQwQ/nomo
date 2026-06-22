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
  import { getDiagramTypeLabel, t } from '../i18n';

  export let interfaceLocale: string;
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
  export let exportHtml: () => void;
  export let exportPdf: () => void;

  let platformCapabilities = getPlatformCapabilities();
  let isFullscreen = false;
  let isMaximized = false;
  let unlistenResized: (() => void) | null = null;
  let canSyncWindowState = false;
  let windowStateListenerReady = false;

  $: shouldShowWindowMenu = !platformCapabilities.usesNativeWindowControls;

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

{#key interfaceLocale}
  <header
    class="titlebar"
    data-interface-locale={interfaceLocale}
    class:is-mac={platformCapabilities.isMac}
    class:is-win={platformCapabilities.isWindows}
    class:is-fullscreen={isFullscreen}
  >
    <div
      class="titlebar-row top-row"
      data-drag-region
      role="presentation"
      on:mousedown={handleDrag}
    >
      <button
        class="icon-btn sidebar-toggle-btn"
        title={focusMode ? t.showExplorerSidebar() : t.hideExplorerSidebar()}
        aria-label={focusMode ? t.showExplorerSidebar() : t.hideExplorerSidebar()}
        aria-pressed={!focusMode}
        on:click={toggleFocusMode}
      >
        {#if focusMode}
          <PanelLeftOpen size={16} />
        {:else}
          <PanelLeftClose size={16} />
        {/if}
      </button>

      {#if shouldShowWindowMenu}
        <div class="titlebar-left" data-drag-region>
          <span class="app-name" data-drag-region>Nomo</span>
        </div>

        <nav class="titlebar-menu">
          <div
            class="menu-item"
            class:active={activeMenu === 'file'}
            use:clickOutside={() => closeMenu('file')}
          >
            <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('file')}
              >{t.file()}</button
            >
            {#if activeMenu === 'file'}
              <div class="dropdown-menu">
                <button on:click={() => finish(createNewFile, 'file')}
                  >{t.newMarkdown()} <span class="shortcut">Ctrl + N</span></button
                >
                <button on:click={() => finish(createNewWindow, 'file')}
                  >{t.newWindow()} <span class="shortcut">Ctrl + Shift + N</span></button
                >
                <div class="divider"></div>
                <button on:click={() => finish(openFileDialog, 'file')}
                  >{t.openFileEllipsis()} <span class="shortcut">Ctrl + O</span></button
                >
                <button on:click={() => finish(openFolderDialog, 'file')}
                  >{t.openFolderEllipsis()} <span class="shortcut">Ctrl + Shift + O</span></button
                >

                <div class="nested-trigger">
                  <span>{t.openRecent()}</span>
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
                        title={isMissing
                          ? `${recent.path} (${t.pathInvalidRemove()})`
                          : recent.path}
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
                        <span class="recent-label" data-missing-label={t.unavailableSuffix()}>
                          {recent.title ?? getCompactPath(recent.path)}
                        </span>
                      </button>
                    {/each}
                    {#if recentFiles.length === 0}
                      <span class="disabled-item">{t.noRecentFiles()}</span>
                    {/if}
                    {#if recentFiles.length > 0}
                      <div class="divider"></div>
                      <button
                        class="recent-clear"
                        on:click={() => finish(clearRecentEntriesList, 'file')}
                      >
                        {t.clearRecentFiles()}
                      </button>
                    {/if}
                  </div>
                </div>

                <div class="divider"></div>
                <button on:click={() => finish(() => saveMarkdownFile(), 'file')}
                  >{t.save()} <span class="shortcut">Ctrl + S</span></button
                >
                <button on:click={() => finish(() => saveMarkdownFile(true), 'file')}
                  >{t.saveAs()} <span class="shortcut">Ctrl + Shift + S</span></button
                >
                <div class="divider"></div>
                <button on:click={() => finish(exportHtml, 'file')}>{t.exportHtml()}</button>
                <button on:click={() => finish(exportPdf, 'file')}>{t.exportPdf()}</button>
                <div class="divider"></div>
                <button on:click={() => finish(closeCurrentFile, 'file')}
                  >{t.closeCurrentFile()} <span class="shortcut">Ctrl + W</span></button
                >
                <button on:click={() => finish(closeCurrentWindow, 'file')}
                  >{t.closeWindow()} <span class="shortcut">Alt + F4</span></button
                >
                <div class="divider"></div>
                <button on:click={() => finish(exitApp, 'file')}>{t.quit()}</button>
              </div>
            {/if}
          </div>

          <div
            class="menu-item"
            class:active={activeMenu === 'edit'}
            use:clickOutside={() => closeMenu('edit')}
          >
            <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('edit')}
              >{t.editMenu()}</button
            >
            {#if activeMenu === 'edit'}
              <div class="dropdown-menu">
                <button on:click={() => finish(() => runCommand({ type: 'undo' }), 'edit')}
                  >{t.undo()} <span class="shortcut">Ctrl + Z</span></button
                >
                <button on:click={() => finish(() => runCommand({ type: 'redo' }), 'edit')}
                  >{t.redo()} <span class="shortcut">Ctrl + Y</span></button
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
              >{t.paragraph()}</button
            >
            {#if activeMenu === 'paragraph'}
              <div class="dropdown-menu">
                <div class="nested-trigger">
                  <span>{t.heading()}</span>
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
                      >{t.heading1()} <span class="shortcut">Ctrl + 1</span></button
                    >
                    <button
                      on:mousedown|preventDefault
                      on:click={() =>
                        finish(() => runCommand({ type: 'setHeading', level: 2 }), 'paragraph')}
                      >{t.heading2()} <span class="shortcut">Ctrl + 2</span></button
                    >
                    <button
                      on:mousedown|preventDefault
                      on:click={() =>
                        finish(() => runCommand({ type: 'setHeading', level: 3 }), 'paragraph')}
                      >{t.heading3()} <span class="shortcut">Ctrl + 3</span></button
                    >
                    <button
                      on:mousedown|preventDefault
                      on:click={() =>
                        finish(() => runCommand({ type: 'setHeading', level: 4 }), 'paragraph')}
                      >{t.heading4()} <span class="shortcut">Ctrl + 4</span></button
                    >
                    <button
                      on:mousedown|preventDefault
                      on:click={() =>
                        finish(() => runCommand({ type: 'setHeading', level: 5 }), 'paragraph')}
                      >{t.heading5()} <span class="shortcut">Ctrl + 5</span></button
                    >
                    <button
                      on:mousedown|preventDefault
                      on:click={() =>
                        finish(() => runCommand({ type: 'setHeading', level: 6 }), 'paragraph')}
                      >{t.heading6()} <span class="shortcut">Ctrl + 6</span></button
                    >
                  </div>
                </div>
                <button
                  on:mousedown|preventDefault
                  on:click={() => finish(() => runCommand({ type: 'setParagraph' }), 'paragraph')}
                  >{t.paragraph()} <span class="shortcut">Ctrl + 0</span></button
                >
                <button
                  on:mousedown|preventDefault
                  on:click={() =>
                    finish(() => runCommand({ type: 'increaseHeadingLevel' }), 'paragraph')}
                  >{t.liftHeading()} <span class="shortcut">Ctrl + =</span></button
                >
                <button
                  on:mousedown|preventDefault
                  on:click={() =>
                    finish(() => runCommand({ type: 'decreaseHeadingLevel' }), 'paragraph')}
                  >{t.sinkHeading()} <span class="shortcut">Ctrl + -</span></button
                >
                <div class="divider"></div>
                <button on:click={() => finish(openTablePicker, 'paragraph')}
                  >{t.table()} <span class="shortcut">Ctrl + Shift + T</span></button
                >
                <button
                  on:click={() =>
                    finish(
                      () => runCommand({ type: 'insertCodeBlock', language: 'ts' }),
                      'paragraph',
                    )}>{t.codeBlock()} <span class="shortcut">Ctrl + Shift + K</span></button
                >
                <button
                  on:click={() =>
                    finish(() => runCommand({ type: 'insertMathBlock', tex: '' }), 'paragraph')}
                  >{t.insertMathBlock()} <span class="shortcut">Ctrl + Shift + M</span></button
                >
                <div class="divider"></div>
                <button
                  on:click={() =>
                    finish(() => runCommand({ type: 'toggleBlockquote' }), 'paragraph')}
                  >{t.quote()} <span class="shortcut">Ctrl + Shift + Q</span></button
                >
                <button
                  on:click={() => finish(() => runCommand({ type: 'insertCallout' }), 'paragraph')}
                  >{t.callout()} <span class="shortcut">Ctrl + Shift + A</span></button
                >
                <button
                  on:click={() =>
                    finish(() => runCommand({ type: 'insertCommentBlock' }), 'paragraph')}
                  >{t.inlineComment()}</button
                >
                <button
                  on:click={() =>
                    finish(() => runCommand({ type: 'toggleOrderedList' }), 'paragraph')}
                  >{t.orderedList()} <span class="shortcut">Ctrl + Shift + [</span></button
                >
                <button
                  on:click={() =>
                    finish(() => runCommand({ type: 'toggleBulletList' }), 'paragraph')}
                  >{t.unorderedList()} <span class="shortcut">Ctrl + Shift + ]</span></button
                >
                <button
                  on:click={() => finish(() => runCommand({ type: 'toggleTaskList' }), 'paragraph')}
                  >{t.taskList()} <span class="shortcut">Ctrl + Shift + X</span></button
                >
                <div class="divider"></div>
                <button on:click={() => comingSoon(t.insertParagraphBefore(), 'paragraph')}
                  >{t.paragraphBefore()} <span class="shortcut">Ctrl + Shift + Enter</span></button
                >
                <button on:click={() => comingSoon(t.insertParagraphAfter(), 'paragraph')}
                  >{t.paragraphAfter()} <span class="shortcut">Ctrl + Enter</span></button
                >
                <div class="divider"></div>
                <div class="nested-trigger">
                  <span>{t.diagram()}</span>
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
                      {t.blankDiagram()} <span class="shortcut">mermaid</span>
                    </button>
                    <div class="divider"></div>
                    {#each DIAGRAM_TEMPLATES as template}
                      <button on:click={() => insertDiagram(template.type, 'paragraph')}>
                        {getDiagramTypeLabel(template.type)}
                        <span class="shortcut">{template.type}</span>
                      </button>
                    {/each}
                  </div>
                </div>
                <button
                  on:click={() => finish(() => runCommand({ type: 'insertFootnote' }), 'paragraph')}
                  >{t.footnote()}</button
                >
                <button
                  on:click={() =>
                    finish(() => runCommand({ type: 'insertHorizontalRule' }), 'paragraph')}
                  >{t.horizontalRule()} <span class="shortcut">Ctrl + Shift + H</span></button
                >
                <button
                  on:click={() => finish(() => runCommand({ type: 'insertToc' }), 'paragraph')}
                  >{t.toc()}</button
                >
                <button on:click={() => finish(editFrontMatter, 'paragraph')}
                  >{t.frontMatter()}</button
                >
              </div>
            {/if}
          </div>

          <div
            class="menu-item"
            class:active={activeMenu === 'format'}
            use:clickOutside={() => closeMenu('format')}
          >
            <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('format')}
              >{t.format()}</button
            >
            {#if activeMenu === 'format'}
              <div class="dropdown-menu">
                <button on:click={() => finish(() => runCommand({ type: 'toggleBold' }), 'format')}
                  >{t.bold()} <span class="shortcut">Ctrl + B</span></button
                >
                <button
                  on:click={() => finish(() => runCommand({ type: 'toggleItalic' }), 'format')}
                  >{t.italic()} <span class="shortcut">Ctrl + I</span></button
                >
                <button
                  on:click={() => finish(() => runCommand({ type: 'toggleUnderline' }), 'format')}
                  >{t.underline()} <span class="shortcut">Ctrl + U</span></button
                >
                <button on:click={() => finish(() => runCommand({ type: 'toggleCode' }), 'format')}
                  >{t.inlineCode()} <span class="shortcut">Ctrl + `</span></button
                >
                <button on:click={() => comingSoon(t.inlineMath(), 'format')}
                  >{t.inlineMath()}</button
                >
                <div class="divider"></div>
                <button
                  on:click={() =>
                    finish(() => runCommand({ type: 'toggleStrikethrough' }), 'format')}
                  >{t.strikethrough()} <span class="shortcut">Alt + Shift + 5</span></button
                >
                <button
                  on:click={() => finish(() => runCommand({ type: 'toggleHighlight' }), 'format')}
                  >{t.highlight()}</button
                >
                <button
                  on:click={() =>
                    finish(() => runCommand({ type: 'insertCommentInline' }), 'format')}
                  >{t.inlineComment()}</button
                >
                <div class="divider"></div>
                <button on:click={() => finish(openLinkPicker, 'format')}
                  >{t.link()} <span class="shortcut">Ctrl + K</span></button
                >
                <button on:click={() => comingSoon(t.imageMenu(), 'format')}>{t.imageMenu()}</button
                >
                <div class="divider"></div>
                <button
                  on:click={() => finish(() => runCommand({ type: 'clearInlineStyles' }), 'format')}
                  >{t.clearStyle()} <span class="shortcut">Ctrl + \</span></button
                >
              </div>
            {/if}
          </div>

          <div
            class="menu-item"
            class:active={activeMenu === 'view'}
            use:clickOutside={() => closeMenu('view')}
          >
            <button class="menu-btn" on:click|stopPropagation={() => toggleMenu('view')}
              >{t.view()}</button
            >
            {#if activeMenu === 'view'}
              <div class="dropdown-menu">
                <button
                  on:click={() =>
                    finish(() => setMode(mode === 'source' ? 'semantic' : 'source'), 'view')}
                  >{t.toggleSourceMode()} <span class="shortcut">Ctrl + E</span></button
                >
                <button on:click={() => finish(toggleOutlineVisible, 'view')}
                  >{outlineVisible ? t.hideOutline() : t.showOutline()}</button
                >
                <button on:click={() => finish(toggleTheme, 'view')}
                  >{t.switchTheme()} <span class="shortcut">Ctrl + Shift + L</span></button
                >
                <button on:click={() => finish(toggleFocusMode, 'view')}
                  >{t.showHideExplorer()} <span class="shortcut">Ctrl + Shift + F</span></button
                >
              </div>
            {/if}
          </div>

          <div class="menu-item">
            <button
              class="menu-btn"
              on:click|stopPropagation={() => finish(openSettings, 'settings')}
              >{t.settings()}</button
            >
          </div>
        </nav>
      {/if}

      <span class="titlebar-spacer" data-drag-region></span>
      <div class="titlebar-right">
        <button
          class="icon-btn theme-toggle-icon-btn"
          title={t.switchTheme()}
          aria-label={t.switchTheme()}
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
            <button
              class="control-btn"
              title={t.minimize()}
              aria-label={t.minimize()}
              on:click={minimizeWindow}
            >
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
              title={isMaximized ? t.restoreWindow() : t.maximize()}
              aria-label={isMaximized ? t.restoreWindow() : t.maximize()}
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
              title={t.close()}
              aria-label={t.close()}
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
{/key}
