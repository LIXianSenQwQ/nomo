import {
  chainCommands,
  createParagraphNear,
  deleteSelection,
  joinBackward,
  liftEmptyBlock,
  newlineInCode,
  selectNodeBackward,
  splitBlock,
  toggleMark,
} from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { inputRules } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { EditorState, NodeSelection, TextSelection, type Transaction } from 'prosemirror-state';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import { goToNextCell, tableEditing } from 'prosemirror-tables';
import { CodeBlockNodeView } from './nodeViews/CodeBlockNodeView';
import { CommentBlockNodeView } from './nodeViews/CommentBlockNodeView';
import { CommentInlineNodeView } from './nodeViews/CommentInlineNodeView';
import { FootnoteDefNodeView } from './nodeViews/FootnoteDefNodeView';
import { FootnoteRefNodeView } from './nodeViews/FootnoteRefNodeView';
import { HtmlBlockNodeView } from './nodeViews/HtmlBlockNodeView';
import { ImageNodeView } from './nodeViews/ImageNodeView';
import { MathBlockNodeView } from './nodeViews/MathBlockNodeView';
import { MathInlineNodeView } from './nodeViews/MathInlineNodeView';
import { MermaidBlockNodeView } from './nodeViews/MermaidBlockNodeView';
import { CalloutNodeView } from './nodeViews/CalloutNodeView';
import { HorizontalRuleNodeView } from './nodeViews/HorizontalRuleNodeView';
import { TocBlockNodeView } from './nodeViews/TocBlockNodeView';
import { executeEditorCommand, toggleList, toggleTaskListAtCursor } from './editorCommands';
import { findActiveLinkRange } from './editorCommands';
import { codeHighlightPlugin } from './plugins/codeHighlight';
import { codeHighlightDecorationPlugin } from './plugins/codeHighlightDecorationPlugin';
import { codeBlockNavigationPlugin } from './plugins/codeBlockNavigation';
import { displayMathInputPlugin } from './plugins/displayMathInput';
import { mathInlineInputPlugin } from './plugins/mathInlineInput';
import { inlineMarkdownMarkInputPlugin } from './plugins/inlineMarkdownMarkInput';
import { linkInteractionPlugin } from './plugins/linkInteraction';
import {
  pendingInlineMarkPlugin,
  toggleMarkPending,
  isPendingMarkActive,
} from './plugins/pendingInlineMark';
import { tableControlsPlugin } from './plugins/tableControls';
import { tableHtmlBlockPlugin } from './plugins/tableHtml';
import { taskListPlugin } from './plugins/taskList';
import { createCalloutPlugin } from './callout/calloutPlugin';
import { removeEmptyCalloutOnBackspace } from './callout/calloutCommands';
import { deleteCodeBlockBeforeCursor } from './codeBlockCommands';
import { trailingParagraphPlugin } from './plugins/trailingParagraph';
import { contextMenuPlugin } from './plugins/contextMenu';
import {
  createMarkdownInputRules,
  parseMarkdown,
  serializeMarkdown,
  splitFrontMatter,
} from './markdown';
import { schema } from './schema';
import { addTableRowAfter, addTableRowBefore, findTableContext } from './tableCommands';
import { updateTocBlocks } from '../toc/tocService';
import type {
  EditorAnchorRect,
  EditorChangeEvent,
  EditorCommand,
  EditorCore,
  EditorCoreOptions,
  EditorLinkSnapshot,
  EditorListener,
  EditorSearchMatch,
  EditorSearchOptions,
  InlinePendingMarkName,
  InlinePendingMarks,
  EditorRuntimeOptions,
  EditorImageDeletionEvent,
  EditorSnapshot,
  EditorThemeOptions,
  SetMarkdownOptions,
} from './types';

const LARGE_DOCUMENT_SEMANTIC_LIMIT = 300_000;

export class ProseMirrorEditorCore implements EditorCore {
  private target: HTMLElement | null;
  private view: EditorView | null = null;
  private markdown: string;
  private semanticViewDirty = false;
  private frontMatter = '';
  private version = 0;
  private dirty = false;
  private destroyed = false;
  private runtime: EditorRuntimeOptions;
  private listeners = new Set<EditorListener>();

  constructor(private readonly options: EditorCoreOptions) {
    this.target = options.target ?? null;
    this.markdown = updateTocBlocks(options.markdown);
    this.frontMatter = splitFrontMatter(this.markdown).frontMatter;
    this.runtime = {
      readonly: options.readonly ?? false,
      mode: options.mode ?? 'semantic',
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
        code_block: (node, view, getPos) =>
          new CodeBlockNodeView(node, view, getPos as () => number),
        image: (node, view) =>
          new ImageNodeView(node, view, () => this.options.getImageContext?.() ?? {}),
        html_block: (node, view, getPos) =>
          new HtmlBlockNodeView(node, view, getPos as () => number),
        comment_block: (node, view, getPos) =>
          new CommentBlockNodeView(node, view, getPos as () => number),
        comment_inline: (node, view, getPos) =>
          new CommentInlineNodeView(node, view, getPos as () => number),
        footnote_ref: (node, view) => new FootnoteRefNodeView(node, view),
        footnote_def: (node, view) => new FootnoteDefNodeView(node, view),
        math_inline: (node, view, getPos) =>
          new MathInlineNodeView(node, view, getPos as () => number),
        math_block: (node, view, getPos) =>
          new MathBlockNodeView(node, view, getPos as () => number),
        mermaid_block: (node, view, getPos) =>
          new MermaidBlockNodeView(node, view, getPos as () => number),
        callout: (node, view, getPos) => new CalloutNodeView(node, view, getPos as () => number),
        horizontal_rule: (node, view, getPos) =>
          new HorizontalRuleNodeView(node, view, getPos as () => number),
        toc_block: (node, view, getPos) => new TocBlockNodeView(node, view, getPos as () => number),
      },
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
    const previousMarkdown = this.markdown;
    const delaySemanticSync = options?.sourceInput === true && this.runtime.mode === 'source';
    const previousDoc = delaySemanticSync
      ? null
      : (this.view?.state.doc ?? parseMarkdown(this.markdown));
    this.markdown = updateTocBlocks(markdown);
    this.frontMatter = splitFrontMatter(this.markdown).frontMatter;
    this.version += 1;
    this.dirty =
      options?.dirty ??
      (options?.reason !== 'open-file' &&
        options?.reason !== 'save-file' &&
        options?.reason !== 'switch-tab');
    if (delaySemanticSync) {
      this.semanticViewDirty = true;
      if (shouldReportImageDeletion(options)) {
        this.notifyDeletedImageSrcs(
          findFullyRemovedMarkdownImageSrcs(previousMarkdown, this.markdown),
        );
      }
      this.emit(options?.reason ?? 'programmatic-update');
      return;
    }

    this.replaceViewState(this.markdown);
    if (previousDoc && shouldReportImageDeletion(options)) {
      const nextDoc = this.view?.state.doc ?? parseMarkdown(this.markdown);
      this.notifyDeletedImages(previousDoc, nextDoc);
    }
    this.emit(options?.reason ?? 'programmatic-update');
  }

  getSnapshot(): EditorSnapshot {
    this.assertActive();
    return {
      markdown: this.markdown,
      version: this.version,
      meta: {
        mode: this.runtime.mode,
      },
    };
  }

  restoreSnapshot(snapshot: EditorSnapshot): void {
    this.assertActive();
    this.markdown = updateTocBlocks(snapshot.markdown);
    this.version = snapshot.version;
    this.dirty = true;
    this.replaceViewState(this.markdown);
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

  getActiveLink(): EditorLinkSnapshot | null {
    this.assertActive();
    if (!this.view) return null;
    return findActiveLinkRange(this.view.state);
  }

  getSelectionAnchorRect(): EditorAnchorRect | null {
    this.assertActive();
    if (!this.view) return null;

    const { selection } = this.view.state;
    const from = selection.from;
    const to = selection.empty ? selection.from : selection.to;

    try {
      const fromRect = this.view.coordsAtPos(from);
      const toRect = this.view.coordsAtPos(to);
      const left = Math.min(fromRect.left, toRect.left);
      const top = Math.min(fromRect.top, toRect.top);
      const right = Math.max(fromRect.right, toRect.right);
      const bottom = Math.max(fromRect.bottom, toRect.bottom);

      return {
        x: left,
        y: top,
        left,
        top,
        right,
        bottom,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
        toJSON: () => ({ x: left, y: top, left, top, right, bottom }),
      };
    } catch {
      const rect = this.view.dom.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        toJSON: () => rect.toJSON(),
      };
    }
  }

  findSearchMatches(query: string, options: EditorSearchOptions): EditorSearchMatch[] {
    this.assertActive();
    if (!this.view || !query) {
      return [];
    }

    return findEditorTextMatches(this.view.state.doc, query, options);
  }

  selectSearchMatch(match: EditorSearchMatch): boolean {
    this.assertActive();
    if (!this.view) {
      return false;
    }

    return selectEditorTextRange(this.view, match.from, match.to);
  }

  replaceSearchMatch(match: EditorSearchMatch, replacement: string): boolean {
    this.assertActive();
    if (!this.view || this.runtime.readonly) {
      return false;
    }

    const selected = selectEditorTextRange(this.view, match.from, match.to);
    if (!selected) {
      return false;
    }

    const tr = this.view.state.tr.insertText(replacement, match.from, match.to).scrollIntoView();
    this.view.dispatch(tr);
    return true;
  }

  replaceAllSearchMatches(
    query: string,
    replacement: string,
    options: EditorSearchOptions,
  ): number {
    this.assertActive();
    if (!this.view || this.runtime.readonly || !query) {
      return 0;
    }

    const matches = findEditorTextMatches(this.view.state.doc, query, options);
    if (matches.length === 0) {
      return 0;
    }

    let tr = this.view.state.tr;
    for (const match of [...matches].reverse()) {
      tr = tr.insertText(replacement, match.from, match.to);
    }
    this.view.dispatch(tr.scrollIntoView());
    return matches.length;
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

    if (this.runtime.mode !== 'semantic' && isPendingInlineMarkCommand(command)) {
      return false;
    }

    return true;
  }

  /** 判断指定行内格式是否处于 pending 状态（collapsed selection 下的待定标记） */
  isPendingMarkActive(markName: InlinePendingMarkName): boolean {
    if (!this.view) return false;
    const markType = this.view.state.schema.marks[markName];
    if (!markType) return false;
    return isPendingMarkActive(this.view.state, markType);
  }

  updateTheme(theme: EditorThemeOptions): void {
    this.assertActive();
    this.options.theme = theme;
    CodeBlockNodeView.updateTheme();
    MermaidBlockNodeView.updateTheme();
    this.emit(`theme:${theme.name}`);
  }

  updateOptions(options: Partial<EditorRuntimeOptions>): void {
    this.assertActive();
    this.runtime = {
      ...this.runtime,
      ...options,
    };
    if (this.semanticViewDirty && this.runtime.mode === 'semantic' && options.mode === 'semantic') {
      this.replaceViewState(this.markdown);
    }
    this.view?.setProps({
      editable: () => this.isEditable(),
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
      reason,
      pendingInlineMarks: this.createPendingInlineMarks(),
    };
  }

  private createPendingInlineMarks(): InlinePendingMarks {
    return {
      strong: this.isPendingMarkActive('strong'),
      em: this.isPendingMarkActive('em'),
      code: this.isPendingMarkActive('code'),
      strikethrough: this.isPendingMarkActive('strikethrough'),
      underline: this.isPendingMarkActive('underline'),
      highlight: this.isPendingMarkActive('highlight'),
    };
  }

  private createState(markdown: string): EditorState {
    return EditorState.create({
      doc: parseMarkdown(markdown),
      plugins: [
        inputRules({
          rules: createMarkdownInputRules(),
        }),
        history(),
        taskListPlugin(),
        mathInlineInputPlugin(),
        inlineMarkdownMarkInputPlugin(),
        linkInteractionPlugin({ openLink: this.options.onOpenLink }),
        codeHighlightPlugin(),
        codeHighlightDecorationPlugin(),
        // mathBlockPlugin(),  // 已被 math_block 语义节点 + displayMathInputPlugin 取代
        displayMathInputPlugin(),
        trailingParagraphPlugin(),
        pendingInlineMarkPlugin(),
        tableHtmlBlockPlugin(),
        tableControlsPlugin(),
        tableEditing({ allowTableNodeSelection: true }),
        createCalloutPlugin(),
        keymap({
          'Mod-z': undo,
          'Mod-y': redo,
          'Shift-Mod-z': redo,
          'Mod-b': toggleMarkPending(schema.marks.strong),
          'Mod-i': toggleMarkPending(schema.marks.em),
          'Ctrl-`': toggleMarkPending(schema.marks.code),
          'Mod-k': (_state, _dispatch, _view) => {
            this.options.onLinkShortcut?.();
            return Boolean(this.options.onLinkShortcut);
          },
          'Alt-Shift-5': toggleMarkPending(schema.marks.strikethrough),
          'Mod-u': toggleMarkPending(schema.marks.underline),
          'Mod-\\': (_state, _dispatch, _view) =>
            this.runProseMirrorCommand({ type: 'clearInlineStyles' }),
          'Ctrl-\\': (_state, _dispatch, _view) =>
            this.runProseMirrorCommand({ type: 'clearInlineStyles' }),
          'Ctrl-Enter': (state, dispatch) => {
            // 在表格内：下方插入新行
            const context = findTableContext(state);
            if (context) return addTableRowAfter()(state, dispatch);
            // 在 callout 内：跳出 callout，在下方插入段落
            const { $from: $fromCtrl } = state.selection;
            for (let d = $fromCtrl.depth; d >= 0; d--) {
              if ($fromCtrl.node(d).type.name === 'callout') {
                const calloutEnd = $fromCtrl.after(d + 1);
                const emptyParagraph = schema.nodes.paragraph.create();
                const tr = state.tr.insert(calloutEnd, emptyParagraph);
                if (dispatch) {
                  dispatch(
                    tr.setSelection(TextSelection.create(tr.doc, calloutEnd + 1)).scrollIntoView(),
                  );
                }
                return true;
              }
            }
            // 其他块：在下方插入新段落
            const { $from } = state.selection;
            const afterPos = $from.after(1);
            const emptyParagraph = schema.nodes.paragraph.create();
            const tr = state.tr.insert(afterPos, emptyParagraph);
            const newPos = afterPos + 1;
            if (dispatch) {
              dispatch(tr.setSelection(TextSelection.create(tr.doc, newPos)).scrollIntoView());
            }
            return true;
          },
          'Shift-Ctrl-Enter': (state, dispatch) => {
            // 在表格内：上方插入新行
            const context = findTableContext(state);
            if (context) return addTableRowBefore()(state, dispatch);
            // 其他块：在上方插入新段落
            const { $from } = state.selection;
            const beforePos = $from.before(1);
            const emptyParagraph = schema.nodes.paragraph.create();
            const tr = state.tr.insert(beforePos, emptyParagraph);
            if (dispatch) {
              dispatch(
                tr.setSelection(TextSelection.create(tr.doc, beforePos + 1)).scrollIntoView(),
              );
            }
            return true;
          },
          Enter: chainCommands(
            // $$ 回车自动补全：段落内只有 $$ 时按回车，生成空 math_block 并自动进入编辑态
            (state, dispatch) => {
              const { $from, empty } = state.selection;
              if (!empty || $from.parent.type.name !== 'paragraph') return false;
              if ($from.parent.textContent !== '$$') return false;
              if (dispatch) {
                const blockStart = $from.before(1);
                const blockEnd = $from.after(1);
                const node = schema.nodes.math_block.create({ tex: '' });
                const tr = state.tr.replaceWith(blockStart, blockEnd, node);
                // 选中新创建的 math_block，触发 NodeView.selectNode → 自动进入编辑态
                tr.setSelection(NodeSelection.create(tr.doc, blockStart));
                dispatch(tr);
              }
              return true;
            },
            newlineInCode,
            splitListItem(schema.nodes.list_item),
            createParagraphNear,
            liftEmptyBlock,
            splitBlock,
          ),
          Backspace: chainCommands(
            deleteSelection,
            removeEmptyCalloutOnBackspace,
            deleteCodeBlockBeforeCursor,
            joinBackward,
            selectNodeBackward,
          ),
          Tab: chainCommands(
            goToNextCell(1),
            sinkListItem(schema.nodes.list_item),
            insertTabInTextblock,
          ),
          'Shift-Tab': chainCommands(
            goToNextCell(-1),
            liftListItem(schema.nodes.list_item),
            removeTabBeforeCursorInTextblock,
          ),
          'Shift-Ctrl-[': (state, dispatch) =>
            toggleList(state, dispatch, schema.nodes.ordered_list),
          'Shift-Ctrl-]': (state, dispatch) =>
            toggleList(state, dispatch, schema.nodes.bullet_list),
          'Shift-Ctrl-x': (state, dispatch) => toggleTaskListAtCursor(state, dispatch),
          'Shift-Ctrl-q': (_state, _dispatch, view) =>
            this.runProseMirrorCommand({ type: 'toggleBlockquote' }),
          'Shift-Ctrl-a': (_state, _dispatch, view) =>
            this.runProseMirrorCommand({ type: 'insertCallout' }),
          'Shift-Ctrl-m': (_state, _dispatch, view) =>
            this.runProseMirrorCommand({ type: 'insertMathBlock', tex: '' }),
          'Shift-Ctrl-k': (_state, _dispatch, view) =>
            this.runProseMirrorCommand({ type: 'insertCodeBlock' }),
          ArrowRight: (state, dispatch) => {
            const { $from, empty } = state.selection;
            if (!empty) return false;
            const nodeAfter = $from.nodeAfter;
            if (nodeAfter?.type.name === 'math_inline') {
              if (dispatch) {
                MathInlineNodeView.requestKeyboardEntry('start');
                dispatch(state.tr.setSelection(NodeSelection.create(state.doc, $from.pos)));
              }
              return true;
            }
            if (nodeAfter?.type.name === 'comment_inline') {
              if (dispatch) {
                CommentInlineNodeView.requestKeyboardEntry('start');
                dispatch(state.tr.setSelection(NodeSelection.create(state.doc, $from.pos)));
              }
              return true;
            }
            return false;
          },
          ArrowLeft: (state, dispatch) => {
            const { $from, empty } = state.selection;
            if (!empty) return false;
            const nodeBefore = $from.nodeBefore;
            if (nodeBefore?.type.name === 'math_inline') {
              if (dispatch) {
                MathInlineNodeView.requestKeyboardEntry('end');
                dispatch(
                  state.tr.setSelection(
                    NodeSelection.create(state.doc, $from.pos - nodeBefore.nodeSize),
                  ),
                );
              }
              return true;
            }
            if (nodeBefore?.type.name === 'comment_inline') {
              if (dispatch) {
                CommentInlineNodeView.requestKeyboardEntry('end');
                dispatch(
                  state.tr.setSelection(
                    NodeSelection.create(state.doc, $from.pos - nodeBefore.nodeSize),
                  ),
                );
              }
              return true;
            }
            return false;
          },
        }),
        // 必须在 keymap 之后注册：ProseMirror 的 someProp 取最后一个结果，
        // 若在 keymap 之前，keymap 返回 false 会覆盖本插件的 true。
        codeBlockNavigationPlugin({
          enterEditAt: (view, pos, clickLine, caret) =>
            CodeBlockNodeView.enterEditAt(view, pos, clickLine, caret),
          enterMathEditAt: (view, pos, caret) => MathBlockNodeView.enterEditAt(view, pos, caret),
          enterMermaidEditAt: (view, pos, caret) =>
            MermaidBlockNodeView.enterEditAt(view, pos, caret),
          prepareMathKeyboardEntry: (caret) => MathBlockNodeView.prepareKeyboardEntry(caret),
        }),
        contextMenuPlugin({
          onOpen: (event) => this.options.onContextMenuOpen?.(event),
        }),
      ],
    });
  }

  private dispatchTransaction(transaction: Transaction): void {
    if (!this.view) {
      return;
    }

    const previousDoc = this.view.state.doc;
    const nextState = this.view.state.apply(transaction);
    this.view.updateState(nextState);

    if (transaction.docChanged) {
      const serializedMarkdown = `${this.frontMatter}${serializeMarkdown(nextState.doc)}`;
      this.markdown = updateTocBlocks(serializedMarkdown);
      this.dirty = true;
      if (this.markdown !== serializedMarkdown) {
        this.replaceViewState(this.markdown, {
          anchor: nextState.selection.anchor,
          head: nextState.selection.head,
        });
      } else {
        this.semanticViewDirty = false;
      }
      this.notifyDeletedImages(previousDoc, nextState.doc);
    }

    // 每次事务都递增版本并通知（pending mark 状态切换、选区变化等需要及时反映到 UI）
    this.version += 1;
    this.emit('transaction');
  }

  private replaceViewState(markdown: string, selection?: { anchor: number; head: number }): void {
    if (!this.view) {
      return;
    }
    if (this.runtime.mode === 'source' && markdown.length > LARGE_DOCUMENT_SEMANTIC_LIMIT) {
      return;
    }

    const nextState = this.createState(markdown);
    this.view.updateState(selection ? this.restoreSelection(nextState, selection) : nextState);
    this.semanticViewDirty = false;
  }

  private restoreSelection(
    state: EditorState,
    selection: { anchor: number; head: number },
  ): EditorState {
    const anchor = clampDocPosition(state.doc, selection.anchor);
    const head = clampDocPosition(state.doc, selection.head);

    try {
      return state.apply(state.tr.setSelection(TextSelection.create(state.doc, anchor, head)));
    } catch {
      const fallback = TextSelection.near(state.doc.resolve(head));
      return state.apply(state.tr.setSelection(fallback));
    }
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
    return executeEditorCommand(command, this.view, this.markdown, (markdown, options) =>
      this.setMarkdown(markdown, options),
    );
  }

  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('EditorCore has been destroyed.');
    }
  }

  private notifyDeletedImages(previousDoc: ProseMirrorNode, nextDoc: ProseMirrorNode): void {
    if (!this.options.onImagesDeleted) {
      return;
    }

    const deletedSrcs = findFullyRemovedImageSrcs(previousDoc, nextDoc);
    this.notifyDeletedImageSrcs(deletedSrcs);
  }

  private notifyDeletedImageSrcs(deletedSrcs: string[]): void {
    if (!this.options.onImagesDeleted) {
      return;
    }

    if (deletedSrcs.length === 0) {
      return;
    }

    const event: EditorImageDeletionEvent = { srcs: deletedSrcs };
    this.options.onImagesDeleted(event);
  }
}

function isPendingInlineMarkCommand(command: EditorCommand): boolean {
  return (
    command.type === 'toggleBold' ||
    command.type === 'toggleItalic' ||
    command.type === 'toggleCode' ||
    command.type === 'toggleStrikethrough' ||
    command.type === 'toggleUnderline' ||
    command.type === 'toggleHighlight'
  );
}

function insertTabInTextblock(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const { $from } = state.selection;
  if (!$from.parent.isTextblock) {
    return false;
  }
  if (dispatch) {
    dispatch(state.tr.insertText('\t').scrollIntoView());
  }
  return true;
}

function removeTabBeforeCursorInTextblock(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const { selection } = state;
  if (!selection.empty || !selection.$from.parent.isTextblock) {
    return false;
  }

  const cursor = selection.from;
  if (cursor <= selection.$from.start() || state.doc.textBetween(cursor - 1, cursor) !== '\t') {
    return false;
  }

  if (dispatch) {
    dispatch(state.tr.delete(cursor - 1, cursor).scrollIntoView());
  }
  return true;
}

function clampDocPosition(doc: ProseMirrorNode, position: number): number {
  return Math.max(0, Math.min(position, doc.content.size));
}

function findEditorTextMatches(
  doc: ProseMirrorNode,
  query: string,
  options: EditorSearchOptions,
): EditorSearchMatch[] {
  const needle = options.caseSensitive ? query : query.toLocaleLowerCase();
  const matches: EditorSearchMatch[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return true;
    }

    const source = options.caseSensitive ? node.text : node.text.toLocaleLowerCase();
    let offset = 0;
    while (offset <= source.length) {
      const found = source.indexOf(needle, offset);
      if (found < 0) {
        break;
      }

      const from = pos + found;
      const to = from + query.length;
      matches.push({
        id: `${from}:${to}:${matches.length}`,
        index: matches.length,
        from,
        to,
        text: node.text.slice(found, found + query.length),
      });
      offset = found + Math.max(needle.length, 1);
    }

    return true;
  });

  return matches;
}

function selectEditorTextRange(view: EditorView, from: number, to: number): boolean {
  const safeFrom = clampDocPosition(view.state.doc, from);
  const safeTo = clampDocPosition(view.state.doc, to);

  try {
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, safeFrom, safeTo)).scrollIntoView(),
    );
    view.focus();
    return true;
  } catch {
    return false;
  }
}

function shouldReportImageDeletion(options: SetMarkdownOptions | undefined): boolean {
  return (
    options?.reason !== 'open-file' &&
    options?.reason !== 'save-file' &&
    options?.reason !== 'switch-tab' &&
    options?.reason !== 'restore-snapshot'
  );
}

function findFullyRemovedImageSrcs(
  previousDoc: ProseMirrorNode,
  nextDoc: ProseMirrorNode,
): string[] {
  const previous = countImageSrcs(previousDoc);
  const next = countImageSrcs(nextDoc);
  const deleted: string[] = [];

  for (const [src, previousCount] of previous) {
    if (previousCount > 0 && !next.has(src)) {
      deleted.push(src);
    }
  }

  return deleted;
}

function findFullyRemovedMarkdownImageSrcs(
  previousMarkdown: string,
  nextMarkdown: string,
): string[] {
  const previous = countMarkdownImageSrcs(previousMarkdown);
  const next = countMarkdownImageSrcs(nextMarkdown);
  const deleted: string[] = [];

  for (const [src, previousCount] of previous) {
    if (previousCount > 0 && !next.has(src)) {
      deleted.push(src);
    }
  }

  return deleted;
}

function countImageSrcs(doc: ProseMirrorNode): Map<string, number> {
  const counts = new Map<string, number>();
  doc.descendants((node) => {
    if (node.type.name !== 'image') {
      return true;
    }

    const src = String(node.attrs.src ?? '').trim();
    if (src) {
      counts.set(src, (counts.get(src) ?? 0) + 1);
    }
    return false;
  });
  return counts;
}

function countMarkdownImageSrcs(markdown: string): Map<string, number> {
  const counts = new Map<string, number>();
  const imagePattern = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(markdown)) !== null) {
    const src = match[1].trim();
    if (src) {
      counts.set(src, (counts.get(src) ?? 0) + 1);
    }
  }

  return counts;
}
