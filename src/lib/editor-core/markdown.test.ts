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

  it('preserves non-numeric footnote ids', () => {
    const input = '正文[^note]\n\n[^note]: 说明';

    expect(serializeMarkdown(parseMarkdown(input))).toBe(input);
  });

  it('does not parse normal brackets as footnotes', () => {
    const doc = parseMarkdown('正文[不是脚注] [^缺少结束');

    expect(doc.child(0).type.name).toBe('paragraph');
    expect(doc.child(0).textContent).toBe('正文[不是脚注] [^缺少结束');
  });
});
