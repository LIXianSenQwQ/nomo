import { describe, expect, it } from 'vitest';
import {
  createTocBlock,
  createTocList,
  extractTocItems,
  removeTocBlocks,
  updateTocBlocks,
} from './tocService';

describe('tocService', () => {
  it('creates nested Markdown links from headings', () => {
    expect(createTocList('# 标题1\n\n## 标题2\n\n### 标题3')).toBe(
      '- [标题1](#标题1)\n  - [标题2](#标题2)\n    - [标题3](#标题3)',
    );
  });

  it('uses stable ids for duplicate headings', () => {
    expect(createTocList('# Intro\n\n## Intro')).toBe(
      '- [Intro](#intro)\n  - [Intro](#intro-2)',
    );
  });

  it('skips headings inside fenced code blocks and existing toc blocks', () => {
    const markdown = [
      '<!-- toc -->',
      '- [旧标题](#旧标题)',
      '<!-- /toc -->',
      '',
      '# 正文标题',
      '',
      '```md',
      '# 代码标题',
      '```',
    ].join('\n');

    expect(extractTocItems(markdown).map((item) => item.title)).toEqual(['正文标题']);
  });

  it('updates existing toc block content', () => {
    const markdown = [
      '<!-- toc -->',
      '- [旧标题](#旧标题)',
      '<!-- /toc -->',
      '',
      '# 新标题',
    ].join('\n');

    expect(updateTocBlocks(markdown)).toContain('- [新标题](#新标题)');
    expect(updateTocBlocks(markdown)).not.toContain('旧标题');
  });

  it('removes toc blocks without touching body content', () => {
    const markdown = `${createTocBlock('# 标题')}\n\n# 标题\n\n正文`;

    expect(removeTocBlocks(markdown).trim()).toBe('# 标题\n\n正文');
  });
});
