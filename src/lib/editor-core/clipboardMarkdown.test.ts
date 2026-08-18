import { describe, expect, it } from 'vitest';
import { classifyClipboardMarkdown } from './clipboardMarkdown';

describe('clipboard Markdown classification', () => {
  it.each([
    '普通文本',
    '第一行\n第二行',
    '第一段\n\n第二段',
    'use * and ~ manually',
    'price $100',
  ])('keeps ordinary text plain: %s', (text) => {
    expect(classifyClipboardMarkdown(text).kind).toBe('plain');
  });

  it.each([
    '# 标题',
    '- 第一项\n- 第二项',
    '> 引用',
    '---',
    '| A | B |\n| --- | --- |\n| 1 | 2 |',
    '```ts\nconst value = 1;\n```',
    '**重点**',
    '[链接](https://example.com)',
    '![图片](./image.png)',
    '$x^2$',
    '$$\nE = mc^2\n$$',
    '> [!NOTE]\n> 内容',
  ])('detects semantic Markdown: %s', (text) => {
    expect(classifyClipboardMarkdown(text).kind).toBe('markdown');
  });

  it('detects a complete front matter document separately', () => {
    const result = classifyClipboardMarkdown('---\ntitle: 测试\n---\n\n# 正文');

    expect(result.kind).toBe('front-matter');
    expect(result.doc.attrs.frontMatterPrefix).toBe('---\ntitle: 测试\n---\n\n');
    expect(result.doc.firstChild?.type.name).toBe('heading');
  });
});
