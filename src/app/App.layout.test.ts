import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('App outline layout', () => {
  const appSource = readFileSync(resolve(__dirname, 'App.svelte'), 'utf-8');
  const editorSource = readFileSync(
    resolve(__dirname, 'components/EditorWorkspace.svelte'),
    'utf-8',
  );
  const toolbarSource = readFileSync(resolve(__dirname, 'components/EditorToolbar.svelte'), 'utf-8');
  const titleBarSource = readFileSync(resolve(__dirname, 'components/AppTitleBar.svelte'), 'utf-8');
  const frontMatterCardSource = readFileSync(
    resolve(__dirname, 'components/FrontMatterCard.svelte'),
    'utf-8',
  );
  const appCommandsSource = readFileSync(resolve(__dirname, 'services/appCommands.ts'), 'utf-8');
  const tauriMenuSource = readFileSync(
    resolve(__dirname, '../../src-tauri/src/window/menu.rs'),
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

  it('keeps outline navigation in the current editor mode', () => {
    const jumpStart = outlineInteractionSource.indexOf('function jumpToOutlineItem');
    const jumpEnd = outlineInteractionSource.indexOf('function updateActiveOutlineFromSourceScroll');
    const jumpSource = outlineInteractionSource.slice(jumpStart, jumpEnd);

    expect(jumpSource).not.toContain("setMode('source')");
    expect(jumpSource).toContain('options.setActiveOutlineId(item.id);');
    expect(jumpSource).toContain('scrollSemanticToAnchor(options.getOutline(), options.getSemanticPane()');
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
    expect(editorInteractionSource).toContain('options.getSourcePane().scrollTop = restoreScrollTop;');
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

  it('forwards native menu events to desktop command handlers', () => {
    const tauriLibSource = readFileSync(resolve(__dirname, '../../src-tauri/src/lib.rs'), 'utf-8');
    const tauriCommandsSource = readFileSync(
      resolve(__dirname, '../../src-tauri/src/window/commands.rs'),
      'utf-8',
    );

    expect(tauriLibSource).toContain('install_window_menu(app.handle(), &window)');
    expect(tauriCommandsSource).toContain('install_window_menu(&app, &window)');
    expect(tauriMenuSource).toContain('window.on_menu_event(|window, event|');
    expect(tauriMenuSource).toContain('window.emit("newmd://menu-command", command)');
    expect(tauriMenuSource).toContain('window.app_handle().exit(0)');
    expect(tauriMenuSource).toContain('format!("open-recent:{}", doc.path)');
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
});
