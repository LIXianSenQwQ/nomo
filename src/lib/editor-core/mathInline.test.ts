import { describe, expect, it } from 'vitest';
import type { DOMOutputSpec, TagParseRule } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { parseMarkdown, serializeMarkdown } from './markdown';
import { mathInlineInputPlugin } from './plugins/mathInlineInput';
import { schema } from './schema';

describe('math_inline markdown-it parser', () => {
  it('parses $x^2$ as math_inline node', () => {
    const doc = parseMarkdown('$x^2$');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        expect(node.attrs.tex).toBe('x^2');
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(true);
  });

  it('preserves inline math inside paragraph text', () => {
    const doc = parseMarkdown('这是 $a + b$ 段内公式');
    const texValues: string[] = [];
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        texValues.push(node.attrs.tex as string);
        return false;
      }
      return true;
    });
    expect(texValues).toEqual(['a + b']);
  });

  it('trims spaces inside dollar delimiters', () => {
    const doc = parseMarkdown('$ a=c $');
    const mathNode = doc.firstChild?.firstChild;
    expect(mathNode?.type.name).toBe('math_inline');
    expect(mathNode?.attrs.tex).toBe('a=c');
  });

  it('handles multiple inline math in one paragraph', () => {
    const doc = parseMarkdown('$x$ and $y$ and $z$');
    const count: string[] = [];
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        count.push(node.attrs.tex as string);
        return false;
      }
      return true;
    });
    expect(count).toEqual(['x', 'y', 'z']);
  });

  it('handles adjacent inline math without separator', () => {
    const doc = parseMarkdown('$1111111$$aaaaaaaaaaaaa$');
    const texValues: string[] = [];
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        texValues.push(node.attrs.tex as string);
        return false;
      }
      return true;
    });
    expect(texValues).toEqual(['1111111', 'aaaaaaaaaaaaa']);
  });

  it('handles adjacent inline math $a$$b$', () => {
    const doc = parseMarkdown('$a$$b$');
    const texValues: string[] = [];
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        texValues.push(node.attrs.tex as string);
        return false;
      }
      return true;
    });
    expect(texValues).toEqual(['a', 'b']);
  });
});

describe('math_inline round-trip', () => {
  it('serializes math_inline back to $tex$', () => {
    const markdown = '$x^2$';
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toBe('$x^2$');
  });

  it('round-trips inline math within paragraph', () => {
    const markdown = 'text $\\alpha + \\beta$ more';
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toContain('$\\alpha + \\beta$');
  });

  it('escapes $ inside tex content during serialization', () => {
    const markdown = '$a\\$b$';
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toBe('$a\\$b$');
  });

  it('preserves $$ as literal text (not math_inline)', () => {
    const doc = parseMarkdown('$$');
    // $$ 不匹配 inline math（缺少有效内容），作为普通文本保留
    const serialized = serializeMarkdown(doc).trim();
    expect(serialized).toBe('$$');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(false);
  });
});

describe('math_inline boundaries', () => {
  it('does NOT parse $100 as math (money pattern)', () => {
    const doc = parseMarkdown('price $100');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(false);
  });

  it('does NOT parse $ in inline code as math', () => {
    const doc = parseMarkdown('`$x^2$`');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(false);
  });

  it('does NOT parse $$ in code block as inline math', () => {
    const markdown = '```\n$x^2$\n```\n';
    const doc = parseMarkdown(markdown);
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(false);
  });

  it('handles escaped \\$ as literal dollar (no math_inline)', () => {
    const doc = parseMarkdown('costs \\$100');
    // markdown-it escape 规则将 \$ 转为字面 $，序列化后为普通文本
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(false);
  });

  it('handles unclosed $ as regular text', () => {
    const doc = parseMarkdown('open $ but not closed');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(false);
  });

  it('matches $ with leading/trailing space inside and trims it', () => {
    const doc = parseMarkdown('$ 100 $');
    const values: string[] = [];
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        values.push(node.attrs.tex as string);
        return false;
      }
      return true;
    });
    expect(values).toEqual(['100']);
  });
});

describe('math_inline schema', () => {
  it('is represented as inline atom node', () => {
    const doc = parseMarkdown('$x$');
    const mathNode = doc.firstChild?.firstChild;
    expect(mathNode?.type.name).toBe('math_inline');
    expect(mathNode?.type.spec.inline).toBe(true);
    expect(mathNode?.type.spec.atom).toBe(true);
    expect(mathNode?.type.spec.selectable).toBe(true);
  });

  it('has only tex attribute', () => {
    const doc = parseMarkdown('$x^2$');
    const mathNode = doc.firstChild?.firstChild;
    expect(mathNode?.attrs).toEqual({ tex: 'x^2' });
    expect(Object.keys(mathNode?.attrs ?? {})).toEqual(['tex']);
  });

  it('toDOM fallback outputs span with data-tex', () => {
    const doc = parseMarkdown('$x^2$');
    const mathNode = doc.firstChild?.firstChild;
    const dom = mathNode!.type.spec.toDOM!(mathNode!) as [
      string,
      Record<string, string>,
      DOMOutputSpec,
    ];
    expect(dom[0]).toBe('span');
    expect(dom[1].class).toBe('math-inline');
    expect(dom[1]['data-tex']).toBe('x^2');
  });

  it('parseDOM recovers tex from data-tex attribute', () => {
    const dom = document.createElement('span');
    dom.className = 'math-inline';
    dom.setAttribute('data-tex', 'x^2');
    const parseRule = (schema.nodes.math_inline.spec.parseDOM as readonly TagParseRule[])[0];
    const attrs = parseRule.getAttrs!(dom) as Record<string, string>;
    expect(attrs.tex).toBe('x^2');
  });

  it('parseDOM strips fallback dollar delimiters from textContent', () => {
    const dom = document.createElement('span');
    dom.className = 'math-inline';
    dom.textContent = '$x^2$';
    const parseRule = (schema.nodes.math_inline.spec.parseDOM as readonly TagParseRule[])[0];
    const attrs = parseRule.getAttrs!(dom) as Record<string, string>;
    expect(attrs.tex).toBe('x^2');
  });
});

describe('math_inline with display math $$', () => {
  it('does NOT parse inline $$ as math_inline', () => {
    const doc = parseMarkdown('$$E=mc^2$$');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(false);
  });
});

describe('math_inline semantic input', () => {
  it('converts newly typed $tex$ text into math_inline node', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [mathInlineInputPlugin()],
    });

    state = state.apply(state.tr.insertText('语义输入 $a^2 + b^2 = c^2$'));

    const texValues: string[] = [];
    state.doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        texValues.push(node.attrs.tex as string);
        return false;
      }
      return true;
    });

    expect(texValues).toEqual(['a^2 + b^2 = c^2']);
    expect(state.doc.textContent).not.toContain('$a^2 + b^2 = c^2$');
  });

  it('converts newly typed $ tex $ text into math_inline node', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [mathInlineInputPlugin()],
    });

    state = state.apply(state.tr.insertText('语义输入 $ a=c $'));

    const texValues: string[] = [];
    state.doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        texValues.push(node.attrs.tex as string);
        return false;
      }
      return true;
    });

    expect(texValues).toEqual(['a=c']);
  });

  it('does not convert inline code math-looking text', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [mathInlineInputPlugin()],
    });

    const code = schema.marks.code.create();
    state = state.apply(state.tr.insertText('$x^2$', 1, 1).addMark(1, 6, code));

    let found = false;
    state.doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        found = true;
        return false;
      }
      return true;
    });

    expect(found).toBe(false);
  });

  it('converts $a$ to math_inline and allows continued input', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [mathInlineInputPlugin()],
    });

    // 模拟用户输入 $a$
    state = state.apply(state.tr.insertText('$a$'));

    const texValues: string[] = [];
    let found = false;
    state.doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        texValues.push(node.attrs.tex as string);
        found = true;
        return false;
      }
      return true;
    });

    // $a$ 应该被转换为 math_inline 节点
    expect(found).toBe(true);
    expect(texValues).toEqual(['a']);
  });
});
