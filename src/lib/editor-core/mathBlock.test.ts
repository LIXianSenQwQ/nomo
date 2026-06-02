import { describe, expect, it } from 'vitest';
import type { DOMOutputSpec, Node as ProseMirrorNode, TagParseRule } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { parseMarkdown, serializeMarkdown } from './markdown';
import { displayMathInputPlugin } from './plugins/displayMathInput';
import { schema } from './schema';

describe('math_block markdown-it parser', () => {
  it('parses multi-line $$...$$ as math_block node', () => {
    const doc = parseMarkdown('$$\nE = mc^2\n$$');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'math_block') {
        expect(node.attrs.tex).toBe('E = mc^2');
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(true);
  });

  it('parses single-line $$tex$$ as math_block node', () => {
    const doc = parseMarkdown('$$E = mc^2$$');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'math_block') {
        expect(node.attrs.tex).toBe('E = mc^2');
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(true);
  });

  it('preserves multi-line formula content', () => {
    const tex = '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}';
    const doc = parseMarkdown(`$$\n${tex}\n$$`);
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'math_block') {
        expect(node.attrs.tex).toBe(tex);
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(true);
  });

  it('preserves content across multiple lines', () => {
    const input = '$$\n\\begin{aligned}\na &= b + c \\\\\nd &= e + f\n\\end{aligned}\n$$';
    const doc = parseMarkdown(input);
    let tex = '';
    doc.descendants((node) => {
      if (node.type.name === 'math_block') {
        tex = node.attrs.tex as string;
        return false;
      }
      return true;
    });
    expect(tex).toContain('\\begin{aligned}');
    expect(tex).toContain('a &= b + c');
    expect(tex).toContain('d &= e + f');
    expect(tex).toContain('\\end{aligned}');
  });

  it('does NOT generate math_block for unclosed $$', () => {
    const doc = parseMarkdown('$$\nE = mc^2');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'math_block') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(false);
  });

  it('does NOT generate math_block for empty content', () => {
    // $$\n$$ — 两行之间没有内容
    const doc = parseMarkdown('$$\n$$');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'math_block') {
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(false);
  });
});

describe('math_block serialization', () => {
  it('serializes math_block to standard $$...$$ format', () => {
    const markdown = '$$\nE = mc^2\n$$';
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toBe('$$\nE = mc^2\n$$');
  });

  it('serializes multi-line content correctly', () => {
    const tex = '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}';
    const markdown = `$$\n${tex}\n$$`;
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toBe(`$$\n${tex}\n$$`);
  });
});

describe('math_block round-trip', () => {
  it('round-trips simple formula', () => {
    const markdown = '$$\nE = mc^2\n$$';
    const doc = parseMarkdown(markdown);
    const serialized = serializeMarkdown(doc).trim();
    expect(serialized).toBe(markdown);
  });

  it('round-trips complex formula', () => {
    const tex = '\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}';
    const markdown = `$$\n${tex}\n$$`;
    const doc = parseMarkdown(markdown);
    const serialized = serializeMarkdown(doc).trim();
    expect(serialized).toBe(markdown);
  });

  it('round-trips multi-line aligned equations', () => {
    const input = '$$\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n$$';
    const doc = parseMarkdown(input);
    const serialized = serializeMarkdown(doc).trim();
    expect(serialized).toBe(input);
  });
});

describe('math_block schema', () => {
  it('is represented as block atom node', () => {
    const doc = parseMarkdown('$$\nx^2\n$$');
    let mathNode: ProseMirrorNode | null = null;
    doc.descendants((node) => {
      if (node.type.name === 'math_block') {
        mathNode = node;
        return false;
      }
      return true;
    });
    expect(mathNode).not.toBeNull();
    expect(mathNode!.type.spec.atom).toBe(true);
    expect(mathNode!.type.spec.selectable).toBe(true);
    expect(mathNode!.type.spec.group).toBe('block');
  });

  it('has only tex attribute', () => {
    const doc = parseMarkdown('$$\nx^2\n$$');
    let mathNode: ProseMirrorNode | null = null;
    doc.descendants((node) => {
      if (node.type.name === 'math_block') {
        mathNode = node;
        return false;
      }
      return true;
    });
    expect(mathNode!.attrs).toEqual({ tex: 'x^2' });
    expect(Object.keys(mathNode!.attrs)).toEqual(['tex']);
  });

  it('toDOM fallback outputs div with data-tex', () => {
    const doc = parseMarkdown('$$\nx^2\n$$');
    let mathNode: ProseMirrorNode | null = null;
    doc.descendants((node) => {
      if (node.type.name === 'math_block') {
        mathNode = node;
        return false;
      }
      return true;
    });
    const dom = mathNode!.type.spec.toDOM!(mathNode!) as [string, Record<string, string>, DOMOutputSpec];
    expect(dom[0]).toBe('div');
    expect(dom[1].class).toBe('math-block');
    expect(dom[1]['data-tex']).toBe('x^2');
  });

  it('parseDOM recovers tex from data-tex attribute', () => {
    const dom = document.createElement('div');
    dom.className = 'math-block';
    dom.setAttribute('data-tex', 'x^2');
    const parseRule = (schema.nodes.math_block.spec.parseDOM as readonly TagParseRule[])[0];
    const attrs = parseRule.getAttrs!(dom) as Record<string, string>;
    expect(attrs.tex).toBe('x^2');
  });
});

describe('math_block coexistence with math_inline', () => {
  it('both inline and display math can coexist in one document', () => {
    const markdown = 'inline $a^2$ and display:\n\n$$\nb^2 + c^2\n$$';
    const doc = parseMarkdown(markdown);
    const inlineTex: string[] = [];
    const blockTex: string[] = [];
    doc.descendants((node) => {
      if (node.type.name === 'math_inline') {
        inlineTex.push(node.attrs.tex as string);
      } else if (node.type.name === 'math_block') {
        blockTex.push(node.attrs.tex as string);
      }
      return true;
    });
    expect(inlineTex).toEqual(['a^2']);
    expect(blockTex).toEqual(['b^2 + c^2']);
  });

  it('round-trips document with both inline and display math', () => {
    const markdown = 'inline $a^2$ and display:\n\n$$\nb^2 + c^2\n$$';
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toBe(markdown);
  });
});

describe('displayMathInputPlugin — semantic input', () => {
  it('converts newly typed $$...$$ text into math_block node (multi-line)', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [displayMathInputPlugin()]
    });

    // 模拟用户输入 $$\nE = mc^2\n$$
    state = state.apply(state.tr.insertText('$$\nE = mc^2\n$$'));

    const blockTex: string[] = [];
    state.doc.descendants((node) => {
      if (node.type.name === 'math_block') {
        blockTex.push(node.attrs.tex as string);
        return false;
      }
      return true;
    });

    expect(blockTex).toEqual(['E = mc^2']);
  });

  it('converts single-line $$tex$$ into math_block node', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [displayMathInputPlugin()]
    });

    state = state.apply(state.tr.insertText('$$E = mc^2$$'));

    const blockTex: string[] = [];
    state.doc.descendants((node) => {
      if (node.type.name === 'math_block') {
        blockTex.push(node.attrs.tex as string);
        return false;
      }
      return true;
    });

    expect(blockTex).toEqual(['E = mc^2']);
  });

  it('does NOT convert unclosed $$ into math_block', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [displayMathInputPlugin()]
    });

    state = state.apply(state.tr.insertText('$$\nE = mc^2'));

    let found = false;
    state.doc.descendants((node) => {
      if (node.type.name === 'math_block') {
        found = true;
        return false;
      }
      return true;
    });

    expect(found).toBe(false);
  });

  it('does NOT convert empty $$...$$ into math_block', () => {
    let state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      plugins: [displayMathInputPlugin()]
    });

    state = state.apply(state.tr.insertText('$$$$'));

    let found = false;
    state.doc.descendants((node) => {
      if (node.type.name === 'math_block') {
        found = true;
        return false;
      }
      return true;
    });

    expect(found).toBe(false);
  });
});
