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
});
