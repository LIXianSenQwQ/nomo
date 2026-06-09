import { describe, expect, it } from 'vitest';
import { renderMarkdownPreview, resolvePreviewAssetSrc } from './preview';

describe('quicklook preview renderer', () => {
  it('renders markdown with callouts, task lists, tables and math', () => {
    const html = renderMarkdownPreview(
      [
        '# 标题',
        '',
        '> [!WARNING]',
        '> 请注意',
        '',
        '- [x] 完成',
        '- [ ] 待办',
        '',
        '| A | B |',
        '| --- | --- |',
        '| 1 | 2 |',
        '',
        '$E=mc^2$',
      ].join('\n'),
      { fileName: 'demo.md' },
    );

    expect(html).toContain('data-callout-type="warning"');
    expect(html).toContain('任务状态');
    expect(html).toContain('<table>');
    expect(html).toContain('katex');
  });

  it('blocks dangerous links and script html', () => {
    const html = renderMarkdownPreview(
      '[bad](javascript:alert(1))\n\n<script>alert(1)</script>\n\n<a onclick="evil()" href="https://example.com">ok</a>',
    );

    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).toContain('https://example.com');
  });

  it('resolves relative image paths against the markdown directory', () => {
    const html = renderMarkdownPreview('![图](<assets/a b.png>){width=240}', {
      documentDirectory: '/Users/qingyu/Notes',
    });

    expect(html).toContain('file:///Users/qingyu/Notes/assets/a%20b.png');
    expect(html).toContain('width="240"');
  });

  it('does not allow data image sources', () => {
    const html = renderMarkdownPreview('![x](data:image/svg+xml,<svg></svg>)');

    expect(html).toContain('image-node-placeholder');
    expect(html).not.toContain('data:image');
  });

  it('converts absolute paths to file urls', () => {
    expect(resolvePreviewAssetSrc('/Users/qingyu/Pictures/a.png')).toBe(
      'file:///Users/qingyu/Pictures/a.png',
    );
  });
});
