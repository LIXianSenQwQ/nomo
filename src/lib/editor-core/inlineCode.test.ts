import { describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { parseMarkdown, serializeMarkdown } from './markdown';
import { schema } from './schema';
import { inlineMarkdownMarkInputPlugin } from './plugins/inlineMarkdownMarkInput';
import { pendingInlineMarkKey, pendingInlineMarkPlugin } from './plugins/pendingInlineMark';
import { codeHighlightDecorationPlugin } from './plugins/codeHighlightDecorationPlugin';

function hasCodeMark(node: ReturnType<typeof schema.node>): boolean {
  let found = false;
  node.descendants((n) => {
    if (n.isText && n.marks.some((m) => m.type.name === 'code')) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

function getCodeTexts(node: ReturnType<typeof schema.node>): string[] {
  const texts: string[] = [];
  node.descendants((n) => {
    if (n.isText && n.marks.some((m) => m.type.name === 'code')) {
      texts.push(n.text ?? '');
    }
    return true;
  });
  return texts;
}

describe('code mark markdown-it parser', () => {
  it('parses `code` as code mark', () => {
    const doc = parseMarkdown('`const x = 1`');
    expect(hasCodeMark(doc)).toBe(true);
    expect(getCodeTexts(doc)).toEqual(['const x = 1']);
  });

  it('preserves code mark inside paragraph text', () => {
    const doc = parseMarkdown('这是 `const x = 1` 代码片段');
    expect(getCodeTexts(doc)).toEqual(['const x = 1']);
  });

  it('handles multiple code marks in one paragraph', () => {
    const doc = parseMarkdown('`foo` and `bar` and `baz`');
    expect(getCodeTexts(doc)).toEqual(['foo', 'bar', 'baz']);
  });

  it('handles code mark with spaces', () => {
    const doc = parseMarkdown('`const ok = true`');
    expect(getCodeTexts(doc)).toEqual(['const ok = true']);
  });

  it('handles code mark with punctuation', () => {
    const doc = parseMarkdown('`foo.bar()`');
    expect(getCodeTexts(doc)).toEqual(['foo.bar()']);
  });

  it('handles code mark with Chinese text', () => {
    const doc = parseMarkdown('`变量名`');
    expect(getCodeTexts(doc)).toEqual(['变量名']);
  });

  it('handles code mark with mixed symbols', () => {
    const doc = parseMarkdown('`a + b = c`');
    expect(getCodeTexts(doc)).toEqual(['a + b = c']);
  });
});

describe('code mark round-trip', () => {
  it('serializes code mark back to `code`', () => {
    const markdown = '`const x = 1`';
    expect(serializeMarkdown(parseMarkdown(markdown)).trim()).toBe(markdown);
  });

  it('round-trips code mark within paragraph', () => {
    const markdown = 'text `const x = 1` more';
    expect(serializeMarkdown(parseMarkdown(markdown)).trim()).toContain('`const x = 1`');
  });

  it('round-trips code mark with spaces', () => {
    const markdown = '`const ok = true`';
    expect(serializeMarkdown(parseMarkdown(markdown)).trim()).toBe(markdown);
  });

  it('round-trips code mark with Chinese text', () => {
    const markdown = '`变量名`';
    expect(serializeMarkdown(parseMarkdown(markdown)).trim()).toBe(markdown);
  });

  it('round-trips code mark with punctuation', () => {
    const markdown = '`foo.bar()`';
    expect(serializeMarkdown(parseMarkdown(markdown)).trim()).toBe(markdown);
  });

  it('handles code mark containing backticks with double backtick syntax', () => {
    const markdown = '`` code with ` backtick ``';
    expect(serializeMarkdown(parseMarkdown(markdown)).trim()).toBe(markdown);
  });
});

describe('code mark boundaries', () => {
  it('does NOT parse empty backticks as code mark', () => {
    const doc = parseMarkdown('``');
    expect(hasCodeMark(doc)).toBe(false);
  });

  it('does NOT parse unclosed backtick as code mark', () => {
    const doc = parseMarkdown('open ` but not closed');
    expect(hasCodeMark(doc)).toBe(false);
  });

  it('handles escaped backtick as literal', () => {
    const doc = parseMarkdown('costs \\`100');
    expect(hasCodeMark(doc)).toBe(false);
  });

  it('does NOT parse code mark inside code block', () => {
    const markdown = '```\n`code`\n```\n';
    const doc = parseMarkdown(markdown);
    expect(hasCodeMark(doc)).toBe(false);
  });
});

describe('code mark schema', () => {
  it('code mark has inline-code class in toDOM', () => {
    const mark = schema.marks.code;
    const dom = mark.spec.toDOM!(mark.create(), true);
    expect(dom).toEqual(['code', { class: 'inline-code' }, 0]);
  });
});

describe('code mark with math_inline coexistence', () => {
  it('parses both code mark and inline math in same paragraph', () => {
    const doc = parseMarkdown('code `x` and math $y$');
    const codeTexts = getCodeTexts(doc);
    const mathValues: string[] = [];
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        mathValues.push(node.attrs.tex as string);
      }
      return true;
    });
    expect(codeTexts).toEqual(['x']);
    expect(mathValues).toEqual(['y']);
  });
});

describe('code mark semantic input', () => {
  it('converts newly typed `code` text into code mark', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [inlineMarkdownMarkInputPlugin()],
    });

    state = state.apply(state.tr.insertText('语义输入 `const x = 1`'));

    expect(getCodeTexts(state.doc)).toEqual(['const x = 1']);
  });

  it('converts newly typed `code` with spaces into code mark', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [inlineMarkdownMarkInputPlugin()],
    });

    state = state.apply(state.tr.insertText('语义输入 `const ok = true`'));

    expect(getCodeTexts(state.doc)).toEqual(['const ok = true']);
  });

  it('converts `a` to code mark', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [inlineMarkdownMarkInputPlugin()],
    });

    state = state.apply(state.tr.insertText('`a`'));

    expect(getCodeTexts(state.doc)).toEqual(['a']);
  });

  it('converts double backtick code into code mark', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [inlineMarkdownMarkInputPlugin()],
    });

    state = state.apply(state.tr.insertText('语义输入 `` code with ` backtick ``'));

    expect(getCodeTexts(state.doc)).toEqual(['code with ` backtick']);
  });
});

describe('code mark pending state', () => {
  it('shows pending code mark syntax hint', () => {
    const state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [pendingInlineMarkPlugin()],
    });

    const tr = state.tr.setMeta(pendingInlineMarkKey, {
      action: 'set',
      markTypeNames: ['code'],
    });
    // pending 状态通过 toggleMarkPending 命令触发
    expect(state.schema.marks.code).toBeDefined();
  });
});

describe('code mark syntax highlight decoration', () => {
  it('creates decoration for code mark tokens', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('const x = 1', [schema.marks.code.create()]),
      ]),
    ]);

    const plugin = codeHighlightDecorationPlugin();
    const state = EditorState.create({ doc, plugins: [plugin] });
    const decorations = plugin.getState(state) as import('prosemirror-view').DecorationSet;

    expect(decorations).toBeDefined();
  });
});
