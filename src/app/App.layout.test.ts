import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('App outline layout', () => {
  const appSource = readFileSync(resolve(__dirname, 'App.svelte'), 'utf-8');
  const editorSource = readFileSync(
    resolve(__dirname, 'components/EditorWorkspace.svelte'),
    'utf-8',
  );
  const toolbarSource = readFileSync(
    resolve(__dirname, 'components/EditorToolbar.svelte'),
    'utf-8',
  );
  const settingsWindowSource = readFileSync(
    resolve(__dirname, 'components/SettingsWindow.svelte'),
    'utf-8',
  );
  const linkQuickEditorSource = readFileSync(
    resolve(__dirname, 'components/LinkQuickEditor.svelte'),
    'utf-8',
  );
  const appShellSource = readFileSync(resolve(__dirname, 'components/AppShell.svelte'), 'utf-8');
  const titleBarSource = readFileSync(resolve(__dirname, 'components/AppTitleBar.svelte'), 'utf-8');
  const documentTabsSource = readFileSync(
    resolve(__dirname, 'components/DocumentTabs.svelte'),
    'utf-8',
  );
  const explorerSidebarSource = readFileSync(
    resolve(__dirname, 'components/ExplorerSidebar.svelte'),
    'utf-8',
  );
  const frontMatterCardSource = readFileSync(
    resolve(__dirname, 'components/FrontMatterCard.svelte'),
    'utf-8',
  );
  const appCommandsSource = readFileSync(resolve(__dirname, 'services/appCommands.ts'), 'utf-8');
  const settingsServiceSource = readFileSync(resolve(__dirname, 'services/settings.ts'), 'utf-8');
  const desktopWindowSource = readFileSync(
    resolve(__dirname, 'services/desktopWindow.ts'),
    'utf-8',
  );
  const tauriMenuSource = readFileSync(
    resolve(__dirname, '../../src-tauri/src/window/menu.rs'),
    'utf-8',
  );
  const tauriLibSource = readFileSync(resolve(__dirname, '../../src-tauri/src/lib.rs'), 'utf-8');
  const tauriConfigSource = readFileSync(
    resolve(__dirname, '../../src-tauri/tauri.conf.json'),
    'utf-8',
  );
  const tauriTraySource = readFileSync(
    resolve(__dirname, '../../src-tauri/src/window/tray.rs'),
    'utf-8',
  );
  const tauriExternalOpenSource = readFileSync(
    resolve(__dirname, '../../src-tauri/src/window/external_open.rs'),
    'utf-8',
  );
  const tauriWindowCommandsSource = readFileSync(
    resolve(__dirname, '../../src-tauri/src/window/commands.rs'),
    'utf-8',
  );
  const tauriMacosSource = readFileSync(
    resolve(__dirname, '../../src-tauri/src/window/os/macos.rs'),
    'utf-8',
  );
  const tauriImageAssetsSource = readFileSync(
    resolve(__dirname, '../../src-tauri/src/file_system/image_assets.rs'),
    'utf-8',
  );
  const tauriFileSystemSource = readFileSync(
    resolve(__dirname, '../../src-tauri/src/file_system.rs'),
    'utf-8',
  );
  const tauriDatabaseSource = readFileSync(
    resolve(__dirname, '../../src-tauri/src/database.rs'),
    'utf-8',
  );
  const tauriStorageSource = readFileSync(
    resolve(__dirname, '../lib/desktop/tauriStorage.ts'),
    'utf-8',
  );
  const outlineInteractionSource = readFileSync(
    resolve(__dirname, 'services/outlineInteractionController.ts'),
    'utf-8',
  );
  const editorInteractionSource = readFileSync(
    resolve(__dirname, 'services/editorInteractionController.ts'),
    'utf-8',
  );
  const tocNodeViewSource = readFileSync(
    resolve(__dirname, '../lib/editor-core/nodeViews/TocBlockNodeView.ts'),
    'utf-8',
  );
  const styles = [
    'styles/app.css',
    'styles/app-layout.css',
    'styles/app-chrome.css',
    'styles/app-responsive.css',
    'styles/editor-document.css',
    'styles/editor-outline.css',
  ]
    .map((path) => readFileSync(resolve(__dirname, path), 'utf-8'))
    .join('\n');
  const responsiveStyles = readFileSync(resolve(__dirname, 'styles/app-responsive.css'), 'utf-8');

  function extractCssBlock(source: string, selector: string, fromIndex = 0) {
    const selectorIndex = source.indexOf(selector, fromIndex);
    expect(selectorIndex).toBeGreaterThan(-1);
    const blockStart = source.indexOf('{', selectorIndex);
    expect(blockStart).toBeGreaterThan(-1);
    let depth = 0;
    for (let index = blockStart; index < source.length; index += 1) {
      if (source[index] === '{') {
        depth += 1;
      } else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          return source.slice(blockStart + 1, index);
        }
      }
    }
    throw new Error(`CSS block not closed: ${selector}`);
  }

  it('keeps the document outline out of the document layout flow', () => {
    const documentLayouts =
      editorSource.match(/<div class="document-layout">[\s\S]*?<\/div>/g) ?? [];

    expect(documentLayouts).toHaveLength(2);
    for (const layout of documentLayouts) {
      expect(layout).not.toContain('class="content-outline"');
    }
    expect(styles).toMatch(/\.content-outline\s*\{[\s\S]*?position:\s*fixed;/);
    expect(styles).toMatch(/\.editor-shell\s*\{[\s\S]*?container-type:\s*inline-size;/);
    expect(styles).toMatch(
      /\.content-outline\s*\{[\s\S]*?right:\s*clamp\(32px,\s*3\.5cqw,\s*160px\);/,
    );
    expect(styles).not.toContain('7vw');
  });

  it('sizes the document content as a percentage of the editor shell', () => {
    expect(appSource).toContain(
      'contentWidthPercent = DEFAULT_APP_PREFERENCES.contentWidthPercent',
    );
    expect(appSource).toContain('{contentWidthPercent}');
    expect(styles).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*calc\(var\(--md-editor-content-width-percent\) \* 1cqw\)\);/,
    );
  });

  it('keeps front matter aligned with the zoomed document body', () => {
    expect(styles).toMatch(
      /\.front-matter-card\s*\{[\s\S]*?max-width:\s*calc\(var\(--md-editor-content-width-percent\) \* 1cqw\);[\s\S]*?margin:\s*0 auto 22px;[\s\S]*?zoom:\s*var\(--md-editor-zoom\);/,
    );
  });

  it('keeps document stats as a floating editor card', () => {
    expect(styles).toMatch(
      /\.editor-shell\s*\{[\s\S]*?grid-template-rows:\s*auto auto minmax\(0,\s*1fr\);/,
    );
    expect(styles).toMatch(/\.statusbar\s*\{[\s\S]*?position:\s*absolute;/);
    expect(styles).toMatch(/\.statusbar\s*\{[\s\S]*?right:\s*16px;/);
    expect(styles).toMatch(/\.statusbar-stats-trigger\s*\{[\s\S]*?border:\s*1px solid/);
    expect(styles).not.toMatch(/\.statusbar\s*\{[\s\S]*?border-top:\s*1px solid/);
  });

  it('keeps outline navigation in the current editor mode', () => {
    const jumpStart = outlineInteractionSource.indexOf('function jumpToOutlineItem');
    const jumpEnd = outlineInteractionSource.indexOf(
      'function updateActiveOutlineFromSourceScroll',
    );
    const jumpSource = outlineInteractionSource.slice(jumpStart, jumpEnd);

    expect(jumpSource).not.toContain("setMode('source')");
    expect(jumpSource).toContain('options.setActiveOutlineId(item.id);');
    expect(jumpSource).toContain(
      'scrollSemanticToAnchor(options.getOutline(), options.getSemanticPane()',
    );
  });

  it('keeps source typing from normalizing content or resetting scroll', () => {
    const updateStart = editorInteractionSource.indexOf('function updateMarkdown');
    const updateEnd = editorInteractionSource.indexOf('function runCommand');
    const updateSource = editorInteractionSource.slice(updateStart, updateEnd);

    expect(updateSource).not.toContain('normalizeMarkdownForSave');
    expect(updateSource).toContain(
      'options.setPendingSourceScrollTop(options.getSourcePane()?.scrollTop ?? null);',
    );
    expect(updateSource).toContain(
      'options.getEditor().setMarkdown((event.currentTarget as HTMLTextAreaElement).value);',
    );
    expect(editorInteractionSource).toContain(
      'options.getSourcePane().scrollTop = restoreScrollTop;',
    );
  });

  it('renders one shared outline panel with expandable items', () => {
    expect(editorSource.match(/<aside class="content-outline"/g)).toHaveLength(1);
    expect(editorSource).toContain('export let collapsedOutlineIds');
    expect(editorSource).toContain('export let visibleOutlineIds');
    expect(appSource).toContain('{collapsedOutlineIds}');
    expect(appSource).toContain('{visibleOutlineIds}');
    expect(editorSource).toContain('toggleOutlineItemExpanded');
    expect(editorSource).toContain('visibleOutlineIds.has(item.id)');
    expect(editorSource).toContain('handleOutlineToggle(event, item)');
    expect(editorSource).toContain('{#each outline as item, index (item.id)}');
  });

  it('exposes toc insertion and deletion as accessible UI actions', () => {
    expect(toolbarSource).toContain("runCommand({ type: 'insertToc' })");
    expect(toolbarSource).toContain('aria-label="插入目录"');
    expect(toolbarSource).toContain('TableOfContents');
    expect(titleBarSource).toContain("runCommand({ type: 'insertToc' })");
    expect(titleBarSource).not.toContain("comingSoon('正文目录'");
    expect(appCommandsSource).toContain("command === 'menu-content-directory'");
    expect(appCommandsSource).toContain("handlers.runCommand({ type: 'insertToc' });");
    expect(tocNodeViewSource).toContain("this.dom.className = 'toc-block'");
    expect(tocNodeViewSource).toContain("deleteButton.setAttribute('aria-label', '删除目录')");
    expect(tocNodeViewSource).toContain("textContent = '当前文档还没有标题'");
  });

  it('wires Mermaid diagram insertion through toolbar, titlebar and native menu', () => {
    expect(toolbarSource).toContain('DIAGRAM_TEMPLATES');
    expect(toolbarSource).toContain("type: 'insertMermaidBlock'");
    expect(toolbarSource).toContain('空白图表');
    expect(toolbarSource).toContain("type: 'insertDiagramBlock'");
    expect(toolbarSource).toContain('aria-label="插入图表"');
    expect(titleBarSource).toContain('DIAGRAM_TEMPLATES');
    expect(titleBarSource).toContain('insertBlankDiagram');
    expect(titleBarSource).toContain('insertDiagram(template.type');
    expect(titleBarSource).not.toContain("comingSoon('图表'");
    expect(appCommandsSource).toContain("command === 'menu-chart'");
    expect(appCommandsSource).toContain("type: 'insertMermaidBlock'");
    expect(appCommandsSource).toContain("command.startsWith('menu-chart:')");
    expect(appCommandsSource).toContain("type: 'insertDiagramBlock'");
    expect(tauriMenuSource).toContain('SubmenuBuilder::new(app, "图表")');
    expect(tauriMenuSource).toContain('"menu-chart", "空白图表"');
    expect(tauriMenuSource).toContain('menu-chart:flowchart');
    expect(tauriMenuSource).toContain('menu-chart:erDiagram');
  });

  it('wires highlight through toolbar, titlebar and native menu', () => {
    expect(toolbarSource).toContain('Highlighter');
    expect(toolbarSource).toContain("runCommand({ type: 'toggleHighlight' })");
    expect(titleBarSource).toContain("runCommand({ type: 'toggleHighlight' })");
    expect(titleBarSource).not.toContain("comingSoon('高亮'");
    expect(appCommandsSource).toContain("command === 'menu-highlight'");
    expect(appCommandsSource).toContain("handlers.runCommand({ type: 'toggleHighlight' });");
    expect(tauriMenuSource).toContain('"menu-highlight"');
    expect(tauriMenuSource).toContain('"高亮"');
  });

  it('wires link editing through toolbar, titlebar and shortcuts', () => {
    expect(toolbarSource).toContain('Link');
    expect(toolbarSource).toContain('aria-label="编辑超链接"');
    expect(linkQuickEditorSource).toContain('role="dialog"');
    expect(linkQuickEditorSource).toContain('role="alert"');
    expect(linkQuickEditorSource).toContain('placeholder="标题（显示文字）"');
    expect(linkQuickEditorSource).toContain('placeholder="https://example.com"');
    expect(appSource).toContain('getLinkPickerPositionStyle(editor.getSelectionAnchorRect())');
    expect(titleBarSource).toContain('finish(openLinkPicker,');
    expect(titleBarSource).not.toContain("comingSoon('超链接'");
    expect(appCommandsSource).toContain("command === 'menu-link'");
    expect(appCommandsSource).toContain('handlers.openLinkPicker();');
    expect(appCommandsSource).toContain("key === 'k' && !event.shiftKey");
    expect(tauriMenuSource).toContain('"menu-link"');
    expect(tauriMenuSource).toContain('"超链接"');
    expect(appSource).toContain('editor.getActiveLink()');
    expect(appSource).toContain("type: 'insertLink'");
    expect(appSource).toContain('text: linkText');
    expect(appSource).toContain("type: 'removeLink'");
    expect(appSource).toContain('updateLinkText');
  });

  it('wires Markdown comments through toolbar, titlebar and native menu', () => {
    expect(toolbarSource).toContain('MessageSquare');
    expect(toolbarSource).toContain("type: 'insertCommentInline'");
    expect(toolbarSource).toContain('aria-label="插入行内注释"');
    expect(titleBarSource).toContain("type: 'insertCommentInline'");
    expect(titleBarSource).toContain("type: 'insertCommentBlock'");
    expect(titleBarSource).not.toContain("comingSoon('注释'");
    expect(appCommandsSource).toContain("command === 'menu-comment'");
    expect(appCommandsSource).toContain("type: 'insertCommentInline'");
    expect(appCommandsSource).toContain("command === 'menu-comment-block'");
    expect(appCommandsSource).toContain("type: 'insertCommentBlock'");
    expect(tauriMenuSource).toContain('"menu-comment"');
    expect(tauriMenuSource).toContain('"注释"');
    expect(tauriMenuSource).toContain('"menu-comment-block"');
    expect(tauriMenuSource).toContain('"注释块"');
  });

  it('forwards native menu events to desktop command handlers', () => {
    const tauriLibSource = readFileSync(resolve(__dirname, '../../src-tauri/src/lib.rs'), 'utf-8');
    const tauriCommandsSource = readFileSync(
      resolve(__dirname, '../../src-tauri/src/window/commands.rs'),
      'utf-8',
    );

    expect(tauriLibSource).toContain('install_window_menu(app.handle(), &window)');
    expect(tauriCommandsSource).toContain('install_window_menu(&app, &window)');
    expect(tauriMenuSource).toContain('app.set_menu(menu)');
    expect(tauriMenuSource).toContain('app.on_menu_event(|app, event|');
    expect(tauriMenuSource).toContain('focused_document_window(app)');
    expect(tauriMenuSource).toContain('app.webview_windows()');
    expect(tauriMenuSource).toContain('window.is_focused().unwrap_or(false)');
    expect(tauriMenuSource).toContain('app.get_webview_window("main")');
    expect(tauriMenuSource).toContain('window.on_menu_event(|window, event|');
    expect(tauriMenuSource).toContain('window.emit("nomo://menu-command", command)');
    expect(tauriMenuSource).toContain('emit_exit_request(window.app_handle())');
    expect(tauriMenuSource).toContain('emit_exit_request(app)');
    expect(tauriCommandsSource).toContain('app.emit("nomo://request-exit-app", ())');
    expect(appSource).toContain("listen('nomo://request-exit-app'");
    expect(appSource).toContain('requestExitApp()');
    expect(tauriMenuSource).toContain('format!("open-recent:{}:{}", entry.entry_type, entry.path)');
    expect(appCommandsSource).toContain("command === 'new-window'");
    expect(appCommandsSource).toContain("command.startsWith('open-recent:')");
  });

  it('routes external document open requests into existing document windows', () => {
    expect(tauriLibSource).toContain('tauri_plugin_single_instance::init');
    expect(tauriLibSource).toContain('collect_external_open_targets_from_args');
    expect(tauriLibSource).toContain('route_external_open_targets');
    expect(tauriLibSource).toContain('tauri::RunEvent::Opened');
    expect(tauriLibSource).toContain('collect_markdown_paths_from_urls');
    expect(tauriLibSource).toContain('persist_pending_external_open');
    expect(tauriLibSource).toContain('persist_pending_external_folder_open');
    expect(tauriExternalOpenSource).toContain(
      'const OPEN_DOCUMENT_EVENT: &str = "nomo://open-document"',
    );
    expect(tauriExternalOpenSource).toContain(
      'const OPEN_FOLDER_EVENT: &str = "nomo://open-folder"',
    );
    expect(tauriExternalOpenSource).toContain('.emit(');
    expect(tauriExternalOpenSource).toContain('OPEN_DOCUMENT_EVENT');
    expect(tauriExternalOpenSource).toContain('OPEN_FOLDER_EVENT');
    expect(tauriExternalOpenSource).toContain('is_document_window_label');
    expect(tauriStorageSource).toContain('listenDesktopOpenDocuments');
    expect(tauriStorageSource).toContain("listen<ExternalOpenPayload>('nomo://open-document'");
    expect(tauriStorageSource).toContain('listenDesktopOpenFolder');
    expect(tauriStorageSource).toContain("listen<ExternalOpenFolderPayload>('nomo://open-folder'");
    expect(appSource).toContain('listenDesktopOpenDocuments');
    expect(appSource).toContain('listenDesktopOpenFolder');
    expect(appSource).toContain('pendingExternalOpen:${windowLabel}');
    expect(appSource).toContain('pendingFolder:${windowLabel}');
    expect(appSource).toContain('openExternalMarkdownPaths(pendingExternalOpenPaths)');
    expect(appSource).toContain('openFolderWithBehavior(folderPath)');
    expect(appSource).toContain("openRecentEntry(path, 'file')");
    expect(tauriConfigSource).toContain('"fileAssociations"');
    expect(tauriConfigSource).toContain('"md"');
    expect(tauriConfigSource).toContain('"markdown"');
    expect(tauriConfigSource).toContain('"role": "Editor"');
  });

  it('keeps the explicit explorer root across restored workspace tabs', () => {
    expect(appSource).toMatch(
      /updateAppSetting\(`workspaceTabs:\$\{windowLabel\}`,\s*\{\s*tabs,\s*activeTabId,\s*currentFolderPath,\s*\}\)/,
    );
    expect(appSource).toContain("typeof state.currentFolderPath === 'string'");
    expect(appSource).toContain('currentFolderPath = state.currentFolderPath');
    expect(appSource).not.toContain(
      `const parentDir = getDirectoryLabel(filePath);
      if (parentDir && parentDir !== '当前文件夹') loadFolder(parentDir).catch(() => undefined);`,
    );
  });

  it('does not mark ancestor folders as selected when a file is active', () => {
    expect(explorerSidebarSource).not.toContain('function isFolderActive');
    expect(explorerSidebarSource).not.toContain('class:active={isFolderActive(');
    expect(explorerSidebarSource).toContain('class:active={nativePath === node.path}');
  });

  it('mirrors the app chrome menu into the native macOS menubar', () => {
    expect(appShellSource).toContain('{#if desktopEnabled}');
    expect(appShellSource).toContain('<AppTitleBar');
    expect(tauriMenuSource).toContain('static APP_MENU_EVENT_INSTALLED');
    expect(tauriMenuSource).toContain('SubmenuBuilder::new(app, "段落")');
    expect(tauriMenuSource).toContain('SubmenuBuilder::new(app, "设置")');
    expect(tauriMenuSource).toContain('"set-heading-1"');
    expect(tauriMenuSource).toContain('"set-heading-6"');
    expect(tauriMenuSource).toContain('"insert-callout",');
    expect(tauriMenuSource).toContain('"toggle-ordered-list",');
    expect(tauriMenuSource).toContain('"toggle-bullet-list",');
    expect(tauriMenuSource).toContain('"toggle-task-list",');
    expect(tauriMenuSource).toContain('"open-settings", "偏好设置..."');
    expect(tauriMenuSource).toContain('Some("CmdOrCtrl+N")');
    expect(tauriMenuSource).toContain('"Cmd+Q"');
    expect(tauriMenuSource).toContain('"Alt+F4"');
    expect(appCommandsSource).toContain("command === 'close-current-file'");
    expect(appCommandsSource).toContain("command === 'close-current-window'");
    expect(appCommandsSource).toContain("command === 'open-settings'");
  });

  it('wires YAML Front Matter to the semantic metadata card flow', () => {
    expect(editorSource).toContain('FrontMatterCard');
    expect(editorSource).toContain('frontMatterEditing');
    expect(appSource).toContain('replaceFrontMatterContent');
    expect(appSource).toContain("editor.execute({ type: 'insertFrontMatter' })");
    expect(titleBarSource).toContain('finish(editFrontMatter,');
    expect(titleBarSource).not.toContain("comingSoon('YAML Front Matter'");
    expect(titleBarSource).toContain('文档元数据');
    expect(appCommandsSource).toContain("command === 'menu-yaml-front-matter'");
    expect(appCommandsSource).toContain('handlers.editFrontMatter();');
    expect(frontMatterCardSource).toContain('aria-label="文档元数据编辑态"');
    expect(frontMatterCardSource).toContain("'编辑文档元数据'");
    expect(frontMatterCardSource).toContain("'查看文档元数据'");
    expect(frontMatterCardSource).not.toContain('YAML Front Matter');
    expect(frontMatterCardSource).toContain('readonly={readonly}');
    expect(frontMatterCardSource).toContain('on:focus={enterEdit}');
    expect(frontMatterCardSource).toContain('on:focusout={handleFocusOut}');
    expect(frontMatterCardSource).toContain('on:input={handleInput}');
    expect(frontMatterCardSource).toContain('deleteFrontMatter');
    expect(frontMatterCardSource).toContain('确认删除');
    expect(frontMatterCardSource).toContain('frontMatter.fields.parseWarning');
  });

  it('keeps the editor toolbar focused on editing and view controls', () => {
    expect(toolbarSource).not.toContain('FolderOpen');
    expect(toolbarSource).not.toContain('PanelLeftClose');
    expect(toolbarSource).not.toContain('PanelLeftOpen');
    expect(toolbarSource).not.toContain('资源管理器侧边栏');
    expect(toolbarSource).not.toContain('Save');
    expect(toolbarSource).not.toContain('Image');
    expect(toolbarSource).not.toContain('Palette');
    expect(toolbarSource).not.toContain('Pilcrow');
    expect(toolbarSource).not.toContain('title="打开 Markdown"');
    expect(toolbarSource).not.toContain('title="导出保存"');
    expect(toolbarSource).not.toContain('title="图片"');
    expect(toolbarSource).not.toContain('title="字号"');
    expect(toolbarSource).not.toContain('title="行高"');
    expect(toolbarSource).not.toContain('aria-label="切换引用和提示块样式"');
    expect(toolbarSource).toContain('width-control');
    expect(toolbarSource).toContain('AlignHorizontalSpaceAround');
    expect(toolbarSource).toContain('contentWidthPercent');
  });

  it('uses semantic icons for mode, outline and toc controls in the editor toolbar', () => {
    expect(toolbarSource).toContain('BookOpenText');
    expect(toolbarSource).toContain('CodeXml');
    expect(toolbarSource).toContain('aria-label="切换到语义编辑"');
    expect(toolbarSource).toContain('aria-label="切换到源码模式"');
    expect(toolbarSource).toContain("setMode('semantic')");
    expect(toolbarSource).toContain("setMode('source')");
    expect(toolbarSource).toContain('ListTree size={18}');
    expect(toolbarSource).toContain('TableOfContents size={17}');
  });

  it('keeps global explorer controls in the single titlebar chrome', () => {
    expect(appShellSource).toContain('{#if desktopEnabled}');
    expect(titleBarSource).toContain('sidebar-toggle-btn');
    expect(titleBarSource).toContain('PanelLeftClose');
    expect(titleBarSource).toContain('PanelLeftOpen');
    expect(titleBarSource).not.toContain('nomoAppIcon');
    expect(titleBarSource).not.toContain('class="app-logo"');
    expect(titleBarSource).not.toContain('<img class="app-logo"');
    expect(titleBarSource).toContain('Nomo</span>');
    expect(titleBarSource).not.toContain('<span class="app-logo">M</span>');
    expect(titleBarSource).toContain('资源管理器侧边栏');
    expect(titleBarSource).toContain('export let focusMode: boolean');
    expect(titleBarSource).toContain("title={isMaximized ? '还原窗口' : '最大化'}");
    expect(titleBarSource).toContain("aria-label={isMaximized ? '还原窗口' : '最大化'}");
    expect(titleBarSource).toContain('handleMaximizeWindow');
    expect(titleBarSource).toContain('syncWindowState');
    expect(desktopWindowSource).toContain("title: 'Nomo'");
    expect(desktopWindowSource).toContain('} - Nomo');
    expect(desktopWindowSource).toContain('getNewWindowChromeOptions');
    expect(desktopWindowSource).toContain("titleBarStyle: 'overlay'");
    expect(desktopWindowSource).toContain('hiddenTitle: true');
    expect(tauriMacosSource).toContain('uses_overlay_titlebar(window.label())');
    expect(tauriMacosSource).toContain('label != "window-settings"');
    expect(styles).toMatch(/\.titlebar\s*\{[\s\S]*?height:\s*42px;/);
    expect(styles).not.toContain('border-bottom: 1px solid var(--md-titlebar-border);');
    expect(styles).toContain('padding-left: 82px;');
    expect(styles).toMatch(/\.titlebar-row\.bottom-row\s*\{[\s\S]*?display:\s*none;/);
    expect(styles).not.toContain('.app-logo');
    expect(styles).toMatch(/\.app-name\s*\{[\s\S]*?font-size:\s*13px;/);
  });

  it('keeps explorer rows constrained to the visible tree width', () => {
    expect(explorerSidebarSource).toContain('class="folder-actions"');
    expect(styles).toMatch(/\.file-tree\s*\{[\s\S]*?scrollbar-gutter:\s*stable;/);
    expect(styles).toMatch(/--explorer-scrollbar-safe-area:\s*8px;/);
    expect(styles).toMatch(/\.tree-root,\s*\.recent-tree\s*\{[\s\S]*?min-width:\s*0;/);
    expect(styles).toMatch(/\.recursive-tree-container\s*\{[\s\S]*?min-width:\s*0;/);
    expect(styles).toMatch(/\.recursive-tree-container\s*\{[\s\S]*?max-width:\s*100%;/);
    expect(styles).toMatch(/\.tree-folder-wrapper\s*\{[\s\S]*?min-width:\s*0;/);
    expect(styles).toMatch(/\.tree-folder-wrapper\s*\{[\s\S]*?max-width:\s*100%;/);
    expect(styles).toMatch(/\.tree-folder\.nested-dir\s*\{[\s\S]*?max-width:\s*100%;/);
    expect(styles).toMatch(/\.tree-folder\.nested-dir\s*\{[\s\S]*?overflow:\s*hidden;/);
    expect(styles).toMatch(/\.file-tree button\.tree-file\s*\{[\s\S]*?max-width:\s*100%;/);
    expect(styles).toMatch(/\.file-tree button\.tree-file\s*\{[\s\S]*?margin:\s*1px 0;/);
  });

  it('keeps folder chevron double-clicks from starting rename mode', () => {
    expect(explorerSidebarSource).toContain('function handleFolderDoubleClick');
    expect(explorerSidebarSource).toContain("target?.closest('.chevron-icon')");
    expect(explorerSidebarSource).toContain(
      'on:dblclick={(event) => handleFolderDoubleClick(node, event)}',
    );
  });

  it('cancels explorer rename mode when focus leaves the rename input', () => {
    expect(explorerSidebarSource).toContain(
      "import { clickOutside } from '../actions/clickOutside';",
    );
    expect(explorerSidebarSource).toContain('on:blur={cancelRenaming}');
    expect(explorerSidebarSource).toContain('use:clickOutside={cancelRenaming}');
    expect(explorerSidebarSource).toContain("if (event.key === 'Enter')");
    expect(explorerSidebarSource).toContain('commitRenaming();');
  });

  it('recomputes explorer virtual rows when folder expansion changes', () => {
    expect(explorerSidebarSource).toContain(
      "import { buildVisibleExplorerRows, type ExplorerTreeRow } from '../services/explorerRows';",
    );
    expect(explorerSidebarSource).toContain('$: flattenedRows = buildVisibleExplorerRows(');
    expect(explorerSidebarSource).toContain('expandedFolders,');
    expect(explorerSidebarSource).toContain('creatingParentPath,');
  });

  it('prevents accidental text selection while clicking explorer icons', () => {
    expect(styles).toMatch(/\.file-tree\s*\{[\s\S]*?user-select:\s*none;/);
    expect(styles).toMatch(/\.rename-input\s*\{[\s\S]*?user-select:\s*text;/);
  });

  it('places the new tab button after the last visible tab and hides it when tabs overflow', () => {
    const containerStart = documentTabsSource.indexOf('<div class="tabs-container"');
    const addButtonIndex = documentTabsSource.indexOf('class="tab-add"');
    const containerEnd = documentTabsSource.indexOf('</div>', addButtonIndex);

    expect(containerStart).toBeGreaterThan(-1);
    expect(addButtonIndex).toBeGreaterThan(containerStart);
    expect(containerEnd).toBeGreaterThan(addButtonIndex);
    expect(documentTabsSource).not.toContain('class="tab-actions"');
    expect(documentTabsSource).toContain('{#if showAddButton}');
    expect(documentTabsSource).toContain('measureAndComputeVisible');
    expect(documentTabsSource).toContain('showDropdown');
    expect(styles).not.toContain('.tab-actions');
    expect(styles).toMatch(/\.tab-add\s*\{[\s\S]*?flex-shrink:\s*0;/);
    expect(styles).toContain('.tab-overflow-dropdown');
    expect(styles).toContain('.tab-dropdown-menu');
  });

  it('keeps narrow desktop chrome single-row and clips the editor toolbar without horizontal scroll', () => {
    const narrowDesktopStart = responsiveStyles.indexOf('@media (max-width: 920px)');
    const narrowDesktopStyles = extractCssBlock(responsiveStyles, '@media (max-width: 920px)');
    const railStyles = extractCssBlock(responsiveStyles, '.rail', narrowDesktopStart);
    const topbarStyles = extractCssBlock(responsiveStyles, '.topbar', narrowDesktopStart);
    const toolbarStyles = extractCssBlock(responsiveStyles, '.toolbar', narrowDesktopStart);

    expect(styles).toMatch(/--md-editor-effective-sidebar-width:\s*min\(/);
    expect(styles).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*var\(--md-editor-effective-sidebar-width\)\)\s*minmax\(0,\s*1fr\);/,
    );
    expect(narrowDesktopStyles).not.toContain('.workspace');
    expect(railStyles).toMatch(/display:\s*flex;/);
    expect(railStyles).not.toMatch(/display:\s*none;/);
    expect(topbarStyles).toMatch(/flex-wrap:\s*nowrap;/);
    expect(topbarStyles).toMatch(/height:\s*40px;/);
    expect(toolbarStyles).toMatch(/flex-wrap:\s*nowrap;/);
    expect(toolbarStyles).toMatch(/overflow-x:\s*clip;/);
    expect(toolbarStyles).toMatch(/overflow-y:\s*hidden;/);
    expect(toolbarStyles).not.toMatch(/overflow-x:\s*auto;/);
  });

  it('opens preferences in a dedicated settings window', () => {
    expect(appSource).not.toContain('SettingsDrawer');
    expect(desktopWindowSource).toContain('openSettingsWindow');
    expect(settingsWindowSource).toContain('偏好设置');
    expect(settingsWindowSource).toContain('settings-nav');
    expect(settingsWindowSource).toContain('保存前创建快照');
    expect(settingsWindowSource).toContain('自动保存延迟');
    expect(settingsWindowSource).toContain('大文件阈值');
    expect(settingsWindowSource).toContain('打开文件夹默认行为');
    expect(settingsWindowSource).toContain('文件预览标签');
    expect(settingsWindowSource).toContain('显示文档统计');
    expect(settingsWindowSource).toContain('默认统计类型');
    expect(settingsWindowSource).toContain('阅读时间');
    expect(settingsWindowSource).toContain('关闭到托盘');
    expect(settingsWindowSource).toContain('图片默认宽度');
    expect(settingsWindowSource).toContain('后续版本支持');
    expect(settingsWindowSource).toContain('自动清理本地图片');
    expect(settingsWindowSource).toContain('代码块默认语言');
    expect(settingsWindowSource).toContain('Mermaid 默认图表类型');
    expect(appSource).toContain('DEFAULT_APP_PREFERENCES.filePreviewEnabled');
    expect(appSource).toContain('DEFAULT_APP_PREFERENCES.autoSaveEnabled');
    expect(appSource).toContain('DEFAULT_APP_PREFERENCES.closeToTrayEnabled');
    expect(appSource).toContain('SETTINGS_UPDATED_EVENT');
    expect(appSource).toContain('applyAppPreferences');
    expect(appSource).toContain('autoSaveEnabled && desktopEnabled && dirty && nativePath');
    expect(appSource).toContain('previewTabId = filePreviewEnabled ? targetTab.id : null');
  });

  it('wires the first and second batch settings to runtime behavior instead of placeholders', () => {
    expect(settingsWindowSource).toContain("on:click={() => setTheme('light')}>浅色");
    expect(settingsWindowSource).toContain("on:click={() => setTheme('dark')}>深色");
    expect(settingsWindowSource).toContain("on:click={() => setTheme('system')}>跟随系统");
    expect(settingsWindowSource).toContain('id="zoomPercent"');
    expect(settingsWindowSource).toContain('ctrlWheelZoomEnabled');
    expect(settingsWindowSource).toContain('codeBlockLineNumbersVisible');
    expect(settingsWindowSource).toContain('setCodeBlockIndent');
    expect(settingsWindowSource).toContain('id="defaultImageWidth"');
    expect(settingsWindowSource).toContain('setImageDefaultAlign');
    expect(settingsWindowSource).toContain('testPicgoConnection');
    expect(settingsWindowSource).toContain('bindMarkdownAssociation');
    expect(settingsWindowSource).toContain('id="outlineDefaultExpandLevel"');
    expect(settingsWindowSource).toContain('shortcutItems');
    expect(settingsWindowSource).toContain('updateShortcut');

    expect(settingsServiceSource).toContain("type ThemePreference = 'light' | 'dark' | 'system'");
    expect(appSource).toContain('setupSystemThemeListener');
    expect(appSource).toContain('handleGlobalWheel');
    expect(appSource).toContain('applyZoomSetting(zoomPercent)');
    expect(appSource).toContain('applyCodeBlockLineNumberSetting(codeBlockLineNumbersVisible)');
    expect(appSource).toContain(
      'document.documentElement.dataset.codeBlockIndent = codeBlockIndent',
    );
    expect(appSource).toContain('applyOutlineDefaultExpansion');
    expect(appSource).toContain('shortcutPreferences');
    expect(appSource).toContain('requestExitApp()');

    expect(tauriImageAssetsSource).toContain('pub(crate) fn test_picgo_connection');
    expect(tauriImageAssetsSource).toContain('create_picgo_core_command(command)');
    expect(tauriWindowCommandsSource).toContain('pub(crate) fn register_markdown_file_association');
    expect(tauriWindowCommandsSource).toContain('pub(crate) fn request_exit_app');
    expect(tauriTraySource).toContain('emit_exit_request(app)');
    expect(tauriMenuSource).toContain('emit_exit_request(window.app_handle())');
    expect(tauriMenuSource).toContain('emit_exit_request(app)');
  });

  it('supports closing windows to the system tray when enabled', () => {
    expect(tauriLibSource).toContain('crate::window::tray::install_app_tray');
    expect(tauriLibSource).toContain('crate::window::commands::hide_window_to_tray');
    expect(tauriLibSource).toContain('crate::window::tray::set_tray_active');
    expect(tauriLibSource).toContain('WindowEvent::CloseRequested');
    expect(tauriTraySource).toContain('TrayIconBuilder::with_id');
    expect(tauriTraySource).toContain('"打开 Nomo"');
    expect(tauriTraySource).toContain('nomo-tray-dark-active-24-preview.png');
    expect(tauriTraySource).toContain('nomo-tray-dark-inactive-24-preview.png');
    expect(tauriTraySource).toContain('nomo-tray-light-active-24-preview.png');
    expect(tauriTraySource).toContain('nomo-tray-light-inactive-24-preview.png');
    expect(tauriTraySource).toContain('nomo-app-light-256.png');
    expect(tauriTraySource).toContain('nomo-app-dark-256.png');
    expect(tauriTraySource).toContain('set_tray_active');
    expect(tauriTraySource).toContain('set_desktop_icon_theme');
    expect(tauriTraySource).toContain('apply_window_icons');
    expect(tauriTraySource).toContain('.set_icon(icon.clone())');
    expect(tauriLibSource).toContain('crate::window::commands::set_desktop_icon_theme');
    expect(desktopWindowSource).toContain("invoke('set_desktop_icon_theme'");
    expect(appSource).toContain('syncDesktopIconTheme(theme)');
    expect(tauriTraySource).toContain('"退出"');
    expect(tauriTraySource).toContain('emit_exit_request(app)');
    expect(tauriTraySource).toContain('TrayIconEvent::DoubleClick');
    expect(tauriTraySource).toContain('closeToTrayEnabled');
  });

  it('bundles and opens the first-run sample document through the normal document flow', () => {
    const tauriConfig = JSON.parse(tauriConfigSource);

    expect(tauriConfig.bundle.resources).toEqual({
      '../sample.md': 'samples/sample.md',
    });
    expect(tauriLibSource).toContain('crate::file_system::install_sample_document');
    expect(tauriStorageSource).toContain("invoke<NativeDocumentPayload>('install_sample_document')");
    expect(appSource).toContain('maybeOpenFirstRunSample');
    expect(appSource).toContain('documentActions.applyNativeDocument(document,');
    expect(appSource).toContain('FIRST_RUN_SAMPLE_DOCUMENT_OPENED_KEY');
  });

  it('removes application-level workspace storage path configuration', () => {
    expect(settingsWindowSource).not.toContain('工作区存储路径');
    expect(settingsWindowSource).not.toContain('workspaceDir');
    expect(settingsWindowSource).not.toContain('browseFolder');
    expect(settingsWindowSource).not.toContain('selectedDir');

    expect(appSource).not.toContain("updateAppSetting('workspaceDir'");
    expect(appSource).not.toContain("settings.find((s) => s.key === 'workspaceDir')");
    expect(appSource).not.toContain('getDefaultWorkspaceDir');
    expect(tauriStorageSource).not.toContain('getDefaultWorkspaceDir');
    expect(tauriStorageSource).not.toContain('get_default_workspace_dir');
    expect(tauriLibSource).not.toContain('get_default_workspace_dir');
    expect(tauriFileSystemSource).not.toContain('get_default_workspace_dir');
    expect(tauriDatabaseSource).toContain("DELETE FROM app_settings WHERE key = 'workspaceDir'");
  });

  it('keeps automatic local image cleanup behind an image setting toggle', () => {
    const imageSettingsSource = readFileSync(
      resolve(__dirname, '../lib/services/render.ts'),
      'utf-8',
    );
    const appSettingsSource = readFileSync(resolve(__dirname, 'services/settings.ts'), 'utf-8');

    expect(imageSettingsSource).toContain('autoDeleteUnusedLocalImages: boolean');
    expect(imageSettingsSource).toContain('autoDeleteUnusedLocalImages: true');
    expect(appSettingsSource).toContain('autoDeleteUnusedLocalImages');
    expect(settingsWindowSource).toContain('自动清理本地图片');
    expect(settingsWindowSource).toContain('autoDeleteUnusedLocalImages');
    expect(appSource).toContain('!imageSettings.autoDeleteUnusedLocalImages');
  });
});
