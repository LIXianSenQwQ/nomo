import { describe, expect, it } from 'vitest';
import {
  createDefaultFrontMatterBlock,
  ensureFrontMatter,
  extractFrontMatterBlock,
  replaceFrontMatterContent,
  removeFrontMatter,
} from './frontMatter';

describe('front matter utilities', () => {
  it('parses fixed fields from YAML front matter', () => {
    const markdown = `---
title: 文档标题
created: 2026-06-05
updated: 2026-06-05
tags:
  - 笔记
  - Markdown
status: draft
---

# 正文`;

    const block = extractFrontMatterBlock(markdown);

    expect(block?.fields).toMatchObject({
      title: '文档标题',
      created: '2026-06-05',
      updated: '2026-06-05',
      tags: ['笔记', 'Markdown'],
      status: 'draft',
    });
    expect(block?.body).toBe('# 正文');
  });

  it('recognizes CRLF front matter delimiters', () => {
    const markdown = '---\r\ntitle: Windows\r\n---\r\n\r\n# 正文';

    const block = extractFrontMatterBlock(markdown);

    expect(block?.lineEnding).toBe('\r\n');
    expect(block?.fields.title).toBe('Windows');
    expect(block?.body).toBe('# 正文');
  });

  it('returns null when no front matter exists', () => {
    expect(extractFrontMatterBlock('# 正文')).toBeNull();
  });

  it('keeps raw content even when some fields cannot be structured', () => {
    const markdown = '---\ntitle: 文档\nbad yaml line\n---\n正文';

    const block = extractFrontMatterBlock(markdown);

    expect(block?.raw).toBe('---\ntitle: 文档\nbad yaml line\n---\n');
    expect(block?.fields.parseWarning).toContain('原文已保留');
  });

  it('creates the default template with the provided date', () => {
    expect(createDefaultFrontMatterBlock('2026-06-05')).toBe(
      [
        '---',
        'title: 文档标题',
        'created: 2026-06-05',
        'updated: 2026-06-05',
        'tags:',
        '  - 笔记',
        '  - Markdown',
        'status: draft',
        '---',
        '',
      ].join('\n'),
    );
  });

  it('inserts front matter without changing existing front matter', () => {
    const markdown = '---\ntitle: 已有\n---\n正文';

    expect(ensureFrontMatter(markdown, '2026-06-05')).toBe(markdown);
    expect(ensureFrontMatter('# 正文', '2026-06-05')).toContain('created: 2026-06-05');
  });

  it('replaces only the front matter content', () => {
    const markdown = '---\ntitle: 旧标题\n---\n\n# 正文';

    expect(replaceFrontMatterContent(markdown, 'title: 新标题')).toBe(
      '---\ntitle: 新标题\n---\n\n# 正文',
    );
  });

  it('removes only the front matter block', () => {
    const markdown = '---\ntitle: 旧标题\n---\n\n# 正文';

    expect(removeFrontMatter(markdown)).toBe('# 正文');
    expect(removeFrontMatter('# 正文')).toBe('# 正文');
  });
});
