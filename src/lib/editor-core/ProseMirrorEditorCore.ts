import { chainCommands, createParagraphNear, liftEmptyBlock, newlineInCode, splitBlock, toggleMark } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { inputRules } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { EditorState, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import { goToNextCell, tableEditing } from 'prosemirror-tables';
import { CodeBlockNodeView } from './nodeViews/CodeBlockNodeView';
import { executeEditorCommand } from './editorCommands';
import { codeHighlightPlugin } from './plugins/codeHighlight';
import { mathBlockPlugin } from './plugins/mathBlock';
import { tableControlsPlugin } from './plugins/tableControls';
import { tableHtmlBlockPlugin } from './plugins/tableHtml';
import { taskListPlugin } from './plugins/taskList';
import { createMarkdownInputRules, parseMarkdown, serializeMarkdown, splitFrontMatter } from './markdown';
import { schema } from './schema';
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

export class ProseMirrorEditorCore implements EditorCore {
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
      editable: () => this.isEditable(),
      nodeViews: {
        code_block: (node, view, getPos) => new CodeBlockNodeView(node, view, getPos as () => number)
      }
    });
    this.refreshInitialEditableState();
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
      editable: () => this.isEditable()
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
        tableControlsPlugin(),
        tableEditing({ allowTableNodeSelection: true }),
        keymap({
          'Mod-z': undo,
          'Mod-y': redo,
          'Shift-Mod-z': redo,
          'Mod-b': toggleMark(schema.marks.strong),
          'Mod-i': toggleMark(schema.marks.em),
          'Ctrl-`': toggleMark(schema.marks.code),
          'Enter': chainCommands(newlineInCode, splitListItem(schema.nodes.list_item), createParagraphNear, liftEmptyBlock, splitBlock),
          'Tab': chainCommands(goToNextCell(1), sinkListItem(schema.nodes.list_item)),
          'Shift-Tab': chainCommands(goToNextCell(-1), liftListItem(schema.nodes.list_item))
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

  private isEditable(): boolean {
    return !this.runtime.readonly && this.runtime.mode === 'semantic';
  }

  private refreshInitialEditableState(): void {
    const view = this.view;
    if (!view || !this.isEditable()) {
      return;
    }

    view.setProps({ editable: () => false });
    requestAnimationFrame(() => {
      if (this.destroyed || this.view !== view) {
        return;
      }
      view.setProps({ editable: () => this.isEditable() });
    });
  }

  private runProseMirrorCommand(command: EditorCommand): boolean {
    if (!this.view) {
      return false;
    }
    return executeEditorCommand(command, this.view, this.markdown, (markdown, options) => this.setMarkdown(markdown, options));
  }

  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('EditorCore has been destroyed.');
    }
  }
}
