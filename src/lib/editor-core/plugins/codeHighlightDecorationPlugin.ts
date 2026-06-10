import { Plugin } from 'prosemirror-state';
import type { Mark, Node as ProseMirrorNode } from 'prosemirror-model';
import { Decoration, DecorationSet } from 'prosemirror-view';

/**
 * 行内代码语法高亮 Decoration Plugin
 *
 * 对文档中所有带 code mark 的文本节点做 token 分类，
 * 通过 inline decoration 给不同 token 类型添加 CSS class。
 *
 * 策略：全量扫描，每次 state 变化时重新计算。
 * 行内代码通常很短，性能开销可忽略。
 */

interface InlineCodeToken {
  type: 'keyword' | 'boolean' | 'number' | 'string' | 'operator' | 'plain';
  value: string;
}

export function codeHighlightDecorationPlugin(): Plugin {
  return new Plugin({
    state: {
      init(_, { doc }) {
        return buildDecorations(doc);
      },
      apply(tr, value) {
        if (!tr.docChanged) return value.map(tr.mapping, tr.doc);
        return buildDecorations(tr.doc);
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText) return true;

    const hasCodeMark = node.marks.some((mark: Mark) => mark.type.name === 'code');
    if (!hasCodeMark || !node.text) return true;

    const tokens = tokenizeInlineCode(node.text);
    let offset = 0;
    for (const token of tokens) {
      if (token.type !== 'plain') {
        const from = pos + offset;
        const to = from + token.value.length;
        decorations.push(
          Decoration.inline(from, to, {
            class: `inline-code-token inline-code-token-${token.type}`,
          }),
        );
      }
      offset += token.value.length;
    }

    return true;
  });

  return DecorationSet.create(doc, decorations);
}

/* ---- 轻量语法提示：token 分类器（从 InlineCodeNodeView 迁移） ---- */

/** 常见关键字集合（语言无关） */
const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'break', 'continue', 'new', 'this', 'class', 'extends', 'import',
  'export', 'default', 'from', 'async', 'await', 'try', 'catch', 'finally', 'throw',
  'typeof', 'instanceof', 'in', 'of', 'null', 'undefined', 'true', 'false', 'void',
  'delete', 'yield', 'static', 'super', 'with', 'debugger', 'interface', 'type',
  'enum', 'implements', 'package', 'private', 'protected', 'public', 'abstract', 'as',
  'readonly', 'def', 'print', 'lambda', 'pass', 'global', 'nonlocal', 'assert', 'elif',
  'except', 'raise', 'yield', 'from', 'and', 'or', 'not', 'is', 'fn', 'mod', 'pub',
  'use', 'mut', 'ref', 'match', 'loop', 'move',
]);

/** 布尔值 */
const BOOLEANS = new Set([
  'true', 'false', 'null', 'undefined', 'None', 'True', 'False', 'nil',
]);

function tokenizeInlineCode(code: string): InlineCodeToken[] {
  const tokens: InlineCodeToken[] = [];
  let i = 0;

  while (i < code.length) {
    const ch = code[i];

    // 字符串（单引号、双引号、反引号）
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = findStringEnd(code, i, ch);
      tokens.push({ type: 'string', value: code.slice(i, end) });
      i = end;
      continue;
    }

    // 数字
    if (isDigit(ch)) {
      const end = findNumberEnd(code, i);
      tokens.push({ type: 'number', value: code.slice(i, end) });
      i = end;
      continue;
    }

    // 标识符（关键字、布尔值、普通标识符）
    if (isIdentifierStart(ch)) {
      const end = findIdentifierEnd(code, i);
      const word = code.slice(i, end);
      if (BOOLEANS.has(word)) {
        tokens.push({ type: 'boolean', value: word });
      } else if (KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else {
        tokens.push({ type: 'plain', value: word });
      }
      i = end;
      continue;
    }

    // 运算符和符号
    if (isOperatorOrPunctuation(ch)) {
      const end = findOperatorEnd(code, i);
      tokens.push({ type: 'operator', value: code.slice(i, end) });
      i = end;
      continue;
    }

    // 其他字符（空格、中文等）
    tokens.push({ type: 'plain', value: ch });
    i++;
  }

  return tokens;
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentifierStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
}

function isIdentifierPart(ch: string): boolean {
  return isIdentifierStart(ch) || isDigit(ch);
}

function isOperatorOrPunctuation(ch: string): boolean {
  return '+-*/%=<>!&|^~?:;,.(){}[]@#'.includes(ch);
}

function findStringEnd(code: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < code.length) {
    if (code[i] === '\\') {
      i += 2;
      continue;
    }
    if (code[i] === quote) {
      return i + 1;
    }
    i++;
  }
  return code.length;
}

function findNumberEnd(code: string, start: number): number {
  let i = start;
  // 十六进制
  if (code[i] === '0' && (code[i + 1] === 'x' || code[i + 1] === 'X')) {
    i += 2;
    while (i < code.length && isHexDigit(code[i])) i++;
    return i;
  }
  // 二进制
  if (code[i] === '0' && (code[i + 1] === 'b' || code[i + 1] === 'B')) {
    i += 2;
    while (i < code.length && (code[i] === '0' || code[i] === '1')) i++;
    return i;
  }
  // 十进制
  while (i < code.length && isDigit(code[i])) i++;
  if (i < code.length && code[i] === '.') {
    i++;
    while (i < code.length && isDigit(code[i])) i++;
  }
  // 科学计数法
  if (i < code.length && (code[i] === 'e' || code[i] === 'E')) {
    i++;
    if (i < code.length && (code[i] === '+' || code[i] === '-')) i++;
    while (i < code.length && isDigit(code[i])) i++;
  }
  return i;
}

function isHexDigit(ch: string): boolean {
  return isDigit(ch) || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
}

function findIdentifierEnd(code: string, start: number): number {
  let i = start;
  while (i < code.length && isIdentifierPart(code[i])) i++;
  return i;
}

function findOperatorEnd(code: string, start: number): number {
  const ch = code[start];
  // 箭头 =>
  if (ch === '=' && code[start + 1] === '>') return start + 2;
  // 箭头 ->
  if (ch === '-' && code[start + 1] === '>') return start + 2;
  // 展开运算符 ...
  if (ch === '.' && code[start + 1] === '.' && code[start + 2] === '.') return start + 3;
  // 双字符运算符
  if (start + 1 < code.length) {
    const two = ch + code[start + 1];
    if (
      [
        '==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=',
        '=>', '->', '**', '??', '?.',
      ].includes(two)
    ) {
      return start + 2;
    }
  }
  return start + 1;
}
