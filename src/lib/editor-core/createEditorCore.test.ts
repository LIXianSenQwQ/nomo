import { describe, expect, it } from 'vitest';
import { createEditorCore } from './createEditorCore';

describe('createEditorCore', () => {
  it('keeps Markdown as the observable editor state', () => {
    const editor = createEditorCore({ markdown: '# NewMd' });

    editor.setMarkdown('# NewMd\n\n阶段0');

    expect(editor.getMarkdown()).toBe('# NewMd\n\n阶段0');
    expect(editor.getSnapshot()).toMatchObject({
      markdown: '# NewMd\n\n阶段0',
      version: 1
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

    expect(events).toEqual(['0:subscribe:semantic', '0:runtime-options:source', '1:programmatic-update:source']);
  });

  it('serializes ProseMirror edits back to Markdown through EditorCore', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '# 标题\n\n正文', target });

    editor.execute({ type: 'setHeading', level: 2 });

    expect(editor.getMarkdown()).toContain('##');
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

    expect(editor.getMarkdown()).toContain('- [ ] 待办事项');
    expect(editor.getMarkdown()).toContain('| 列 1 | 列 2 |');
    expect(editor.getMarkdown()).toContain('$$\nE = mc^2\n$$');
    expect(editor.getMarkdown()).toContain('```mermaid');
  });

  it('renders editable HTML blocks with their original root element and attributes', () => {
    const target = document.createElement('div');
    createEditorCore({
      markdown: '<section class="demo-html-block" id="demo"><strong>HTML 块：</strong><span>允许渲染内联 HTML 内容。</span></section>',
      target
    });

    const htmlCard = target.querySelector('.html-card');
    const contentRoot = target.querySelector('.html-card > section.html-card-content.demo-html-block#demo');

    expect(htmlCard).not.toBeNull();
    expect(contentRoot).not.toBeNull();
    expect(contentRoot?.textContent).toContain('HTML 块：允许渲染内联 HTML 内容。');
  });

  it('scrolls to the nth heading via scrollToHeading command', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({
      markdown: '# First\n## Second\n### Third\n\n正文内容',
      target
    });

    // scrollToHeading 命令应成功执行（返回 true）
    const result = editor.execute({ type: 'scrollToHeading', headingIndex: 0, text: 'First', level: 1 });
    expect(result).toBe(true);

    // 执行第二个标题
    const result2 = editor.execute({ type: 'scrollToHeading', headingIndex: 1, text: 'Second', level: 2 });
    expect(result2).toBe(true);

    // 执行第三个标题
    const result3 = editor.execute({ type: 'scrollToHeading', headingIndex: 2, text: 'Third', level: 3 });
    expect(result3).toBe(true);
  });

  it('returns false for out-of-range headingIndex', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({
      markdown: '# Only One Heading',
      target
    });

    const result = editor.execute({ type: 'scrollToHeading', headingIndex: 5, text: 'Nonexistent', level: 1 });
    expect(result).toBe(false);
  });
});

