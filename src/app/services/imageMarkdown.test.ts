import { describe, expect, it } from 'vitest';
import { createImageMarkdown, createImageMarkdownSrc } from './imageMarkdown';

describe('imageMarkdown', () => {
  it('creates assets markdown src by default', () => {
    expect(createImageMarkdownSrc('文档.md', '截图 1.png')).toBe('./assets/截图-1.png');
  });

  it('creates safe Markdown image snippets', () => {
    expect(createImageMarkdown('截[图]\n', './assets/a.png')).toBe('![截 图](./assets/a.png)');
  });
});
