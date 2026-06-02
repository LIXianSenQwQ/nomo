import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * 行内代码 NodeView：展示态 + 编辑态
 *
 * 展示态：轻量代码胶囊，带语法提示（关键字、布尔值、数字、字符串、符号）
 * 编辑态：单输入框，Enter 提交，Escape 取消，边界箭头键退出
 */
export class InlineCodeNodeView {
  private static nextKeyboardCursorSide: 'start' | 'end' | null = null;
  private static instantEditMode = false;

  dom: HTMLElement;

  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number;
  private editing = false;
  private originalCode = '';
  private pendingPointerRatio: number | null = null;

  // 编辑态 DOM 引用
  private input: HTMLInputElement | null = null;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('span');
    this.dom.className = 'inline-code';
    this.dom.contentEditable = 'false';
    this.dom.setAttribute('data-code', node.attrs.code as string);

    // 点击进入编辑态
    this.dom.addEventListener('mousedown', (event) => {
      if (this.editing) return;
      event.preventDefault();
      event.stopPropagation();
      this.pendingPointerRatio = getPointerRatio(event.clientX, this.dom.getBoundingClientRect());
      window.setTimeout(() => this.enterEdit(), 0);
    });
    this.dom.addEventListener('click', (event) => {
      if (this.editing) return;
      event.preventDefault();
      event.stopPropagation();
      this.pendingPointerRatio = getPointerRatio(event.clientX, this.dom.getBoundingClientRect());
      this.enterEdit();
    });

    // 初始渲染
    this.renderDisplay();

    // 检查是否需要立即进入编辑态
    if (InlineCodeNodeView.instantEditMode) {
      InlineCodeNodeView.instantEditMode = false;
      this.pendingPointerRatio = 1; // 光标在末尾
      requestAnimationFrame(() => {
        this.enterEdit();
      });
    }
  }

  static requestKeyboardEntry(cursorSide: 'start' | 'end'): void {
    InlineCodeNodeView.nextKeyboardCursorSide = cursorSide;
  }

  static requestInstantEdit(): void {
    InlineCodeNodeView.instantEditMode = true;
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (!this.editing) {
      this.renderDisplay();
    }
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
    if (InlineCodeNodeView.nextKeyboardCursorSide === 'start') {
      this.pendingPointerRatio = 0;
    } else if (InlineCodeNodeView.nextKeyboardCursorSide === 'end') {
      this.pendingPointerRatio = 1;
    }
    InlineCodeNodeView.nextKeyboardCursorSide = null;
    this.enterEdit();
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
    if (this.editing) {
      this.exitEdit(true);
    }
  }

  stopEvent(event: Event): boolean {
    if (this.editing) {
      return this.dom.contains(event.target as Node);
    }
    return false;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.cleanupEdit();
  }

  // ---- 展示态渲染 ----

  private renderDisplay(): void {
    const code = this.node.attrs.code as string;
    this.dom.setAttribute('data-code', code);

    if (!code) {
      this.dom.textContent = '';
      this.dom.classList.add('is-empty');
      return;
    }

    this.dom.classList.remove('is-empty');

    // 轻量语法提示：对通用 token 做视觉区分
    this.dom.innerHTML = '';
    const tokens = tokenizeInlineCode(code);
    for (const token of tokens) {
      const span = document.createElement('span');
      span.className = `inline-code-token inline-code-token-${token.type}`;
      span.textContent = token.value;
      this.dom.appendChild(span);
    }
  }

  // ---- 编辑态管理 ----

  private enterEdit(): void {
    if (this.editing) return;
    this.editing = true;
    this.originalCode = this.node.attrs.code as string;
    this.dom.classList.add('is-editing');
    this.dom.classList.remove('ProseMirror-selectednode');

    // 步骤1：创建 input
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'inline-code-input';
    this.input.value = this.originalCode;
    this.updateInputWidth();

    // 步骤2：替换内容为 input
    this.dom.textContent = '';
    this.dom.appendChild(this.input);

    // 步骤3：input 事件监听
    this.input.addEventListener('input', () => {
      this.updateInputWidth();
    });
    this.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.input.addEventListener('blur', () => {
      this.exitEdit(true);
    });

    // 步骤4：聚焦 input
    requestAnimationFrame(() => {
      if (!this.input) return;
      this.input.focus({ preventScroll: true });
      const cursorPos = this.resolveInitialCursorPos();
      this.input.setSelectionRange(cursorPos, cursorPos);
      this.pendingPointerRatio = null;
    });
  }

  private exitEdit(save: boolean, cursorSide: 'before' | 'after' = 'after'): void {
    if (!this.editing) return;

    const newCode = save && this.input ? this.input.value : this.originalCode;
    const oldCode = this.node.attrs.code as string;
    const pos = this.getPos();

    this.cleanupEdit();

    let tr = this.view.state.tr;
    if (save && newCode !== oldCode) {
      // 提交：修改 node attrs
      tr = tr.setNodeMarkup(pos, null, { code: newCode });
    }

    const cursorPos = cursorSide === 'before' ? pos : pos + 1;
    const bias = cursorSide === 'before' ? -1 : 1;
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos), bias));
    this.view.dispatch(tr);
  }

  private cleanupEdit(): void {
    this.editing = false;
    this.dom.classList.remove('is-editing');
    this.input = null;

    // 恢复展示态
    this.renderDisplay();
  }

  // ---- 键盘处理 ----

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.input) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      this.exitEdit(true);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      this.exitEdit(false);
      return;
    }

    // 左箭头在 input 开头时退出编辑态（光标在节点前）
    if (e.key === 'ArrowLeft' && this.input.selectionStart === 0 && this.input.selectionEnd === 0) {
      e.preventDefault();
      this.exitEdit(true, 'before');
      return;
    }

    // 右箭头在 input 末尾时退出编辑态（光标在节点后）
    if (e.key === 'ArrowRight' && this.input.selectionStart === this.input.value.length && this.input.selectionEnd === this.input.value.length) {
      e.preventDefault();
      this.exitEdit(true, 'after');
      return;
    }
  }

  // ---- 辅助方法 ----

  private updateInputWidth(): void {
    if (!this.input) return;
    // 最小 10ch，额外 +2ch 留出内边距空间
    this.input.style.width = `${Math.max(10, this.input.value.length + 3)}ch`;
  }

  private resolveInitialCursorPos(): number {
    const ratio = this.pendingPointerRatio;
    const valueLength = this.input?.value.length ?? 0;
    if (ratio === null) return valueLength;
    return Math.max(0, Math.min(valueLength, Math.round(ratio * valueLength)));
  }
}

// ---- 轻量语法提示：token 分类器 ----

interface InlineCodeToken {
  type: 'keyword' | 'boolean' | 'number' | 'string' | 'operator' | 'plain';
  value: string;
}

/** 常见关键字集合（语言无关） */
const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'break', 'continue', 'new', 'this', 'class',
  'extends', 'import', 'export', 'default', 'from', 'async', 'await',
  'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of',
  'null', 'undefined', 'true', 'false', 'void', 'delete', 'yield', 'static',
  'super', 'with', 'debugger', 'interface', 'type', 'enum', 'implements',
  'package', 'private', 'protected', 'public', 'abstract', 'as', 'readonly',
  'def', 'print', 'lambda', 'pass', 'global', 'nonlocal', 'assert', 'elif',
  'except', 'raise', 'with', 'yield', 'from', 'and', 'or', 'not', 'is',
  'fn', 'mod', 'pub', 'use', 'mut', 'ref', 'match', 'loop', 'move',
]);

/** 布尔值 */
const BOOLEANS = new Set(['true', 'false', 'null', 'undefined', 'None', 'True', 'False', 'nil', 'null']);

/**
 * 将行内代码文本分割为带类型的 token 列表
 * 保守策略：只识别明确的 token 类型，未知内容保持原样
 */
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
      i += 2; // 跳过转义字符
      continue;
    }
    if (code[i] === quote) {
      return i + 1;
    }
    i++;
  }
  return code.length; // 未闭合的字符串
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
    if (['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '=>', '->', '**', '??', '?.'].includes(two)) {
      return start + 2;
    }
  }
  return start + 1;
}

function getPointerRatio(clientX: number, rect: DOMRect): number {
  if (rect.width <= 0) return 1;
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}
