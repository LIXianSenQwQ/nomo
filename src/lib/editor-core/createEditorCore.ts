import { chainCommands, createParagraphNear, exitCode, liftEmptyBlock, newlineInCode, setBlockType, splitBlock, toggleMark, wrapIn } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { inputRules, textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { defaultMarkdownParser, defaultMarkdownSerializer, schema } from 'prosemirror-markdown';
import type { MarkType, Node as ProseMirrorNode, NodeType } from 'prosemirror-model';
import { EditorState, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
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

const LARGE_DOCUMENT_SEMANTIC_LIMIT = 300_000;

export function createEditorCore(options: EditorCoreOptions): EditorCore {
  return new ProseMirrorEditorCore(options);
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
      editable: () => !this.runtime.readonly && this.runtime.mode === 'semantic'
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
      default:
        return false;
    }
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

function createMarkdownInputRules() {
  return [
    textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({ level: match[1].length })),
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
    wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({ order: Number(match[1]) })),
    textblockTypeInputRule(/^```$/, schema.nodes.code_block)
  ];
}
