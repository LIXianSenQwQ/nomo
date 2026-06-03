import { describe, expect, it } from 'vitest';
import type { DOMOutputSpec, TagParseRule } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { parseMarkdown, serializeMarkdown } from './markdown';
import { inlineCodeInputPlugin } from './plugins/inlineCodeInput';
import { schema } from './schema';

describe('inline_code markdown-it parser', () => {
  it('parses `code` as inline_code node', () => {
    const doc = parseMarkdown('`const x = 1`');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'inline_code') {
        expect(node.attrs.code).toBe('const x = 1');
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(true);
  });

  it('preserves inline code inside paragraph text', () => {
    const doc = parseMarkdown('这是 `const x = 1` 代码片段');
    const codeValues: string[] = [];
    doc.descendants((node) => {
      if (node.type.name === 'inline_code') {
        codeValues.push(node.attrs.code as string);
        return false;
      }
      return true;
    });
    expect(codeValues).toEqual(['const x = 1']);
  });

  it('handles multiple inline code in one paragraph', () => {
    const doc = parseMarkdown('`foo` and `bar` and `baz`');
    const count: string[] = [];
    doc.descendants((node) => {
      if (node.type.name === 'inline_code') {
        count.push(node.attrs.code as string);
        return false;
      }
      return true;
    });
    expect(count).toEqual(['foo', 'bar', 'baz']);
  });

  it('handles inline code with spaces', () => {
    const doc = parseMarkdown('`const ok = true`');
    const mathNode = doc.firstChild?.firstChild;
    expect(mathNode?.type.name).toBe('inline_code');
    expect(mathNode?.attrs.code).toBe('const ok = true');
  });

  it('handles inline code with punctuation', () => {
    const doc = parseMarkdown('`foo.bar()`');
    const mathNode = doc.firstChild?.firstChild;
    expect(mathNode?.type.name).toBe('inline_code');
    expect(mathNode?.attrs.code).toBe('foo.bar()');
  });

  it('handles inline code with Chinese text', () => {
    const doc = parseMarkdown('`变量名`');
    const mathNode = doc.firstChild?.firstChild;
    expect(mathNode?.type.name).toBe('inline_code');
    expect(mathNode?.attrs.code).toBe('变量名');
  });

  it('handles inline code with mixed symbols', () => {
    const doc = parseMarkdown('`a + b = c`');
    const mathNode = doc.firstChild?.firstChild;
    expect(mathNode?.type.name).toBe('inline_code');
    expect(mathNode?.attrs.code).toBe('a + b = c');
  });
});

describe('inline_code round-trip', () => {
  it('serializes inline_code back to `code`', () => {
    const markdown = '`const x = 1`';
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toBe('`const x = 1`');
  });

  it('round-trips inline code within paragraph', () => {
    const markdown = 'text `const x = 1` more';
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toContain('`const x = 1`');
  });

  it('round-trips inline code with spaces', () => {
    const markdown = '`const ok = true`';
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toBe('`const ok = true`');
  });

  it('round-trips inline code with Chinese text', () => {
    const markdown = '`变量名`';
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toBe('`变量名`');
  });

  it('round-trips inline code with punctuation', () => {
    const markdown = '`foo.bar()`';
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toBe('`foo.bar()`');
  });

  it('handles inline code containing backticks with double backtick syntax', () => {
    const markdown = '`` code with ` backtick ``';
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toBe('`` code with ` backtick ``');
  });
});

describe('inline_code boundaries', () => {
  it('does NOT parse empty backticks as inline code', () => {
    const doc = parseMarkdown('``');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'inline_code') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(false);
  });

  it('does NOT parse unclosed backtick as inline code', () => {
    const doc = parseMarkdown('open ` but not closed');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'inline_code') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(false);
  });

  it('handles escaped backtick as literal', () => {
    const doc = parseMarkdown('costs \\`100');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'inline_code') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(false);
  });

  it('does NOT parse inline code inside code block', () => {
    const markdown = '```\n`code`\n```\n';
    const doc = parseMarkdown(markdown);
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'inline_code') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(false);
  });
});

describe('inline_code schema', () => {
  it('is represented as inline atom node', () => {
    const doc = parseMarkdown('`code`');
    const codeNode = doc.firstChild?.firstChild;
    expect(codeNode?.type.name).toBe('inline_code');
    expect(codeNode?.type.spec.inline).toBe(true);
    expect(codeNode?.type.spec.atom).toBe(true);
    expect(codeNode?.type.spec.selectable).toBe(true);
  });

  it('has only code attribute', () => {
    const doc = parseMarkdown('`const x = 1`');
    const codeNode = doc.firstChild?.firstChild;
    expect(codeNode?.attrs).toEqual({ code: 'const x = 1' });
    expect(Object.keys(codeNode?.attrs ?? {})).toEqual(['code']);
  });

  it('toDOM fallback outputs span with data-code', () => {
    const doc = parseMarkdown('`const x = 1`');
    const codeNode = doc.firstChild?.firstChild;
    const dom = codeNode!.type.spec.toDOM!(codeNode!) as [
      string,
      Record<string, string>,
      DOMOutputSpec,
    ];
    expect(dom[0]).toBe('span');
    expect(dom[1].class).toBe('inline-code');
    expect(dom[1]['data-code']).toBe('const x = 1');
  });

  it('parseDOM recovers code from data-code attribute', () => {
    const dom = document.createElement('span');
    dom.className = 'inline-code';
    dom.setAttribute('data-code', 'const x = 1');
    const parseRule = (schema.nodes.inline_code.spec.parseDOM as readonly TagParseRule[])[0];
    const attrs = parseRule.getAttrs!(dom) as Record<string, string>;
    expect(attrs.code).toBe('const x = 1');
  });

  it('parseDOM strips fallback backtick delimiters from textContent', () => {
    const dom = document.createElement('span');
    dom.className = 'inline-code';
    dom.textContent = '`const x = 1`';
    const parseRule = (schema.nodes.inline_code.spec.parseDOM as readonly TagParseRule[])[0];
    const attrs = parseRule.getAttrs!(dom) as Record<string, string>;
    expect(attrs.code).toBe('const x = 1');
  });
});

describe('inline_code with math_inline coexistence', () => {
  it('parses both inline code and inline math in same paragraph', () => {
    const doc = parseMarkdown('code `x` and math $y$');
    const codeValues: string[] = [];
    const mathValues: string[] = [];
    doc.descendants((node) => {
      if (node.type.name === 'inline_code') {
        codeValues.push(node.attrs.code as string);
      } else if (node.type.name === 'math_inline') {
        mathValues.push(node.attrs.tex as string);
      }
      return true;
    });
    expect(codeValues).toEqual(['x']);
    expect(mathValues).toEqual(['y']);
  });
});

describe('inline_code semantic input', () => {
  it('converts newly typed `code` text into inline_code node', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [inlineCodeInputPlugin()],
    });

    state = state.apply(state.tr.insertText('语义输入 `const x = 1`'));

    const codeValues: string[] = [];
    state.doc.descendants((node) => {
      if (node.type.name === 'inline_code') {
        codeValues.push(node.attrs.code as string);
        return false;
      }
      return true;
    });

    expect(codeValues).toEqual(['const x = 1']);
    expect(state.doc.textContent).not.toContain('`const x = 1`');
  });

  it('converts newly typed `code` with spaces into inline_code node', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [inlineCodeInputPlugin()],
    });

    state = state.apply(state.tr.insertText('语义输入 `const ok = true`'));

    const codeValues: string[] = [];
    state.doc.descendants((node) => {
      if (node.type.name === 'inline_code') {
        codeValues.push(node.attrs.code as string);
        return false;
      }
      return true;
    });

    expect(codeValues).toEqual(['const ok = true']);
  });

  it('converts `a` to inline_code and allows continued input', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [inlineCodeInputPlugin()],
    });

    // 模拟用户输入 `a`
    state = state.apply(state.tr.insertText('`a`'));

    const codeValues: string[] = [];
    let found = false;
    state.doc.descendants((node) => {
      if (node.type.name === 'inline_code') {
        codeValues.push(node.attrs.code as string);
        found = true;
        return false;
      }
      return true;
    });

    // `a` 应该被转换为 inline_code 节点
    expect(found).toBe(true);
    expect(codeValues).toEqual(['a']);
  });

  it('converts double backtick code into inline_code node', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [inlineCodeInputPlugin()],
    });

    state = state.apply(state.tr.insertText('语义输入 `` code with ` backtick ``'));

    const codeValues: string[] = [];
    state.doc.descendants((node) => {
      if (node.type.name === 'inline_code') {
        codeValues.push(node.attrs.code as string);
        return false;
      }
      return true;
    });

    expect(codeValues).toEqual(['code with ` backtick']);
  });
});
