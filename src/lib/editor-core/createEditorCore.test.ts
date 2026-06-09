import { describe, expect, it } from 'vitest';
import type { EditorView } from 'prosemirror-view';
import { createEditorCore } from './createEditorCore';

describe('createEditorCore', () => {
  it('keeps Markdown as the observable editor state', () => {
    const editor = createEditorCore({ markdown: '# Nomo' });

    editor.setMarkdown('# Nomo\n\n阶段0');

    expect(editor.getMarkdown()).toBe('# Nomo\n\n阶段0');
    expect(editor.getSnapshot()).toMatchObject({
      markdown: '# Nomo\n\n阶段0',
      version: 1,
    });
  });

  it('emits immutable change events through subscribe', () => {
    const editor = createEditorCore({ markdown: '' });
    const events: string[] = [];

    editor.subscribe((event) => {
      events.push(`${event.version}:${event.reason}:${event.mode}`);
    });

    editor.updateOptions({ mode: 'source' });
    editor.setMarkdown('正文');

    expect(events).toEqual([
      '0:subscribe:semantic',
      '0:runtime-options:source',
      '1:programmatic-update:source',
    ]);
  });

  it('defers ProseMirror state rebuild for source input until semantic mode resumes', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '# Old', mode: 'source', target });
    const view = (editor as unknown as { view: EditorView }).view;

    editor.setMarkdown('# New', { sourceInput: true });

    expect(editor.getMarkdown()).toBe('# New');
    expect(view.state.doc.textContent).toBe('Old');

    editor.updateOptions({ mode: 'semantic' });

    expect(view.state.doc.textContent).toBe('New');
  });

  it('emits pending inline mark snapshots for toolbar state', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '', target });
    const events: boolean[] = [];

    editor.subscribe((event) => {
      events.push(event.pendingInlineMarks.strong);
    });

    editor.execute({ type: 'toggleBold' });

    expect(events).toEqual([false, true]);
  });

  it('emits pending highlight snapshots for toolbar state', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '', target });
    const events: boolean[] = [];

    editor.subscribe((event) => {
      events.push(event.pendingInlineMarks.highlight);
    });

    editor.execute({ type: 'toggleHighlight' });

    expect(events).toEqual([false, true]);
  });

  it('does not enter pending inline marks in source mode', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '', target });

    editor.updateOptions({ mode: 'source' });

    expect(editor.execute({ type: 'toggleBold' })).toBe(false);
    expect(editor.isPendingMarkActive?.('strong')).toBe(false);
  });

  it('clears pending inline marks before text is typed', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '', target });

    expect(editor.execute({ type: 'toggleBold' })).toBe(true);
    expect(editor.isPendingMarkActive?.('strong')).toBe(true);

    expect(editor.execute({ type: 'clearInlineStyles' })).toBe(true);
    expect(editor.isPendingMarkActive?.('strong')).toBe(false);
    expect(editor.getMarkdown()).toBe('');
  });

  it('serializes ProseMirror edits back to Markdown through EditorCore', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '# 标题\n\n正文', target });

    editor.execute({ type: 'setHeading', level: 2 });

    expect(editor.getMarkdown()).toContain('##');
  });

  it('exposes the active link snapshot through EditorCore', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({
      markdown: '[链接](https://example.com "说明")',
      target,
    });

    expect(editor.getActiveLink()).toMatchObject({
      href: 'https://example.com',
      title: '说明',
      text: '链接',
      active: true,
    });
  });

  it('keeps front matter when semantic edits serialize Markdown', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '---\ntitle: Demo\n---\n# 标题', target });

    editor.execute({ type: 'setHeading', level: 2 });

    expect(editor.getMarkdown().startsWith('---\ntitle: Demo\n---\n')).toBe(true);
  });

  it('inserts technical document snippets as Markdown', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '# 技术文档', target });

    editor.execute({ type: 'toggleTaskList' });
    editor.execute({ type: 'insertTable', rows: 1, columns: 2 });
    editor.execute({ type: 'insertMathBlock', tex: 'E = mc^2' });
    editor.execute({ type: 'insertMermaidBlock', code: 'flowchart TD\n  A --> B' });

    expect(editor.getMarkdown()).toContain('- [ ]');
    expect(editor.getMarkdown()).toContain('技术文档');
    expect(editor.getMarkdown()).toContain('| :--- | :--- |');
    expect(editor.getMarkdown()).toContain('$$\nE = mc^2\n$$');
    expect(editor.getMarkdown()).toContain('```mermaid');
  });

  it('inserts a toc block as Markdown at the semantic selection', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '# 标题1\n\n## 标题2', target });

    expect(editor.execute({ type: 'insertToc' })).toBe(true);
    expect(editor.getMarkdown()).toContain('<!-- toc -->');
    expect(editor.getMarkdown()).toContain('- [标题1](#标题1)');
    expect(editor.getMarkdown()).toContain('  - [标题2](#标题2)');
    expect(target.querySelector('.toc-block')).not.toBeNull();
  });

  it('updates toc block content when headings change', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({
      markdown: '<!-- toc -->\n- [旧标题](#旧标题)\n<!-- /toc -->\n\n# 新标题',
      target,
    });

    expect(editor.getMarkdown()).toContain('- [新标题](#新标题)');
    expect(editor.getMarkdown()).not.toContain('旧标题');
  });

  it('renders an empty toc placeholder when no headings exist', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '正文', target });

    editor.execute({ type: 'insertToc' });

    expect(editor.getMarkdown()).toContain('<!-- toc -->\n<!-- /toc -->');
    expect(target.querySelector('.toc-empty')?.textContent).toContain(
      'This document has no headings yet',
    );
  });

  it('keeps toc marker examples in inline code as ordinary Markdown text', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '', target });
    const markdown = '正文 `<!-- toc --><!-- /toc -->` 后续';

    editor.setMarkdown(markdown);

    expect(editor.getMarkdown()).toBe(markdown);
    expect(target.querySelector('.toc-block')).toBeNull();
  });

  it('does not rewrite adjacent toc marker text during semantic transactions', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '', target });
    const view = (editor as unknown as { view: EditorView }).view;

    view.dispatch(view.state.tr.insertText('正文 '));
    view.dispatch(view.state.tr.insertText('<!-- toc --><!-- /toc -->'));
    view.dispatch(view.state.tr.insertText(' 后续'));

    expect(editor.getMarkdown()).toBe('正文 <!-- toc --><!-- /toc --> 后续');
    expect(editor.getMarkdown()).not.toContain('-- >');
    expect(target.querySelector('.toc-block')).toBeNull();
  });

  it('keeps an existing toc block stable when typing above it in semantic mode', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '<!-- toc -->\n<!-- /toc -->', target });
    const view = (editor as unknown as { view: EditorView }).view;

    view.dispatch(view.state.tr.insertText('上方文字', 0));

    expect(editor.getMarkdown()).toBe('上方文字\n\n<!-- toc -->\n<!-- /toc -->\n');
    expect(target.querySelector('.toc-block')).not.toBeNull();
  });

  it('inserts default YAML front matter without duplicating existing metadata', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '# 正文', target });

    expect(editor.execute({ type: 'insertFrontMatter' })).toBe(true);
    expect(editor.getMarkdown()).toContain('title: 文档标题');
    expect(editor.getMarkdown()).toContain('tags:\n  - 笔记\n  - Markdown');
    expect(editor.getMarkdown()).toContain('# 正文');

    const withFrontMatter = editor.getMarkdown();
    expect(editor.execute({ type: 'insertFrontMatter' })).toBe(true);
    expect(editor.getMarkdown()).toBe(withFrontMatter);
  });

  it('jumps to the heading matched by toc link id instead of row position only', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({
      markdown: '<!-- toc -->\n<!-- /toc -->\n\n# Same\n\n## Same',
      target,
    });

    const secondTocLink = target.querySelectorAll<HTMLButtonElement>('.toc-link')[1];
    secondTocLink.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    editor.execute({ type: 'setHeading', level: 3 });

    expect(editor.getMarkdown()).toContain('# Same\n\n### Same');
    expect(editor.getMarkdown()).not.toContain('### Same\n\n## Same');
  });

  it('toggles bullet and ordered lists back to plain paragraphs', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '列表项', target });

    editor.execute({ type: 'toggleBulletList' });
    expect(editor.getMarkdown()).toBe('- 列表项');

    editor.execute({ type: 'toggleBulletList' });
    expect(editor.getMarkdown()).toBe('列表项');

    editor.execute({ type: 'toggleOrderedList' });
    expect(editor.getMarkdown()).toBe('1. 列表项');

    editor.execute({ type: 'toggleOrderedList' });
    expect(editor.getMarkdown()).toBe('列表项');
  });

  it('converts between ordered and bullet lists while preserving task markers', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '1. [ ] 待办事项', target });

    editor.execute({ type: 'toggleBulletList' });
    expect(editor.getMarkdown()).toBe('- [ ] 待办事项');

    editor.execute({ type: 'toggleOrderedList' });
    expect(editor.getMarkdown()).toBe('1. [ ] 待办事项');
  });

  it('removes task markers when cancelling task lists through the same list shortcut', () => {
    const bulletTarget = document.createElement('div');
    const bulletEditor = createEditorCore({ markdown: '- [ ] 待办事项', target: bulletTarget });

    bulletEditor.execute({ type: 'toggleBulletList' });
    expect(bulletEditor.getMarkdown()).toBe('待办事项');

    const orderedTarget = document.createElement('div');
    const orderedEditor = createEditorCore({ markdown: '1. [x] 已完成', target: orderedTarget });

    orderedEditor.execute({ type: 'toggleOrderedList' });
    expect(orderedEditor.getMarkdown()).toBe('已完成');
  });

  it('removes task markers through the task shortcut while preserving the list type', () => {
    const bulletTarget = document.createElement('div');
    const bulletEditor = createEditorCore({ markdown: '- [ ] 待办事项', target: bulletTarget });

    bulletEditor.execute({ type: 'toggleTaskList' });
    expect(bulletEditor.getMarkdown()).toBe('- 待办事项');

    const orderedTarget = document.createElement('div');
    const orderedEditor = createEditorCore({ markdown: '1. [x] 已完成', target: orderedTarget });

    orderedEditor.execute({ type: 'toggleTaskList' });
    expect(orderedEditor.getMarkdown()).toBe('1. 已完成');
  });

  it('toggles task lists from and back to plain paragraphs', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '待办事项', target });

    editor.execute({ type: 'toggleTaskList' });
    expect(editor.getMarkdown()).toBe('- [ ] 待办事项');

    editor.execute({ type: 'toggleTaskList' });
    expect(editor.getMarkdown()).toBe('- 待办事项');
  });

  it('renders editable HTML blocks with their original root element and attributes', () => {
    const target = document.createElement('div');
    createEditorCore({
      markdown:
        '<section class="demo-html-block" id="demo"><strong>HTML 块：</strong><span>允许渲染内联 HTML 内容。</span></section>',
      target,
    });

    const htmlCard = target.querySelector('.html-card');
    const contentRoot = target.querySelector(
      '.html-card > section.html-card-content.demo-html-block#demo',
    );

    expect(htmlCard).not.toBeNull();
    expect(contentRoot).not.toBeNull();
    expect(contentRoot?.textContent?.replace(/\*\*/g, '')).toContain(
      'HTML 块：允许渲染内联 HTML 内容。',
    );
  });

  it('scrolls to the nth heading via scrollToHeading command', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({
      markdown: '# First\n## Second\n### Third\n\n正文内容',
      target,
    });

    // scrollToHeading 命令应成功执行（返回 true）
    const result = editor.execute({
      type: 'scrollToHeading',
      headingIndex: 0,
      text: 'First',
      level: 1,
    });
    expect(result).toBe(true);

    // 执行第二个标题
    const result2 = editor.execute({
      type: 'scrollToHeading',
      headingIndex: 1,
      text: 'Second',
      level: 2,
    });
    expect(result2).toBe(true);

    // 执行第三个标题
    const result3 = editor.execute({
      type: 'scrollToHeading',
      headingIndex: 2,
      text: 'Third',
      level: 3,
    });
    expect(result3).toBe(true);
  });

  it('returns false for out-of-range headingIndex', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({
      markdown: '# Only One Heading',
      target,
    });

    const result = editor.execute({
      type: 'scrollToHeading',
      headingIndex: 5,
      text: 'Nonexistent',
      level: 1,
    });
    expect(result).toBe(false);
  });
});
