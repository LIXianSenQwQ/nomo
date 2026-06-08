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
  const settingsDrawerSource = readFileSync(
    resolve(__dirname, 'components/SettingsDrawer.svelte'),
    'utf-8',
  );
  const linkQuickEditorSource = readFileSync(
    resolve(__dirname, 'components/LinkQuickEditor.svelte'),
    'utf-8',
  );
  const titleBarSource = readFileSync(resolve(__dirname, 'components/AppTitleBar.svelte'), 'utf-8');
  const documentTabsSource = readFileSync(
    resolve(__dirname, 'components/DocumentTabs.svelte'),
    'utf-8',
  );
  const frontMatterCardSource = readFileSync(
    resolve(__dirname, 'components/FrontMatterCard.svelte'),
    'utf-8',
  );
  const appCommandsSource = readFileSync(resolve(__dirname, 'services/appCommands.ts'), 'utf-8');
  const desktopWindowSource = readFileSync(
    resolve(__dirname, 'services/desktopWindow.ts'),
    'utf-8',
  );
  const tauriMenuSource = readFileSync(
    resolve(__dirname, '../../src-tauri/src/window/menu.rs'),
    'utf-8',
  );
  const tauriLibSource = readFileSync(resolve(__dirname, '../../src-tauri/src/lib.rs'), 'utf-8');
  const tauriTraySource = readFileSync(
    resolve(__dirname, '../../src-tauri/src/window/tray.rs'),
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
    expect(appSource).toContain('contentWidthPercent = 68');
    expect(appSource).toContain('{contentWidthPercent}');
    expect(styles).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*calc\(var\(--md-editor-content-width-percent\) \* 1cqw\)\);/,
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
    expect(toolbarSource).toContain("type: 'insertDiagramBlock'");
    expect(toolbarSource).toContain('aria-label="插入图表"');
    expect(titleBarSource).toContain('DIAGRAM_TEMPLATES');
    expect(titleBarSource).toContain('insertDiagram(template.type');
    expect(titleBarSource).not.toContain("comingSoon('图表'");
    expect(appCommandsSource).toContain("command.startsWith('menu-chart:')");
    expect(appCommandsSource).toContain("type: 'insertDiagramBlock'");
    expect(tauriMenuSource).toContain('SubmenuBuilder::new(app, "图表")');
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
    expect(tauriMenuSource).toContain('with_id("menu-highlight", "高亮")');
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
    expect(tauriMenuSource).toContain('with_id("menu-link", "超链接")');
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
    expect(tauriMenuSource).toContain('with_id("menu-comment", "注释")');
    expect(tauriMenuSource).toContain('with_id("menu-comment-block", "注释块")');
  });

  it('forwards native menu events to desktop command handlers', () => {
    const tauriLibSource = readFileSync(resolve(__dirname, '../../src-tauri/src/lib.rs'), 'utf-8');
    const tauriCommandsSource = readFileSync(
      resolve(__dirname, '../../src-tauri/src/window/commands.rs'),
      'utf-8',
    );

    expect(tauriLibSource).toContain('install_window_menu(app.handle(), &window)');
    expect(tauriCommandsSource).toContain('install_window_menu(&app, &window)');
    expect(tauriMenuSource).toContain('window.on_menu_event(|window, event|');
    expect(tauriMenuSource).toContain('window.emit("nomo://menu-command", command)');
    expect(tauriMenuSource).toContain('window.app_handle().exit(0)');
    expect(tauriMenuSource).toContain('format!("open-recent:{}:{}", entry.entry_type, entry.path)');
    expect(appCommandsSource).toContain("command === 'new-window'");
    expect(appCommandsSource).toContain("command.startsWith('open-recent:')");
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

  it('keeps global explorer and window controls in the single titlebar chrome', () => {
    expect(titleBarSource).toContain('sidebar-toggle-btn');
    expect(titleBarSource).toContain('PanelLeftClose');
    expect(titleBarSource).toContain('PanelLeftOpen');
    expect(titleBarSource).toContain('nomoAppIcon');
    expect(titleBarSource).toContain('class="app-logo"');
    expect(titleBarSource).toContain('aria-hidden="true"');
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
    expect(styles).toMatch(/\.titlebar\s*\{[\s\S]*?height:\s*42px;/);
    expect(styles).toMatch(/\.titlebar-row\.bottom-row\s*\{[\s\S]*?display:\s*none;/);
    expect(styles).toMatch(/\.app-logo\s*\{[\s\S]*?width:\s*20px;/);
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

  it('moves editor appearance controls into the settings drawer draft flow', () => {
    expect(settingsDrawerSource).toContain('编辑器外观');
    expect(settingsDrawerSource).toContain('export let fontSize');
    expect(settingsDrawerSource).toContain('export let lineHeight');
    expect(settingsDrawerSource).toContain("export let blockStyle: 'classic' | 'modern'");
    expect(settingsDrawerSource).toContain('draftFontSize = fontSize');
    expect(settingsDrawerSource).toContain('draftLineHeight = lineHeight');
    expect(settingsDrawerSource).toContain('draftBlockStyle = blockStyle');
    expect(settingsDrawerSource).toContain('aria-label="提示块样式"');
    expect(settingsDrawerSource).toContain('draftFolderBehavior = folderOpenDefaultBehavior');
    expect(settingsDrawerSource).toContain('打开文件夹默认行为');
    expect(settingsDrawerSource).toContain('文件预览标签');
    expect(settingsDrawerSource).toContain('toggleFilePreviewEnabled');
    expect(settingsDrawerSource).toContain('显示文档统计');
    expect(settingsDrawerSource).toContain('文档统计类型');
    expect(settingsDrawerSource).toContain('setDraftWritingStatsMetric');
    expect(settingsDrawerSource).toContain('自动保存');
    expect(settingsDrawerSource).toContain('toggleAutoSaveEnabled');
    expect(settingsDrawerSource).toContain('关闭到托盘');
    expect(settingsDrawerSource).toContain('toggleCloseToTrayEnabled');
    expect(settingsDrawerSource).toContain('draftFolderBehavior,');
    expect(settingsDrawerSource).toContain('draftFilePreviewEnabled,');
    expect(settingsDrawerSource).toContain('draftWritingStatsVisible,');
    expect(settingsDrawerSource).toContain('draftWritingStatsMetric,');
    expect(settingsDrawerSource).toContain('draftAutoSaveEnabled,');
    expect(settingsDrawerSource).toContain('draftCloseToTrayEnabled,');
    expect(appSource).toContain('updateFontSizeValue(nextAppearanceSettings.fontSize)');
    expect(appSource).toContain('updateLineHeightValue(nextAppearanceSettings.lineHeight)');
    expect(appSource).toContain('updateBlockStyle(nextAppearanceSettings.blockStyle)');
    expect(appSource).toContain('filePreviewEnabled = true');
    expect(appSource).toContain('autoSaveEnabled = false');
    expect(appSource).toContain('closeToTrayEnabled = false');
    expect(appSource).toContain("updateAppSetting('filePreviewEnabled', nextFilePreviewEnabled)");
    expect(appSource).toContain("updateAppSetting('writingStatsVisible'");
    expect(appSource).toContain("updateAppSetting('writingStatsMetric'");
    expect(appSource).toContain("updateAppSetting('autoSaveEnabled', nextAutoSaveEnabled)");
    expect(appSource).toContain("updateAppSetting('closeToTrayEnabled', nextCloseToTrayEnabled)");
    expect(appSource).toContain('autoSaveEnabled && desktopEnabled && dirty && nativePath');
    expect(appSource).toContain('previewTabId = filePreviewEnabled ? targetTab.id : null');
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
    expect(tauriTraySource).toContain('set_tray_active');
    expect(tauriTraySource).toContain('"退出"');
    expect(tauriTraySource).toContain('TrayIconEvent::DoubleClick');
    expect(tauriTraySource).toContain('closeToTrayEnabled');
  });

  it('removes application-level workspace storage path configuration', () => {
    expect(settingsDrawerSource).not.toContain('工作区存储路径');
    expect(settingsDrawerSource).not.toContain('workspaceDir');
    expect(settingsDrawerSource).not.toContain('browseFolder');
    expect(settingsDrawerSource).not.toContain('selectedDir');

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
    expect(settingsDrawerSource).toContain('自动清理本地图片');
    expect(settingsDrawerSource).toContain('toggleAutoDeleteUnusedLocalImages');
    expect(appSource).toContain('!imageSettings.autoDeleteUnusedLocalImages');
  });
});
