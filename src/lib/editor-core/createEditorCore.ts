import { chainCommands, createParagraphNear, exitCode, liftEmptyBlock, newlineInCode, setBlockType, splitBlock, toggleMark, wrapIn } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { inputRules, textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { defaultMarkdownParser, defaultMarkdownSerializer, schema } from 'prosemirror-markdown';
import type { MarkType, Node as ProseMirrorNode, NodeType } from 'prosemirror-model';
import { EditorState, Plugin, PluginKey, TextSelection, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import type {
  EditorChangeEvent,
  EditorCommand,
  EditorCore,
  EditorCoreOptions,
  EditorListener,
  EditorRuntimeOptions,
  EditorSnapshot,
  EditorThemeOptions,
  SetMarkdownOptions
} from './types';
import type { CodeTokenizer, CodeTokenLine, DiagramRenderer, MathRenderer } from '../services/render';

const LARGE_DOCUMENT_SEMANTIC_LIMIT = 300_000;


let codeTokenizer: CodeTokenizer | null = null;
let diagramRenderer: DiagramRenderer | null = null;
let mathRenderer: MathRenderer | null = null;

export function setCodeBlockTokenizer(tokenizer: CodeTokenizer): void {
  codeTokenizer = tokenizer;
}

export function setCodeBlockDiagramRenderer(renderer: DiagramRenderer): void {
  diagramRenderer = renderer;
}

export function setCodeBlockMathRenderer(renderer: MathRenderer): void {
  mathRenderer = renderer;
}

const taskListPluginKey = new PluginKey("taskList");
const codeHighlightKey = new PluginKey("codeHighlight");
const mathBlockKey = new PluginKey("mathBlock");
const tableHtmlKey = new PluginKey("tableHtml");

export function createEditorCore(options: EditorCoreOptions): EditorCore {
  return new ProseMirrorEditorCore(options);
}


class CodeBlockNodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number;
  private language: string;
  private langLabel: HTMLElement;
  private diagramContainer: HTMLElement | null = null;
  private previewBtn: HTMLButtonElement | null = null;
  private previewVisible = false;
  private codePre: HTMLElement;
  private lineNumbersGutter: HTMLElement;
  private codeBody: HTMLElement;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.language = node.attrs.params ?? '';

    this.dom = document.createElement('section');
    this.dom.className = 'code-card';

    const header = document.createElement('header');
    this.langLabel = document.createElement('span');
    this.langLabel.textContent = this.language || 'code';
    header.appendChild(this.langLabel);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '6px';

    if (this.language === 'mermaid') {
      this.previewBtn = document.createElement('button');
      this.previewBtn.type = 'button';
      this.previewBtn.title = '切换图表预览';
      this.previewBtn.textContent = '预览';
      this.previewBtn.addEventListener('click', (e) => { e.stopPropagation(); this.togglePreview(); });
      actions.appendChild(this.previewBtn);
    }

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.title = '复制代码';
    copyBtn.textContent = '复制';
    copyBtn.addEventListener('click', (e) => { e.stopPropagation(); this.copyCode(); });
    actions.appendChild(copyBtn);
    header.appendChild(actions);
    this.dom.appendChild(header);

    this.codeBody = document.createElement('div');
    this.codeBody.className = 'code-body';

    this.lineNumbersGutter = document.createElement('div');
    this.lineNumbersGutter.className = 'line-numbers-gutter';
    this.codeBody.appendChild(this.lineNumbersGutter);

    this.codePre = document.createElement('pre');
    this.codePre.className = 'code-content';
    this.contentDOM = document.createElement('code');
    this.codePre.appendChild(this.contentDOM);
    this.codeBody.appendChild(this.codePre);
    this.dom.appendChild(this.codeBody);

    this.scheduleHighlight();
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.language = node.attrs.params ?? '';
    this.langLabel.textContent = this.language || 'code';
    this.scheduleHighlight();
    if (this.previewVisible) this.renderDiagram();
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  stopEvent(event: Event): boolean {
    return (event.target as HTMLElement).closest('button') !== null;
  }

  ignoreMutation(): boolean {
    return false;
  }

  private scheduleHighlight(): void {
    requestAnimationFrame(() => this.applyHighlight());
  }

  private updateLineNumbers(): void {
    const lineCount = this.node.textContent.split('\n').length;
    const currentCount = this.lineNumbersGutter.children.length;
    if (currentCount !== lineCount) {
      this.lineNumbersGutter.innerHTML = '';
      for (let i = 1; i <= lineCount; i++) {
        const span = document.createElement('span');
        span.textContent = String(i);
        this.lineNumbersGutter.appendChild(span);
      }
    }
  }

  private async applyHighlight(): Promise<void> {
    this.updateLineNumbers();
    if (this.language === 'diff') {
      this.codePre.classList.add('diff-mode');
    } else {
      this.codePre.classList.remove('diff-mode');
    }
    if (this.language === 'mermaid') return;
    if (!codeTokenizer) return;
    try {
      const result = await codeTokenizer.tokenize({ code: this.node.textContent, language: this.language, theme: 'dark' });
      const decoArray = buildCodeDecorations(result.tokens, this.getPos() + 1);
      const decoSet = DecorationSet.create(this.view.state.doc, decoArray);
      this.view.dispatch(this.view.state.tr.setMeta(codeHighlightKey, decoSet));
    } catch {
      this.view.dispatch(this.view.state.tr.setMeta(codeHighlightKey, DecorationSet.empty));
    }
  }

  private togglePreview(): void {
    if (this.previewVisible) {
      this.hidePreview();
    } else {
      this.showPreview();
    }
  }

  private showPreview(): void {
    if (!diagramRenderer) return;
    this.previewVisible = true;
    if (this.previewBtn) this.previewBtn.textContent = '源码';
    this.codePre.style.display = 'none';
    this.lineNumbersGutter.style.display = 'none';
    this.renderDiagram();
  }

  private hidePreview(): void {
    this.previewVisible = false;
    if (this.previewBtn) this.previewBtn.textContent = '预览';
    if (this.diagramContainer) {
      this.diagramContainer.remove();
      this.diagramContainer = null;
    }
    this.codePre.style.display = '';
    this.lineNumbersGutter.style.display = '';
  }

  private async renderDiagram(): Promise<void> {
    if (!diagramRenderer) return;
    if (!this.diagramContainer) {
      this.diagramContainer = document.createElement('div');
      this.diagramContainer.className = 'mermaid-block';
      this.diagramContainer.style.padding = '24px';
      this.diagramContainer.style.overflow = 'auto';
      this.dom.appendChild(this.diagramContainer);
    }
    try {
      const result = await diagramRenderer.renderMermaid(this.node.textContent, { theme: 'light' });
      if (result.error) {
        this.diagramContainer.innerHTML = `<div class="mermaid-error" style="padding:16px;color:var(--md-editor-warning);font-size:13px;">图表渲染失败：${escapeHtml(result.error)}</div>`;
      } else if (result.svg) {
        this.diagramContainer.innerHTML = result.svg;
      }
    } catch {
      this.diagramContainer.innerHTML = `<div class="mermaid-error" style="padding:16px;color:var(--md-editor-warning);font-size:13px;">图表渲染异常</div>`;
    }
  }

  private copyCode(): void {
    const text = this.node.textContent;
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  destroy(): void { }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

class ProseMirrorEditorCore implements EditorCore {
  private target: HTMLElement | null;
  private view: EditorView | null = null;
  private markdown: string;
  private frontMatter = '';
  private version = 0;
  private dirty = false;
  private destroyed = false;
  private runtime: EditorRuntimeOptions;
  private listeners = new Set<EditorListener>();

  constructor(private readonly options: EditorCoreOptions) {
    this.target = options.target ?? null;
    this.markdown = options.markdown;
    this.frontMatter = splitFrontMatter(options.markdown).frontMatter;
    this.runtime = {
      readonly: options.readonly ?? false,
      mode: options.mode ?? 'semantic'
    };

    if (this.target) {
      this.mount(this.target);
    }
  }

  mount(target: HTMLElement): void {
    this.assertActive();
    this.target = target;
    this.view?.destroy();
    this.view = new EditorView(target, {
      state: this.createState(this.markdown),
      dispatchTransaction: (transaction) => this.dispatchTransaction(transaction),
      editable: () => !this.runtime.readonly && this.runtime.mode === 'semantic',
      nodeViews: {
        code_block: (node, view, getPos) => new CodeBlockNodeView(node, view, getPos as () => number)
      }
    });
  }

  destroy(): void {
    this.listeners.clear();
    this.view?.destroy();
    this.view = null;
    this.target = null;
    this.destroyed = true;
  }

  getMarkdown(): string {
    this.assertActive();
    return this.markdown;
  }

  setMarkdown(markdown: string, options?: SetMarkdownOptions): void {
    this.assertActive();
    this.markdown = markdown;
    this.frontMatter = splitFrontMatter(markdown).frontMatter;
    this.version += 1;
    this.dirty = options?.dirty ?? (options?.reason !== 'open-file' && options?.reason !== 'save-file' && options?.reason !== 'switch-tab');
    this.replaceViewState(markdown);
    this.emit(options?.reason ?? 'programmatic-update');
  }

  getSnapshot(): EditorSnapshot {
    this.assertActive();
    return {
      markdown: this.markdown,
      version: this.version,
      meta: {
        mode: this.runtime.mode
      }
    };
  }

  restoreSnapshot(snapshot: EditorSnapshot): void {
    this.assertActive();
    this.markdown = snapshot.markdown;
    this.version = snapshot.version;
    this.dirty = true;
    this.replaceViewState(snapshot.markdown);
    this.emit('restore-snapshot');
  }

  focus(): void {
    this.view?.focus();
  }

  blur(): void {
    if (this.view?.dom instanceof HTMLElement) {
      this.view.dom.blur();
    }
  }

  execute(command: EditorCommand): boolean {
    this.assertActive();

    if (!this.canExecute(command)) {
      return false;
    }

    if (!this.view) {
      return false;
    }

    return this.runProseMirrorCommand(command);
  }

  canExecute(command: EditorCommand): boolean {
    if (this.destroyed || this.runtime.readonly) {
      return command.type === 'undo' || command.type === 'redo';
    }

    return true;
  }

  updateTheme(theme: EditorThemeOptions): void {
    this.assertActive();
    this.options.theme = theme;
    this.emit(`theme:${theme.name}`);
  }

  updateOptions(options: Partial<EditorRuntimeOptions>): void {
    this.assertActive();
    this.runtime = {
      ...this.runtime,
      ...options
    };
    this.view?.setProps({
      editable: () => !this.runtime.readonly && this.runtime.mode === 'semantic'
    });
    this.emit('runtime-options');
  }

  subscribe(listener: EditorListener): () => void {
    this.assertActive();
    this.listeners.add(listener);
    listener(this.createChangeEvent('subscribe'));

    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(reason: string): void {
    const event = this.createChangeEvent(reason);
    this.options.onChange?.(event);
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private createChangeEvent(reason: string): EditorChangeEvent {
    return {
      markdown: this.markdown,
      version: this.version,
      dirty: this.dirty,
      mode: this.runtime.mode,
      readonly: this.runtime.readonly,
      reason
    };
  }

  private createState(markdown: string): EditorState {
    return EditorState.create({
      doc: parseMarkdown(markdown),
      plugins: [
        inputRules({
          rules: createMarkdownInputRules()
        }),
        history(),
        taskListPlugin(),
        codeHighlightPlugin(),
        mathBlockPlugin(),
        tableHtmlBlockPlugin(),
        keymap({
          'Mod-z': undo,
          'Mod-y': redo,
          'Shift-Mod-z': redo,
          'Mod-b': toggleMark(schema.marks.strong),
          'Mod-i': toggleMark(schema.marks.em),
          'Ctrl-`': toggleMark(schema.marks.code),
          'Enter': chainCommands(newlineInCode, splitListItem(schema.nodes.list_item), createParagraphNear, liftEmptyBlock, splitBlock),
          'Tab': sinkListItem(schema.nodes.list_item),
          'Shift-Tab': liftListItem(schema.nodes.list_item)
        })
      ]
    });
  }

  private dispatchTransaction(transaction: Transaction): void {
    if (!this.view) {
      return;
    }

    const nextState = this.view.state.apply(transaction);
    this.view.updateState(nextState);

    if (!transaction.docChanged) {
      return;
    }

    this.markdown = `${this.frontMatter}${serializeMarkdown(nextState.doc)}`;
    this.version += 1;
    this.dirty = true;
    this.emit('transaction');
  }

  private replaceViewState(markdown: string): void {
    if (!this.view) {
      return;
    }
    if (this.runtime.mode === 'source' && markdown.length > LARGE_DOCUMENT_SEMANTIC_LIMIT) {
      return;
    }

    this.view.updateState(this.createState(markdown));
  }

  private runProseMirrorCommand(command: EditorCommand): boolean {
    if (!this.view) {
      return false;
    }

    const { state, dispatch } = this.view;
    const run = (fn: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean) => fn(state, dispatch);

    switch (command.type) {
      case 'toggleBold':
        return run(toggleMark(schema.marks.strong));
      case 'toggleItalic':
        return run(toggleMark(schema.marks.em));
      case 'toggleCode':
        return run(toggleMark(schema.marks.code));
      case 'setHeading':
        return run(setBlockType(schema.nodes.heading, { level: command.level }));
      case 'setParagraph':
        return run(setBlockType(schema.nodes.paragraph));
      case 'toggleBlockquote':
        return run(wrapIn(schema.nodes.blockquote));
      case 'toggleBulletList':
        return run(wrapInList(schema.nodes.bullet_list));
      case 'toggleOrderedList':
        return run(wrapInList(schema.nodes.ordered_list));
      case 'insertLink':
        return this.insertTextWithOptionalMark(command.text ?? command.href, schema.marks.link, {
          href: command.href,
          title: command.title ?? null
        });
      case 'insertImage':
        return this.insertInlineNode(schema.nodes.image, {
          src: command.src,
          alt: command.alt ?? null,
          title: command.title ?? null
        });
      case 'insertCodeBlock':
        return this.insertBlock(schema.nodes.code_block, command.code ?? '', command.language ? { params: command.language } : undefined);
      case 'toggleTaskList':
        return this.insertMarkdownSnippet('- [ ] 待办事项\n');
      case 'insertMathBlock':
        return this.insertMarkdownSnippet(`$$\n${command.tex ?? 'E = mc^2'}\n$$\n`);
      case 'insertMermaidBlock':
        return this.insertMarkdownSnippet(`\`\`\`mermaid\n${command.code ?? 'flowchart TD\\n  A --> B'}\n\`\`\`\n`);
      case 'insertTable':
        return this.insertMarkdownSnippet(createTableMarkdown(command.rows ?? 3, command.columns ?? 3));
      case 'undo':
        return run(undo);
      case 'redo':
        return run(redo);
      case 'scrollToHeading':
        return this.scrollToHeading(command.headingIndex, command.text);
      default:
        return false;
    }
  }


  private scrollToHeading(headingIndex: number, text: string): boolean {
    if (!this.view) return false;

    let foundPos: number | null = null;
    let headingCount = 0;
    this.view.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading") {
        headingCount++;
        if (headingCount === headingIndex + 1) {
          foundPos = pos;
          return false;
        }
      }
    });

    if (foundPos === null) return false;

    const $pos = this.view.state.doc.resolve(foundPos);
    const tr = this.view.state.tr.setSelection(TextSelection.near($pos));
    tr.scrollIntoView();
    this.view.dispatch(tr);
    return true;
  }

  private insertTextWithOptionalMark(text: string, markType: MarkType, attrs: Record<string, unknown>): boolean {
    if (!this.view) {
      return false;
    }

    const { state, dispatch } = this.view;
    const mark = markType.create(attrs);
    const tr = state.tr.replaceSelectionWith(schema.text(text, [mark]), false);
    dispatch(tr.scrollIntoView());
    return true;
  }

  private insertInlineNode(type: NodeType, attrs: Record<string, unknown>): boolean {
    if (!this.view) {
      return false;
    }

    const node = type.createAndFill(attrs);
    if (!node) {
      return false;
    }

    this.view.dispatch(this.view.state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  }

  private insertBlock(type: NodeType, text: string, attrs?: Record<string, unknown>): boolean {
    if (!this.view) {
      return false;
    }

    const content = text ? schema.text(text) : undefined;
    const node = type.create(attrs, content);
    this.view.dispatch(this.view.state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  }

  private insertMarkdownSnippet(snippet: string): boolean {
    const separator = this.markdown.endsWith('\n') ? '\n' : '\n\n';
    this.setMarkdown(`${this.markdown}${separator}${snippet}`, { reason: 'programmatic-update' });
    return true;
  }

  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('EditorCore has been destroyed.');
    }
  }
}

function parseMarkdown(markdown: string): ProseMirrorNode {
  try {
    return defaultMarkdownParser.parse(splitFrontMatter(markdown).body);
  } catch {
    return schema.node('doc', null, [schema.node('paragraph', null, [schema.text(splitFrontMatter(markdown).body)])]);
  }
}

function serializeMarkdown(doc: ProseMirrorNode): string {
  return defaultMarkdownSerializer.serialize(doc);
}

function splitFrontMatter(markdown: string): { frontMatter: string; body: string } {
  if (!markdown.startsWith('---\n')) {
    return { frontMatter: '', body: markdown };
  }

  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) {
    return { frontMatter: '', body: markdown };
  }

  const frontMatter = markdown.slice(0, end + 5);
  const body = markdown.slice(frontMatter.length).replace(/^\s+/, '');
  return { frontMatter, body };
}

function createTableMarkdown(rows: number, columns: number): string {
  const columnCount = Math.max(2, Math.min(columns, 6));
  const rowCount = Math.max(1, Math.min(rows, 8));
  const headers = Array.from({ length: columnCount }, (_, index) => `列 ${index + 1}`);
  const separator = Array.from({ length: columnCount }, () => '---');
  const body = Array.from({ length: rowCount }, (_, rowIndex) => headers.map((_, columnIndex) => `单元格 ${rowIndex + 1}-${columnIndex + 1}`));
  const lines = [headers, separator, ...body].map((cells) => `| ${cells.join(' | ')} |`);
  return `${lines.join('\n')}\n`;
}


function taskListPlugin(): Plugin {
  return new Plugin({
    key: taskListPluginKey,
    state: {
      init(_, state) {
        return buildTaskDecorations(state.doc);
      },
      apply(tr, oldSet, _oldState, newState) {
        if (!tr.docChanged) return oldSet;
        return buildTaskDecorations(newState.doc);
      }
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
      handleDOMEvents: {
        mousedown(view, event) {
          const target = event.target as HTMLElement;
          const widget = target.closest("[data-task-from]") as HTMLElement | null;
          if (!widget) return false;
          event.preventDefault();
          event.stopPropagation();
          const from = Number(widget.dataset.taskFrom);
          const to = Number(widget.dataset.taskTo);
          if (isNaN(from) || isNaN(to)) return false;
          const oldText = view.state.doc.textBetween(from, to);
          const newText = oldText === "[x]" ? "[ ]" : "[x]";
          view.dispatch(view.state.tr.replaceWith(from, to, schema.text(newText)));
          return true;
        }
      }
    }
  });
}

function buildTaskDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const text = node.text;
    if (!text) return;
    const match = text.match(/^\[([ x])\](.*)/);
    if (!match) return;
    const $pos = doc.resolve(pos);
    let inListItem = false;
    for (let i = $pos.depth; i >= 0; i--) {
      if ($pos.node(i).type.name === "list_item") {
        inListItem = true;
        break;
      }
    }
    if (!inListItem) return;
    const checked = match[1] === "x";
    const bracketStart = pos;
    const bracketEnd = pos + 3;
    const widget = createTaskCheckboxWidget(checked, bracketStart, bracketEnd);
    decorations.push(Decoration.widget(bracketStart, widget));
    decorations.push(Decoration.inline(bracketStart, bracketEnd, { style: "display: none;" }, { inclusiveStart: false, inclusiveEnd: false }));
  });
  return DecorationSet.create(doc, decorations);
}

function createTaskCheckboxWidget(checked: boolean, from: number, to: number): HTMLElement {
  const span = document.createElement("span");
  span.className = "task-checkbox-widget";
  span.setAttribute("contenteditable", "false");
  span.dataset.taskFrom = String(from);
  span.dataset.taskTo = String(to);
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.setAttribute("tabindex", "-1");
  span.appendChild(input);
  return span;
}

function codeHighlightPlugin(): Plugin {
  return new Plugin({
    key: codeHighlightKey,
    state: {
      init() { return DecorationSet.empty; },
      apply(tr, set) {
        const meta = tr.getMeta(codeHighlightKey);
        if (meta instanceof DecorationSet) return meta;
        return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
      }
    },
    props: {
      decorations(state) { return this.getState(state); }
    }
  });
}

function buildCodeDecorations(tokenLines: CodeTokenLine[], contentStart: number): Decoration[] {
  const decorations: Decoration[] = [];
  let pos = contentStart;
  for (const line of tokenLines) {
    for (const token of line.tokens) {
      const len = token.content.length;
      if (token.color && len > 0) {
        decorations.push(Decoration.inline(pos, pos + len, { style: `color: ${token.color}` }));
      }
      pos += len;
    }
    pos += 1;
  }
  return decorations;
}

function mathBlockPlugin(): Plugin {
  return new Plugin({
    key: mathBlockKey,
    state: {
      init() { return DecorationSet.empty; },
      apply(tr, set) {
        const meta = tr.getMeta(mathBlockKey);
        if (meta instanceof DecorationSet) return meta;
        return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
      }
    },
    view(editorView) {
      scheduleMathRender(editorView);
      return { update() {}, destroy() {} };
    },
    props: {
      decorations(state) { return this.getState(state); }
    }
  });
}

function scheduleMathRender(view: EditorView): void {
  requestAnimationFrame(() => renderMathBlocks(view));
}

interface MathMatch {
  from: number;
  to: number;
  tex: string;
  displayMode: boolean;
}

async function renderMathBlocks(view: EditorView): Promise<void> {
  if (!mathRenderer) return;
  const matches = findAllMathMatches(view.state.doc);
  if (matches.length === 0) {
    view.dispatch(view.state.tr.setMeta(mathBlockKey, DecorationSet.empty));
    return;
  }
  const decorations: Decoration[] = [];
  for (const m of matches) {
    decorations.push(Decoration.inline(m.from, m.to, { style: "display: none" }, { inclusiveStart: false, inclusiveEnd: false }));
    try {
      const result = await mathRenderer.render(m.tex, { displayMode: m.displayMode });
      const widget = createMathWidget(result.html, result.error, m.displayMode);
      decorations.push(Decoration.widget(m.from, widget, { side: 0 }));
    } catch {
      const widget = createMathWidget("", "KaTeX error", m.displayMode);
      decorations.push(Decoration.widget(m.from, widget, { side: 0 }));
    }
  }
  const decoSet = DecorationSet.create(view.state.doc, decorations);
  view.dispatch(view.state.tr.setMeta(mathBlockKey, decoSet));
}

function findAllMathMatches(doc: ProseMirrorNode): MathMatch[] {
  const matches: MathMatch[] = [];
  const topBlocks: Array<{ node: ProseMirrorNode; pos: number }> = [];
  doc.forEach((node, offset) => { topBlocks.push({ node, pos: offset }); });
  let i = 0;
  while (i < topBlocks.length) {
    const displayResult = tryMatchDisplayMath(topBlocks, i);
    if (displayResult) {
      matches.push(displayResult.match);
      i = displayResult.nextIndex;
      continue;
    }
    i += 1;
  }
  for (const block of topBlocks) {
    if (block.node.type.name !== "paragraph") continue;
    const text = block.node.textContent;
    if (!text.includes("$")) continue;
    const alreadyMatched = matches.some(m => block.pos >= m.from && block.pos < m.to);
    if (alreadyMatched) continue;
    findInlineMathInText(text, block.pos, matches);
  }
  return matches;
}

function tryMatchDisplayMath(blocks: Array<{ node: ProseMirrorNode; pos: number }>, startIndex: number): { match: MathMatch; nextIndex: number } | null {
  const first = blocks[startIndex];
  if (first.node.type.name !== "paragraph") return null;
  const firstText = first.node.textContent.trim();
  if (firstText !== "$$") return null;
  const texLines: string[] = [];
  let foundClose = false;
  let closeIndex = startIndex + 1;
  for (let j = startIndex + 1; j < blocks.length; j++) {
    const block = blocks[j];
    if (block.node.type.name !== "paragraph") break;
    const text = block.node.textContent.trim();
    if (text === "$$") {
      foundClose = true;
      closeIndex = j;
      break;
    }
    texLines.push(block.node.textContent);
  }
  if (!foundClose) return null;
  const from = blocks[startIndex].pos;
  const to = blocks[closeIndex].pos + blocks[closeIndex].node.nodeSize;
  return { match: { from, to, tex: texLines.join("\n"), displayMode: true }, nextIndex: closeIndex + 1 };
}

function findInlineMathInText(text: string, blockOffset: number, matches: MathMatch[]): void {
  if (text.startsWith("$$") && text.endsWith("$$") && text.length > 4) {
    const tex = text.slice(2, -2).trim();
    if (tex) {
      matches.push({ from: blockOffset + 1, to: blockOffset + 1 + text.length, tex, displayMode: true });
      return;
    }
  }
  const inlineRegex = /(?<!\$)\$(?!\$)([^$]+?)\$(?!\$)/g;
  let match: RegExpExecArray | null;
  while ((match = inlineRegex.exec(text)) !== null) {
    const tex = match[1];
    if (!tex.trim()) continue;
    const from = blockOffset + 1 + match.index;
    const to = from + match[0].length;
    matches.push({ from, to, tex, displayMode: false });
  }
}

function createMathWidget(html: string, error: string | undefined, displayMode: boolean): HTMLElement {
  const wrapper = document.createElement("span");
  wrapper.className = displayMode ? "math-widget math-display" : "math-widget math-inline";
  wrapper.setAttribute("contenteditable", "false");
  if (error) {
    wrapper.style.color = "var(--md-editor-warning, #9a6700)";
    wrapper.style.fontSize = "13px";
    wrapper.textContent = error;
  } else {
    wrapper.innerHTML = html;
  }
  return wrapper;
}

function tableHtmlBlockPlugin(): Plugin {
  return new Plugin({
    key: tableHtmlKey,
    state: {
      init(_, state) { return buildTableHtmlDecorations(state.doc); },
      apply(tr, oldSet, _oldState, newState) {
        if (!tr.docChanged) return oldSet;
        return buildTableHtmlDecorations(newState.doc);
      }
    },
    props: { decorations(state) { return this.getState(state); } }
  });
}

function buildTableHtmlDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  const blocks: Array<{ node: ProseMirrorNode; pos: number }> = [];
  doc.forEach((node, offset) => { blocks.push({ node, pos: offset }); });
  let i = 0;
  while (i < blocks.length) {
    const tableResult = tryParseTable(blocks, i);
    if (tableResult) {
      const { from, to, html } = tableResult;
      const widget = document.createElement("div");
      widget.className = "table-widget";
      widget.setAttribute("contenteditable", "false");
      widget.innerHTML = html;
      decorations.push(Decoration.widget(from, widget, { side: 0 }));
      decorations.push(Decoration.inline(from, to, { style: "display: none" }, { inclusiveStart: false, inclusiveEnd: false }));
      i = tableResult.nextIndex;
      continue;
    }
    const htmlResult = tryParseHtmlBlock(blocks[i]);
    if (htmlResult) {
      const { pos, node, safeHtml } = htmlResult;
      const widget = document.createElement("span");
      widget.className = "html-widget";
      widget.setAttribute("contenteditable", "false");
      widget.innerHTML = safeHtml;
      decorations.push(Decoration.widget(pos, widget, { side: 0 }));
      decorations.push(Decoration.inline(pos + 1, pos + node.nodeSize - 1, { style: "display: none" }, { inclusiveStart: false, inclusiveEnd: false }));
    }
    i += 1;
  }
  return decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty;
}

function tryParseTable(blocks: Array<{ node: ProseMirrorNode; pos: number }>, startIndex: number): { from: number; to: number; html: string; nextIndex: number } | null {
  const rows: string[][] = [];
  let hasSeparator = false;
  let i = startIndex;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block.node.type.name !== "paragraph") break;
    const text = block.node.textContent.trim();
    if (!text.startsWith("|") || !text.endsWith("|")) break;
    const parts = text.slice(1, -1).split("|").map(c => c.trim());
    let cols = 0;
    while (cols < parts.length && parts[cols] !== "") { cols++; }
    if (cols < 2) break;
    const stride = cols + 1;
    let pos = 0;
    let blockHasValidRows = false;
    while (pos + cols <= parts.length) {
      const cells = parts.slice(pos, pos + cols);
      if (cells.some(c => c === "")) break;
      if (cells.every(c => /^:?-{3,}:?$/.test(c))) {
        hasSeparator = true;
        blockHasValidRows = true;
        pos += stride;
        continue;
      }
      rows.push(cells);
      blockHasValidRows = true;
      pos += stride;
    }
    if (!blockHasValidRows) break;
    i += 1;
  }
  if (rows.length === 0 || i === startIndex) return null;
  let html = "<table>";
  if (rows.length > 0 && hasSeparator) {
    html += "<thead><tr>" + rows[0].map(c => `<th>${escapeHtml(c)}</th>`).join("") + "</tr></thead>";
    html += "<tbody>" + rows.slice(1).map(r => "<tr>" + r.map(c => `<td>${escapeHtml(c)}</td>`).join("") + "</tr>").join("") + "</tbody>";
  } else {
    html += "<tbody>" + rows.map(r => "<tr>" + r.map(c => `<td>${escapeHtml(c)}</td>`).join("") + "</tr>").join("") + "</tbody>";
  }
  html += "</table>";
  const from = blocks[startIndex].pos;
  const lastBlock = blocks[i - 1];
  const to = lastBlock.pos + lastBlock.node.nodeSize;
  return { from, to, html, nextIndex: i };
}

function tryParseHtmlBlock(block: { node: ProseMirrorNode; pos: number }): { pos: number; node: ProseMirrorNode; safeHtml: string } | null {
  const text = block.node.textContent.trim();
  if (!/^<(\w+)[^>]*>/.test(text)) return null;
  const safeHtml = sanitizeHtml(text);
  if (!safeHtml) return null;
  return { pos: block.pos, node: block.node, safeHtml };
}

function sanitizeHtml(html: string): string {
  if (/<script\b/i.test(html) || /<iframe\b/i.test(html) || /\bon\w+\s*=/i.test(html)) {
    return escapeHtml(html);
  }
  return html;
}

function createMarkdownInputRules() {
  return [
    textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({ level: match[1].length })),
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
    wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({ order: Number(match[1]) })),
    textblockTypeInputRule(/^```$/, schema.nodes.code_block)
  ];
}

