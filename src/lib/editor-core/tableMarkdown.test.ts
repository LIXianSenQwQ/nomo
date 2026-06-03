import { describe, expect, it } from 'vitest';
import { parseMarkdown, serializeMarkdown } from './markdown';

describe('table Markdown editing', () => {
  it('round-trips GFM table alignment markers', () => {
    const markdown = '| A | B | C |\n| :--- | :---: | ---: |\n| x | y | z |';

    expect(serializeMarkdown(parseMarkdown(markdown))).toContain('| :--- | :---: | ---: |');
  });

  it('keeps table cell text during Markdown serialization', () => {
    const markdown = '| A | B |\n| :--- | :--- |\n| strong | code |';

    const serialized = serializeMarkdown(parseMarkdown(markdown));

    expect(serialized).toContain('| strong | code |');
  });
});

describe('HTML block round-trip', () => {
  it('preserves editable HTML block with inline tags', () => {
    const html =
      '<section class="demo-html-block"><strong>HTML 块：</strong><span>允许渲染内联 HTML 内容。</span></section>';
    const markdown = `${html}\n`;

    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();

    expect(serialized).toContain('<section class="demo-html-block">');
    expect(serialized).toContain('<strong>');
    expect(serialized).toContain('</strong>');
    expect(serialized).toContain('允许渲染内联 HTML 内容。');
    expect(serialized).toContain('</section>');
  });

  it('preserves fallback HTML as text (no content loss)', () => {
    const markdown = '<p>fallback paragraph</p>\n';

    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();

    // fallback HTML 作为原始文本保留，不被丢弃
    expect(serialized.length).toBeGreaterThan(0);
    expect(serialized).toContain('<p>fallback paragraph</p>');
  });

  it('preserves script tag HTML as text without executing', () => {
    const markdown = '<script type="text">hello</script>\n';

    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();

    // script 标签作为 fallback paragraph 文本保留，< > 会被 markdown-it 的 html_block token 丢给分类器判断
    // 但 token content 保留原始文本，序列化后会还原
    expect(serialized.length).toBeGreaterThan(0);
    expect(serialized).toContain('script');
  });

  it('round-trips section with link', () => {
    const html = '<section><a href="https://example.com">click here</a></section>';
    const markdown = `${html}\n`;

    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();

    expect(serialized).toContain('href="https://example.com"');
    expect(serialized).toContain('click here');
  });

  it('round-trips section with code', () => {
    const html = '<section><code>const x = 1;</code></section>';
    const markdown = `${html}\n`;

    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();

    expect(serialized).toContain('<section>');
    expect(serialized).toContain('<code>');
    expect(serialized).toContain('</code>');
    expect(serialized).toContain('</section>');
  });

  it('round-trips div with id', () => {
    const html = '<div id="main">text</div>';
    const markdown = `${html}\n`;

    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();

    expect(serialized).toContain('id="main"');
  });
});
