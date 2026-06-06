import { describe, expect, it } from 'vitest';
import { parseMarkdown, serializeMarkdown } from './markdown';
import { schema } from './schema';

describe('markdown serialization', () => {
  it('preserves blank paragraphs between non-paragraph blocks', () => {
    const input = '# 标题\n\n\n\n---\n\n\n\n## 下一节';

    expect(serializeMarkdown(parseMarkdown(input))).toBe(input);
  });

  it('preserves blank paragraphs around code and math blocks', () => {
    const input = [
      '```ts',
      'const value = 1;',
      '```',
      '',
      '',
      '$$',
      'E = mc^2',
      '$$',
      '',
      '',
      '<div>HTML</div>',
    ].join('\n');

    expect(serializeMarkdown(parseMarkdown(input))).toBe(input);
  });

  it('preserves blank paragraphs between list items', () => {
    const input = '- 第一项\n\n\n\n- 第二项';

    expect(serializeMarkdown(parseMarkdown(input))).toBe(input);
  });

  it('preserves blank paragraphs between different list blocks', () => {
    const input = '- 第一项\n\n\n\n1. 第二项';

    expect(serializeMarkdown(parseMarkdown(input))).toBe(input);
  });

  it('does not escape manual inline mark trigger characters in plain text', () => {
    const serialized = serializeMarkdown(parseMarkdown('use * and ~ manually')).trim();

    expect(serialized).toBe('use * and ~ manually');
    expect(serialized).not.toContain('\\*');
    expect(serialized).not.toContain('\\~');
  });

  it('keeps escaping other markdown-sensitive plain text characters', () => {
    const serialized = serializeMarkdown(parseMarkdown('use [x] and `code')).trim();

    expect(serialized).toBe('use \\[x\\] and \\`code');
  });

  it('serializes underline marks as u tags', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, [schema.text('123', [schema.marks.underline.create()])]),
    ]);

    expect(serializeMarkdown(doc).trim()).toBe('<u>123</u>');
  });

  it('parses u tags as underline marks', () => {
    const doc = parseMarkdown('<u>123</u>');
    let hasUnderline = false;
    doc.descendants((node) => {
      if (!node.isText) return true;
      hasUnderline = node.marks.some((mark) => mark.type === schema.marks.underline);
      return !hasUnderline;
    });

    expect(hasUnderline).toBe(true);
  });

  it('serializes highlight marks as mark tags', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, [schema.text('重点', [schema.marks.highlight.create()])]),
    ]);

    expect(serializeMarkdown(doc).trim()).toBe('<mark>重点</mark>');
  });

  it('parses mark tags as highlight marks', () => {
    const doc = parseMarkdown('<mark>重点</mark>');
    let hasHighlight = false;
    doc.descendants((node) => {
      if (!node.isText) return true;
      hasHighlight = node.marks.some((mark) => mark.type === schema.marks.highlight);
      return !hasHighlight;
    });

    expect(hasHighlight).toBe(true);
    expect(serializeMarkdown(doc).trim()).toBe('<mark>重点</mark>');
  });

  it('preserves highlight marks inside table cells', () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.table.create(null, [
        schema.nodes.table_row.create(null, [
          schema.nodes.table_header.create(null, [
            schema.nodes.paragraph.create(null, [
              schema.text('重点', [schema.marks.highlight.create()]),
            ]),
          ]),
        ]),
        schema.nodes.table_row.create(null, [
          schema.nodes.table_cell.create(null, [
            schema.nodes.paragraph.create(null, [
              schema.text('内容', [schema.marks.highlight.create()]),
            ]),
          ]),
        ]),
      ]),
    ]);

    expect(serializeMarkdown(doc).trim()).toBe(
      '| <mark>重点</mark> |\n| :--- |\n| <mark>内容</mark> |',
    );
  });

  it('round trips single-line footnotes', () => {
    const input = '正文内容[^1]\n\n[^1]: 脚注内容';

    expect(serializeMarkdown(parseMarkdown(input))).toBe(input);
  });

  it('preserves inline marks inside footnote definitions', () => {
    const input = '正文[^1]\n\n[^1]: **重点** [链接](https://example.com) `code`';

    expect(serializeMarkdown(parseMarkdown(input))).toBe(input);
  });

  it('round trips Markdown links with optional titles', () => {
    const plain = '[链接](https://example.com)';
    const titled = '[链接](https://example.com "说明")';

    expect(serializeMarkdown(parseMarkdown(plain)).trim()).toBe(plain);
    expect(serializeMarkdown(parseMarkdown(titled)).trim()).toBe(titled);
  });

  it('round trips Markdown images with alt and optional title', () => {
    const plain = '![截图](./assets/a.png)';
    const titled = '![截图](./assets/a.png "说明")';

    expect(serializeMarkdown(parseMarkdown(plain)).trim()).toBe(plain);
    expect(serializeMarkdown(parseMarkdown(titled)).trim()).toBe(titled);
  });

  it('allows common safe link targets', () => {
    const input = [
      '[相对](../docs/readme.md)',
      '[锚点](#标题)',
      '[邮件](mailto:user@example.com)',
    ].join(' ');

    expect(serializeMarkdown(parseMarkdown(input)).trim()).toBe(
      '[相对](../docs/readme.md) [锚点](#%E6%A0%87%E9%A2%98) [邮件](mailto:user@example.com)',
    );
  });

  it('does not create link marks for dangerous link protocols', () => {
    const doc = parseMarkdown(
      '[危险](javascript:alert(1)) [data](data:text/html,<script></script>)',
    );
    let hasLink = false;

    doc.descendants((node) => {
      if (!node.isText) return true;
      hasLink = node.marks.some((mark) => mark.type === schema.marks.link);
      return !hasLink;
    });

    expect(hasLink).toBe(false);
  });

  it('preserves non-numeric footnote ids', () => {
    const input = '正文[^note]\n\n[^note]: 说明';

    expect(serializeMarkdown(parseMarkdown(input))).toBe(input);
  });

  it('does not parse normal brackets as footnotes', () => {
    const doc = parseMarkdown('正文[不是脚注] [^缺少结束');

    expect(doc.child(0).type.name).toBe('paragraph');
    expect(doc.child(0).textContent).toBe('正文[不是脚注] [^缺少结束');
  });

  it('parses block comments as dedicated comment_block nodes', () => {
    const input = '<!--\n这里是一段注释\n可以多行\n-->';
    const doc = parseMarkdown(input);

    expect(doc.child(0).type.name).toBe('comment_block');
    expect(doc.child(0).attrs.content).toBe('这里是一段注释\n可以多行');
    expect(serializeMarkdown(doc).trim()).toBe(input);
  });

  it('parses inline comments as dedicated comment_inline nodes', () => {
    const input = '这是正文 <!-- 这里是行内注释 --> 后面继续正文。';
    const doc = parseMarkdown(input);
    const paragraph = doc.child(0);

    expect(paragraph.type.name).toBe('paragraph');
    expect(paragraph.child(1).type.name).toBe('comment_inline');
    expect(paragraph.child(1).attrs.content).toBe('这里是行内注释');
    expect(serializeMarkdown(doc).trim()).toBe(input);
  });

  it('keeps HTML blocks separate from Markdown comments', () => {
    const doc = parseMarkdown('<section>HTML</section>\n\n<!-- 注释 -->');

    expect(doc.child(0).type.name).toBe('html_block');
    expect(doc.child(1).type.name).toBe('comment_block');
    expect(serializeMarkdown(doc).trim()).toBe('<section>HTML</section>\n\n<!-- 注释 -->');
  });

  it('still reserves toc comments for toc_block parsing', () => {
    const input = '<!-- toc -->\n- [标题](#标题)\n<!-- /toc -->\n\n# 标题';
    const doc = parseMarkdown(input);

    expect(doc.child(0).type.name).toBe('toc_block');
    expect(doc.child(0).attrs.content).toBe('- [标题](#标题)');
  });

  it('parses image with align and width attributes', () => {
    const input = '![demo](./assets/demo.png){align=center width=60%}';
    const doc = parseMarkdown(input);
    const img = doc.child(0).child(0);

    expect(img.type.name).toBe('image');
    expect(img.attrs.src).toBe('./assets/demo.png');
    expect(img.attrs.align).toBe('center');
    expect(img.attrs.width).toBe('60%');
  });

  it('round-trips image with attributes', () => {
    const input = '![demo](./assets/demo.png){align=center width=60%}';
    expect(serializeMarkdown(parseMarkdown(input))).toBe(input);
  });

  it('parses image with px width', () => {
    const input = '![pic](./a.png){align=left width=600}';
    const doc = parseMarkdown(input);
    const img = doc.child(0).child(0);

    expect(img.attrs.align).toBe('left');
    expect(img.attrs.width).toBe('600');
  });

  it('parses image without attributes', () => {
    const input = '![plain](./plain.png)';
    const doc = parseMarkdown(input);
    const img = doc.child(0).child(0);

    expect(img.attrs.src).toBe('./plain.png');
    expect(img.attrs.align).toBeNull();
    expect(img.attrs.width).toBeNull();
  });
});
