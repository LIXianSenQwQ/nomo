import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { getCodeTokenizer } from '../renderers';
import type { CodeTokenLine } from '../../services/render';
import { escapeHtml } from '../utils/html';

/**
 * code_block 节点的 NodeView —— 展示态 / 编辑态
 *
 * 职责：
 * 1. 展示态：高亮渲染代码、行号、语言标签、复制按钮
 * 2. 点击代码块进入编辑态（textarea + 高亮层叠层方案）
 * 3. Ctrl+Enter 保存退出 / Esc 取消退出 / blur 保存退出
 * 4. 编辑态始终保留语法高亮
 * 5. 编辑态右下角提供可搜索的语言选择器
 */

// 常用语言列表（含别名，用于语言选择器）
const LANGUAGES: Array<{ label: string; value: string; aliases: string[] }> = [
  { label: 'Plain Text', value: 'text', aliases: ['plaintext', 'txt'] },
  { label: 'JavaScript', value: 'javascript', aliases: ['js'] },
  { label: 'TypeScript', value: 'typescript', aliases: ['ts'] },
  { label: 'HTML', value: 'html', aliases: [] },
  { label: 'CSS', value: 'css', aliases: [] },
  { label: 'JSON', value: 'json', aliases: [] },
  { label: 'Markdown', value: 'markdown', aliases: ['md'] },
  { label: 'Python', value: 'python', aliases: ['py'] },
  { label: 'Java', value: 'java', aliases: [] },
  { label: 'Shell', value: 'shell', aliases: ['sh', 'bash'] },
  { label: 'SQL', value: 'sql', aliases: [] },
  { label: 'YAML', value: 'yaml', aliases: ['yml'] },
  { label: 'Diff', value: 'diff', aliases: [] },
  { label: 'Mermaid', value: 'mermaid', aliases: [] },
  { label: 'XML', value: 'xml', aliases: [] },
  { label: 'C', value: 'c', aliases: [] },
  { label: 'C++', value: 'cpp', aliases: ['c++'] },
  { label: 'C#', value: 'csharp', aliases: ['cs', 'c#'] },
  { label: 'Go', value: 'go', aliases: ['golang'] },
  { label: 'Rust', value: 'rust', aliases: ['rs'] },
  { label: 'Ruby', value: 'ruby', aliases: ['rb'] },
  { label: 'PHP', value: 'php', aliases: [] },
  { label: 'Swift', value: 'swift', aliases: [] },
  { label: 'Kotlin', value: 'kotlin', aliases: ['kt'] },
  { label: 'Dart', value: 'dart', aliases: [] },
  { label: 'Lua', value: 'lua', aliases: [] },
  { label: 'R', value: 'r', aliases: [] },
  { label: 'Scala', value: 'scala', aliases: [] },
  { label: 'Bash', value: 'bash', aliases: [] },
  { label: 'PowerShell', value: 'powershell', aliases: ['ps'] },
  { label: 'TOML', value: 'toml', aliases: [] },
  { label: 'INI', value: 'ini', aliases: [] },
  { label: 'GraphQL', value: 'graphql', aliases: ['gql'] },
  { label: 'Docker', value: 'docker', aliases: ['dockerfile'] },
];

const MIN_VISIBLE_LINES = 3;
const EDIT_HIGHLIGHT_DEBOUNCE_MS = 240;
const EDIT_HIGHLIGHT_MAX_CHARS = 20_000;
const DISPLAY_HIGHLIGHT_MAX_CHARS = 80_000;

/** 根据语言 value 获取对应的 label（大驼峰显示名），不在列表中则原样返回 */
function getLangLabel(value: string): string {
  if (!value) return 'code';
  const found = LANGUAGES.find((l) => l.value === value || l.aliases.includes(value));
  return found ? found.label : value;
}
const MAX_VISIBLE_LINES = 24;
const EDIT_LINE_HEIGHT_PX = 18;

// 将 Shiki token 行转为 HTML 字符串（用于高亮层 innerHTML）
function tokensToHtml(tokenLines: CodeTokenLine[]): string {
  return tokenLines
    .map((line) =>
      line.tokens
        .map((token) => {
          const escaped = escapeHtml(token.content);
          if (!token.color) return escaped;
          let style = `color: ${token.color}`;
          if (token.fontStyle === '2') style += '; font-style: italic';
          return `<span style="${style}">${escaped}</span>`;
        })
        .join(''),
    )
    .join('\n');
}

function getHighlightLanguage(params: string): string {
  return params.trim().split(/\s+/)[0] ?? '';
}

function countLines(text: string): number {
  let lines = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) lines += 1;
  }
  return lines;
}

function getCodeBlockIndentText(): string {
  const indent = document.documentElement.dataset.codeBlockIndent;
  if (indent === 'tab') {
    return '\t';
  }
  if (indent === 'spaces-4') {
    return '    ';
  }
  return '  ';
}

function runWhenIdle(callback: () => void, timeout = 500): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(id);
  }

  const id = setTimeout(callback, 0);
  return () => clearTimeout(id);
}

function createCopyIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '14');
  rect.setAttribute('height', '14');
  rect.setAttribute('x', '8');
  rect.setAttribute('y', '8');
  rect.setAttribute('rx', '2');
  rect.setAttribute('ry', '2');
  svg.appendChild(rect);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2');
  svg.appendChild(path);

  return svg;
}

function createCheckIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M20 6 9 17l-5-5');
  svg.appendChild(path);

  return svg;
}

export class CodeBlockNodeView {
  private static activeEditingView: CodeBlockNodeView | null = null;
  private static instances = new Set<CodeBlockNodeView>();

  dom: HTMLElement;

  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number;
  private renderId = 0;

  // 展示态相关
  private language: string;
  private langLabel: HTMLElement;
  private lineNumbersGutter: HTMLElement;
  private lineNumbersWrapper: HTMLElement; // 行号内部容器，用于滚动时 translateY
  private codeBody: HTMLElement;
  private codeDisplay: HTMLElement;

  // 编辑态相关
  private editing = false;
  private originalCode = '';
  private originalLanguage = '';
  private textarea: HTMLTextAreaElement | null = null;
  private highlightLayer: HTMLElement | null = null;
  private editArea: HTMLElement | null = null;
  private needsAutoEdit = false;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;
  private cancelPendingHighlight: (() => void) | null = null;
  private langSelector: HTMLElement | null = null;
  private copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.language = node.attrs.params ?? '';
    CodeBlockNodeView.instances.add(this);

    this.dom = document.createElement('section');
    this.dom.className = 'code-card';
    this.dom.contentEditable = 'false';

    // header：语言标签 + 操作按钮
    const header = document.createElement('header');
    this.langLabel = document.createElement('span');
    this.langLabel.textContent = getLangLabel(this.language);
    this.langLabel.style.cursor = 'pointer';
    this.langLabel.title = '选择语言';
    this.langLabel.addEventListener('click', (event) => {
      event.stopPropagation();
      this.showLangSelector();
    });
    header.appendChild(this.langLabel);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '6px';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.title = '复制代码';
    copyBtn.className = 'code-copy-button';
    copyBtn.setAttribute('aria-label', '复制代码');
    copyBtn.appendChild(createCopyIcon());
    copyBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      void this.copyCode(copyBtn);
    });
    actions.appendChild(copyBtn);
    header.appendChild(actions);
    this.dom.appendChild(header);

    // code-body：行号 + 代码展示区
    this.codeBody = document.createElement('div');
    this.codeBody.className = 'code-body';

    this.lineNumbersGutter = document.createElement('div');
    this.lineNumbersGutter.className = 'line-numbers-gutter';
    // 行号内部 wrapper：高度由内容撑开，gutter 作为裁剪容器
    this.lineNumbersWrapper = document.createElement('div');
    this.lineNumbersWrapper.className = 'line-numbers-wrapper';
    this.lineNumbersGutter.appendChild(this.lineNumbersWrapper);
    this.codeBody.appendChild(this.lineNumbersGutter);

    this.codeDisplay = document.createElement('pre');
    this.codeDisplay.className = 'code-content';
    const codeEl = document.createElement('code');
    this.codeDisplay.appendChild(codeEl);
    // 展示态滚动时同步行号位置
    this.codeDisplay.addEventListener('scroll', () => {
      this.lineNumbersWrapper.style.transform = `translateY(-${this.codeDisplay.scrollTop}px)`;
    });
    this.codeBody.appendChild(this.codeDisplay);
    this.dom.appendChild(this.codeBody);

    // 点击进入编辑态（尝试定位到点击的行）
    this.dom.addEventListener('click', (event) => {
      if (this.editing) return;
      if ((event.target as HTMLElement).closest('button')) return;
      event.preventDefault();
      event.stopPropagation();
      const clickLine = this.getClickLine(event);
      this.enterEdit(clickLine);
    });

    // 标记首次选中时自动进入编辑态（如 InputRule 从 ``` 创建 或快捷键插入）
    this.needsAutoEdit = true;

    // 初始渲染展示态
    this.renderDisplay();
  }

  static updateTheme(): void {
    for (const instance of CodeBlockNodeView.instances) {
      instance.renderDisplay();
      if (instance.editing && instance.textarea && instance.highlightLayer) {
        void instance.renderHighlightFor(
          instance.textarea.value,
          instance.language,
          instance.highlightLayer,
        );
      }
    }
  }

  // ---- NodeView 接口 ----

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.language = node.attrs.params ?? '';
    this.langLabel.textContent = getLangLabel(this.language);
    if (!this.editing) {
      this.renderDisplay();
    }
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
    // 首次创建的代码块自动进入编辑态
    if (this.needsAutoEdit) {
      this.needsAutoEdit = false;
      this.enterEdit(0, 'start');
    }
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
    if (this.editing) {
      this.exitEdit(true);
    }
  }

  stopEvent(event: Event): boolean {
    // 编辑态内拦截所有事件，防止 ProseMirror 处理
    if (this.editing) {
      if (this.dom.contains(event.target as Node)) return true;
    }
    return false;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    CodeBlockNodeView.instances.delete(this);
    this.cancelScheduledHighlight();
    if (this.copyFeedbackTimer) clearTimeout(this.copyFeedbackTimer);
    this.cleanupEdit();
  }

  // ---- 展示态渲染 ----

  private renderDisplay(): void {
    const code = this.node.textContent;
    this.updateLineNumbers(countLines(code));
    this.renderHighlightFor(code, this.language, this.codeDisplay, DISPLAY_HIGHLIGHT_MAX_CHARS);
  }

  private updateLineNumbers(lineCount: number): void {
    const currentCount = this.lineNumbersWrapper.children.length;
    if (currentCount !== lineCount) {
      this.lineNumbersWrapper.innerHTML = '';
      for (let i = 1; i <= lineCount; i++) {
        const span = document.createElement('span');
        span.textContent = String(i);
        this.lineNumbersWrapper.appendChild(span);
      }
      // 行号数量变化后同步行号栏宽度到编辑区 margin-left
      this.syncGutterWidth();
    }
  }

  /** 测量行号栏实际宽度，同步到编辑区的 margin-left */
  private syncGutterWidth(): void {
    if (!this.editArea) return;
    const gutterWidth = this.lineNumbersGutter.offsetWidth;
    if (gutterWidth > 0) {
      this.editArea.style.marginLeft = `${gutterWidth}px`;
    }
  }

  /** 为指定容器渲染高亮 HTML（异步，带 renderId 防过期） */
  private async renderHighlightFor(
    code: string,
    language: string,
    container: HTMLElement,
    richHighlightMaxChars = DISPLAY_HIGHLIGHT_MAX_CHARS,
  ): Promise<void> {
    const id = ++this.renderId;
    const codeEl = container.querySelector('code') ?? container;
    if (code.length > richHighlightMaxChars) {
      codeEl.textContent = code;
      return;
    }

    const codeTokenizer = getCodeTokenizer();
    if (!codeTokenizer) {
      // 无 tokenizer 时降级为纯文本
      codeEl.textContent = code;
      return;
    }
    // 根据当前主题选择 Shiki 主题
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const theme = isDark ? 'github-dark' : 'github-light';
    try {
      const result = await codeTokenizer.tokenize({
        code,
        language: getHighlightLanguage(language),
        theme,
      });
      if (id !== this.renderId) return; // 放弃过期渲染
      codeEl.innerHTML = tokensToHtml(result.tokens);
    } catch {
      if (id !== this.renderId) return;
      codeEl.textContent = code;
    }
  }

  // ---- 编辑态管理 ----

  enterEdit(clickLine?: number, caret: 'start' | 'end' = 'start'): void {
    if (this.editing) return;

    if (CodeBlockNodeView.activeEditingView && CodeBlockNodeView.activeEditingView !== this) {
      CodeBlockNodeView.activeEditingView.exitEdit(true);
    }

    this.editing = true;
    CodeBlockNodeView.activeEditingView = this;
    this.originalCode = this.node.textContent;
    this.originalLanguage = this.language;
    this.dom.classList.add('is-editing');
    this.dom.classList.remove('ProseMirror-selectednode');

    // 步骤1：隐藏展示态，构建编辑态布局
    this.codeDisplay.style.display = 'none';
    this.lineNumbersWrapper.innerHTML = '';

    this.editArea = document.createElement('div');
    this.editArea.className = 'code-edit-area';

    // 高亮层（叠在 textarea 下方）
    this.highlightLayer = document.createElement('pre');
    this.highlightLayer.className = 'code-highlight-layer';
    const highlightCode = document.createElement('code');
    this.highlightLayer.appendChild(highlightCode);
    this.editArea.appendChild(this.highlightLayer);

    // 输入层 textarea
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'code-input';
    this.textarea.value = this.originalCode;
    const initialLineCount = countLines(this.originalCode);
    this.syncTextareaRows(initialLineCount);
    this.textarea.spellcheck = false;
    this.textarea.setAttribute('autocorrect', 'off');
    this.textarea.setAttribute('autocapitalize', 'off');
    this.editArea.appendChild(this.textarea);

    this.codeBody.appendChild(this.editArea);

    // 步骤2：textarea 事件监听
    this.textarea.addEventListener('input', () => this.handleInput());
    this.textarea.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.textarea.addEventListener('scroll', () => this.handleScroll());
    this.textarea.addEventListener('blur', () => {
      // 延迟保存，避免点击语言选择器等内部元素时误触发
      setTimeout(() => {
        // 如果语言选择器打开中，不退出编辑态
        if (this.editing && !this.langSelector) this.exitEdit(true);
      }, 200);
    });

    // 步骤3：初始高亮渲染 + 行号
    this.updateLineNumbers(initialLineCount);
    this.renderHighlightFor(
      this.originalCode,
      this.language,
      this.highlightLayer,
      EDIT_HIGHLIGHT_MAX_CHARS,
    );

    // 初始同步行号栏宽度（updateLineNumbers 可能未触发 syncGutterWidth，这里兜底）
    this.syncGutterWidth();

    // 步骤4：聚焦 textarea，尝试定位到点击的行
    requestAnimationFrame(() => {
      if (!this.textarea) return;
      this.textarea.focus({ preventScroll: true });
      if (clickLine !== undefined) {
        const lines = this.textarea.value.split('\n');
        let offset = 0;
        for (let i = 0; i < Math.min(clickLine, lines.length); i++) {
          offset += lines[i].length + 1; // +1 for \n
        }
        if (caret === 'end' && clickLine < lines.length) {
          offset += lines[clickLine].length;
        }
        this.textarea.selectionStart = this.textarea.selectionEnd = Math.min(
          offset,
          this.textarea.value.length,
        );
      }
    });
  }

  static enterEditAt(
    view: EditorView,
    pos: number,
    clickLine: number,
    caret: 'start' | 'end',
  ): boolean {
    // 精确匹配
    for (const instance of CodeBlockNodeView.instances) {
      if (instance.view !== view) continue;
      if (instance.getPos() === pos) {
        instance.enterEdit(clickLine, caret);
        return true;
      }
    }
    return false;
  }

  private exitEdit(save: boolean): void {
    if (!this.editing) return;

    const newCode = save && this.textarea ? this.textarea.value : this.originalCode;

    this.cleanupEdit();

    // 步骤1：提交或恢复节点内容。选区由 ProseMirror 自己维护，避免 blur 后把旧代码块重新选中。
    const oldCode = this.node.textContent;
    if (save && newCode !== oldCode) {
      this.saveContent(newCode);
    }
  }

  private cleanupEdit(): void {
    this.editing = false;
    if (CodeBlockNodeView.activeEditingView === this) {
      CodeBlockNodeView.activeEditingView = null;
    }
    this.dom.classList.remove('is-editing');
    this.dom.classList.remove('is-highlight-pending');
    this.cancelScheduledHighlight();
    this.hideLangSelector();
    if (this.editArea) {
      this.editArea.remove();
      this.editArea = null;
    }
    this.textarea = null;
    this.highlightLayer = null;

    // 重置行号 wrapper 的滚动偏移
    this.lineNumbersWrapper.style.transform = '';

    // 恢复展示态
    this.codeDisplay.style.display = '';
    this.renderDisplay();
  }

  // ---- 编辑态事件处理 ----

  private handleInput(): void {
    if (!this.textarea) return;
    const code = this.textarea.value;
    const lineCount = countLines(code);
    this.syncTextareaRows(lineCount);
    this.updateLineNumbers(lineCount);
    this.dom.classList.add('is-highlight-pending');
    this.scheduleEditHighlight(code);
  }

  private scheduleEditHighlight(code: string): void {
    this.cancelScheduledHighlight();

    this.highlightTimer = setTimeout(() => {
      this.highlightTimer = null;
      this.cancelPendingHighlight = runWhenIdle(() => {
        this.cancelPendingHighlight = null;
        if (!this.highlightLayer || !this.editing) return;
        void this.renderHighlightFor(
          code,
          this.language,
          this.highlightLayer,
          EDIT_HIGHLIGHT_MAX_CHARS,
        ).finally(() => {
          if (this.editing && this.textarea?.value === code) {
            this.dom.classList.remove('is-highlight-pending');
          }
        });
      });
    }, EDIT_HIGHLIGHT_DEBOUNCE_MS);
  }

  private cancelScheduledHighlight(): void {
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
      this.highlightTimer = null;
    }
    if (this.cancelPendingHighlight) {
      this.cancelPendingHighlight();
      this.cancelPendingHighlight = null;
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.textarea) return;

    // Shift+Ctrl+Enter：保存退出编辑态，并在上方插入新段落
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      const pos = this.getPos();
      this.exitEdit(true);
      // 在代码块上方插入空段落，光标移入
      const paragraph = this.view.state.schema.nodes.paragraph.create();
      const tr = this.view.state.tr.insert(pos, paragraph);
      this.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1)));
      this.view.focus();
      return;
    }

    // Ctrl+Enter：保存退出编辑态，并在下方插入新段落
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const pos = this.getPos();
      this.exitEdit(true);
      // 在代码块下方插入空段落，光标移入
      const afterPos = pos + this.node.nodeSize;
      if (afterPos <= this.view.state.doc.content.size) {
        const paragraph = this.view.state.schema.nodes.paragraph.create();
        const tr = this.view.state.tr.insert(afterPos, paragraph);
        this.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, afterPos + 1)));
        this.view.focus();
      }
      return;
    }

    // Escape：放弃修改退出编辑态
    if (e.key === 'Escape') {
      e.preventDefault();
      this.exitEdit(false);
      return;
    }

    // Shift+Ctrl+K：代码块开关——取消代码块，恢复为段落
    if (e.key === 'K' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      const cbPos = this.getPos();
      const code = this.textarea.value;
      const view = this.view;
      this.exitEdit(true);

      const doc = view.state.doc;
      const cbNode = doc.nodeAt(cbPos);
      if (!cbNode || cbNode.type.name !== 'code_block') return;

      const lines = code.split('\n');
      const paragraphs: ProseMirrorNode[] = [];
      const paraType = view.state.schema.nodes.paragraph;
      for (const line of lines) {
        paragraphs.push(
          line ? paraType.create({}, view.state.schema.text(line)) : paraType.create(),
        );
      }

      const cbEnd = cbPos + cbNode.nodeSize;
      const tr = view.state.tr.replaceWith(cbPos, cbEnd, paragraphs);
      if (code) {
        const fragSize = paragraphs.reduce((s, p) => s + p.nodeSize, 0);
        tr.setSelection(TextSelection.create(tr.doc, cbPos, cbPos + fragSize));
      } else {
        tr.setSelection(TextSelection.near(tr.doc.resolve(cbPos), 1));
      }
      view.dispatch(tr.scrollIntoView());
      view.focus();
      return;
    }

    // ArrowDown：光标在最后一行时跳出代码块，移到下一个块
    if (e.key === 'ArrowDown' && !e.shiftKey) {
      const { selectionStart, value } = this.textarea;
      const afterCursor = value.slice(selectionStart);
      // 光标之后没有换行符 = 在最后一行
      if (!afterCursor.includes('\n')) {
        e.preventDefault();
        const pos = this.getPos();
        const oldCode = this.node.textContent;
        const nextPos = pos + this.node.nodeSize;
        const nextNode = this.view.state.doc.nodeAt(nextPos);
        const adjustedNextPos = nextPos + value.length - oldCode.length;
        const nextCodeBlockPos = nextNode?.type.name === 'code_block' ? adjustedNextPos : null;

        this.exitEdit(true);

        const { state } = this.view;
        if (
          nextCodeBlockPos !== null &&
          state.doc.nodeAt(nextCodeBlockPos)?.type.name === 'code_block'
        ) {
          const tr = state.tr.setSelection(NodeSelection.create(state.doc, nextCodeBlockPos));
          this.view.dispatch(tr);
          CodeBlockNodeView.enterEditAt(this.view, nextCodeBlockPos, 0, 'start');
          return;
        }

        // 将 ProseMirror 选区移到代码块之后
        if (adjustedNextPos <= state.doc.content.size) {
          const $pos = state.doc.resolve(Math.min(adjustedNextPos, state.doc.content.size));
          this.view.dispatch(state.tr.setSelection(TextSelection.near($pos)));
          this.view.focus();
        }
        return;
      }
    }

    // ArrowUp：光标在第一行时跳出代码块，移到上一个块
    if (e.key === 'ArrowUp' && !e.shiftKey) {
      const { selectionStart, value } = this.textarea;
      const beforeCursor = value.slice(0, selectionStart);
      // 光标之前没有换行符 = 在第一行
      if (!beforeCursor.includes('\n')) {
        e.preventDefault();
        const pos = this.getPos();
        const nodeBefore = this.view.state.doc.resolve(pos).nodeBefore;
        const previousCodeBlockPos =
          nodeBefore?.type.name === 'code_block' ? pos - nodeBefore.nodeSize : null;
        const previousCodeBlockLine =
          nodeBefore?.type.name === 'code_block'
            ? nodeBefore.textContent.split('\n').length - 1
            : 0;

        this.exitEdit(true);

        const { state } = this.view;
        if (
          previousCodeBlockPos !== null &&
          state.doc.nodeAt(previousCodeBlockPos)?.type.name === 'code_block'
        ) {
          const tr = state.tr.setSelection(NodeSelection.create(state.doc, previousCodeBlockPos));
          this.view.dispatch(tr);
          CodeBlockNodeView.enterEditAt(
            this.view,
            previousCodeBlockPos,
            previousCodeBlockLine,
            'end',
          );
          return;
        }

        // 将 ProseMirror 选区移到代码块之前
        if (pos > 0) {
          const $pos = state.doc.resolve(pos);
          this.view.dispatch(state.tr.setSelection(TextSelection.near($pos, -1)));
          this.view.focus();
        }
        return;
      }
    }

    // 格式化快捷键：退出编辑态，转发给 ProseMirror keymap
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && /^[biu`]$/i.test(e.key)) {
      e.preventDefault();
      this.exitEdit(true);
      this.view.focus();
      this.view.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: e.key,
          code: e.code,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          bubbles: true,
        }),
      );
      return;
    }

    // Tab：按用户偏好的缩进插入（用 execCommand 保留浏览器 undo 栈）
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertText', false, getCodeBlockIndentText());
      return;
    }

    // Shift+Tab：当前行减少一级缩进
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const { selectionStart, value } = this.textarea;
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const indentText = getCodeBlockIndentText();
      if (value.slice(lineStart, lineStart + indentText.length) === indentText) {
        this.textarea.setSelectionRange(lineStart, lineStart + indentText.length);
        document.execCommand('insertText', false, '');
      }
      return;
    }

    // Enter：正常换行（不拦截，textarea 自然处理）
  }

  private handleScroll(): void {
    if (!this.textarea || !this.highlightLayer) return;
    // 同步高亮层滚动位置
    this.highlightLayer.style.transform = `translate(-${this.textarea.scrollLeft}px, -${this.textarea.scrollTop}px)`;
    // 同步行号滚动位置（作用在 wrapper 上，gutter 作为裁剪容器）
    this.lineNumbersWrapper.style.transform = `translateY(-${this.textarea.scrollTop}px)`;
  }

  private syncTextareaRows(lineCount: number): void {
    if (!this.textarea) return;
    this.textarea.rows = Math.min(Math.max(lineCount, MIN_VISIBLE_LINES), MAX_VISIBLE_LINES);
  }

  // ---- 语言选择器 ----

  private showLangSelector(): void {
    if (this.langSelector) return; // 已打开

    this.langSelector = document.createElement('div');
    this.langSelector.className = 'lang-selector';

    // 搜索输入框
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'lang-selector-search';
    searchInput.placeholder = '搜索语言…';
    searchInput.value = this.language;
    this.langSelector.appendChild(searchInput);

    // 语言列表容器
    const listEl = document.createElement('ul');
    listEl.className = 'lang-selector-list';
    this.langSelector.appendChild(listEl);

    // 渲染过滤后的列表
    const renderList = (filter: string) => {
      const lowerFilter = filter.toLowerCase().trim();
      const matched = LANGUAGES.filter(
        (lang) =>
          !lowerFilter ||
          lang.label.toLowerCase().includes(lowerFilter) ||
          lang.value.toLowerCase().includes(lowerFilter) ||
          lang.aliases.some((a) => a.toLowerCase().includes(lowerFilter)),
      );
      listEl.innerHTML = '';
      for (const lang of matched) {
        const li = document.createElement('li');
        li.className = 'lang-selector-item';
        if (lang.value === this.language) li.classList.add('is-active');
        li.textContent = lang.label;
        li.addEventListener('mousedown', (e) => {
          e.preventDefault(); // 阻止 blur
          this.applyLanguage(lang.value);
          this.hideLangSelector();
        });
        listEl.appendChild(li);
      }
      // 如果输入了自定义语言名且不在列表中，显示"使用: xxx"
      if (lowerFilter && !matched.some((l) => l.value === lowerFilter)) {
        const customLi = document.createElement('li');
        customLi.className = 'lang-selector-item lang-selector-custom';
        customLi.textContent = `使用: ${filter.trim()}`;
        customLi.addEventListener('mousedown', (e) => {
          e.preventDefault();
          this.applyLanguage(filter.trim());
          this.hideLangSelector();
        });
        listEl.appendChild(customLi);
      }
    };

    renderList(this.language);

    searchInput.addEventListener('input', () => renderList(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // 选中当前高亮项或使用输入值
        const activeItem = listEl.querySelector('.lang-selector-item') as HTMLElement | null;
        const value = activeItem?.textContent?.startsWith('使用:')
          ? searchInput.value.trim()
          : (LANGUAGES.find((l) => l.label === activeItem?.textContent)?.value ??
            searchInput.value.trim());
        this.applyLanguage(value);
        this.hideLangSelector();
        // 返回焦点到 textarea
        requestAnimationFrame(() => this.textarea?.focus());
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hideLangSelector();
        requestAnimationFrame(() => this.textarea?.focus());
      }
    });
    searchInput.addEventListener('blur', () => {
      // 延迟关闭，避免 mousedown 事件被拦截
      setTimeout(() => this.hideLangSelector(), 200);
    });

    this.dom.appendChild(this.langSelector);

    // 定位到语言标签下方
    const labelRect = this.langLabel.getBoundingClientRect();
    const cardRect = this.dom.getBoundingClientRect();
    this.langSelector.style.position = 'absolute';
    this.langSelector.style.top = `${labelRect.bottom - cardRect.top + 4}px`;
    this.langSelector.style.left = `${labelRect.left - cardRect.left}px`;

    requestAnimationFrame(() => {
      searchInput.focus();
      searchInput.select();
    });
  }

  private hideLangSelector(): void {
    if (this.langSelector) {
      this.langSelector.remove();
      this.langSelector = null;
    }
  }

  /** 应用语言选择：更新节点 attrs 并重新高亮 */
  private applyLanguage(lang: string): void {
    if (!lang) return;
    this.language = lang;
    this.langLabel.textContent = getLangLabel(lang);
    // 更新节点 attrs.params
    const pos = this.getPos();
    const node = this.view.state.doc.nodeAt(pos);
    if (node) {
      this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, null, { params: lang }));
    }
    // 重新高亮
    if (this.editing && this.textarea && this.highlightLayer) {
      this.renderHighlightFor(
        this.textarea.value,
        lang,
        this.highlightLayer,
        EDIT_HIGHLIGHT_MAX_CHARS,
      );
    } else {
      this.renderDisplay();
    }
  }

  // ---- 辅助方法 ----

  /** 计算点击位置对应的行号（从 0 开始） */
  private getClickLine(event: MouseEvent): number {
    const codeRect = this.codeBody.getBoundingClientRect();
    const relativeY = event.clientY - codeRect.top + this.codeBody.scrollTop;
    return Math.max(0, Math.floor(relativeY / EDIT_LINE_HEIGHT_PX));
  }

  /** 通过 transaction 更新节点内容 */
  private saveContent(newCode: string, newLanguage?: string): void {
    const pos = this.getPos();
    const node = this.view.state.doc.nodeAt(pos);
    if (!node) return;
    const attrs = { params: newLanguage ?? node.attrs.params };
    const content = newCode ? this.view.state.schema.text(newCode) : undefined;
    const newNode = node.type.create(attrs, content);
    this.view.dispatch(this.view.state.tr.replaceWith(pos, pos + node.nodeSize, newNode));
  }

  private async copyCode(button: HTMLButtonElement): Promise<void> {
    const text = this.editing && this.textarea ? this.textarea.value : this.node.textContent;
    const copied = await this.writeClipboardText(text);
    this.showCopyFeedback(button, copied);
  }

  private async writeClipboardText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        return document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  private showCopyFeedback(button: HTMLButtonElement, copied: boolean): void {
    if (this.copyFeedbackTimer) clearTimeout(this.copyFeedbackTimer);

    button.classList.remove('is-copied', 'is-copy-error');
    button.classList.add(copied ? 'is-copied' : 'is-copy-error');
    button.title = copied ? '已复制' : '复制失败';
    button.setAttribute('aria-label', copied ? '已复制' : '复制失败');
    button.replaceChildren(copied ? createCheckIcon() : createCopyIcon());

    this.copyFeedbackTimer = setTimeout(
      () => {
        button.classList.remove('is-copied', 'is-copy-error');
        button.title = '复制代码';
        button.setAttribute('aria-label', '复制代码');
        button.replaceChildren(createCopyIcon());
        this.copyFeedbackTimer = null;
      },
      copied ? 1200 : 1500,
    );
  }
}
