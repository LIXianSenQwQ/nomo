import { describe, expect, it } from 'vitest';
import { createEditorCore } from './createEditorCore';
import { parseMarkdown, serializeMarkdown } from './markdown';

describe('callout', () => {
  it('parses GitHub alert syntax into a callout node', () => {
    const doc = parseMarkdown('> [!NOTE]\n> 内容');

    expect(doc.child(0).type.name).toBe('callout');
    expect(doc.child(0).attrs.type).toBe('note');
    expect(doc.child(0).textContent).toBe('内容');
  });

  it('serializes callout nodes back to GitHub alert syntax', () => {
    const markdown = serializeMarkdown(parseMarkdown('> [!WARNING]\n> 注意内容')).trim();

    expect(markdown).toBe('> [!WARNING]\n> 注意内容');
  });

  it('keeps an empty callout inserted from the toolbar command', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '', target });

    expect(editor.execute({ type: 'insertCallout' })).toBe(true);
    expect(editor.getMarkdown()).toContain('> [!NOTE]');
    expect(target.querySelector('.callout-card')).not.toBeNull();

    editor.destroy();
    target.remove();
  });

  it('opens the type picker and applies the selected callout type', () => {
    const target = document.createElement('div');
    const editor = createEditorCore({ markdown: '', target });

    editor.execute({ type: 'insertCallout' });
    const button = target.querySelector<HTMLButtonElement>('.callout-type-btn');
    expect(button).not.toBeNull();
    button?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

    const callout = target.querySelector('.callout-card');
    expect(callout?.classList.contains('is-picker-open')).toBe(true);

    const picker = target.querySelector('.callout-type-picker');
    expect(picker).not.toBeNull();

    const tipItem = target.querySelector<HTMLElement>(
      '.callout-type-picker-item[data-callout-type="tip"]',
    );
    tipItem?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

    expect(editor.getMarkdown()).toContain('> [!TIP]');
    expect(callout?.classList.contains('is-picker-open')).toBe(false);
    expect(button?.getAttribute('aria-expanded')).toBe('false');

    editor.destroy();
    target.remove();
  });
});
