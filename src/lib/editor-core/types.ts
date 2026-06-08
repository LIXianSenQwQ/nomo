import type { DiagramType } from './diagramTemplates';
import type { ImageContext } from '../services/render';
import type { ContextMenuOpenEvent } from './plugins/contextMenu';

export type EditorMode = 'semantic' | 'source';
export type InlinePendingMarkName = 'strong' | 'em' | 'strikethrough' | 'underline' | 'highlight';
export type InlinePendingMarks = Record<InlinePendingMarkName, boolean>;

export interface EditorThemeOptions {
  name: 'light' | 'dark';
}

export interface EditorRuntimeOptions {
  readonly: boolean;
  mode: EditorMode;
}

export interface SetMarkdownOptions {
  preserveHistory?: boolean;
  reason?: 'open-file' | 'save-file' | 'switch-tab' | 'restore-snapshot' | 'programmatic-update';
  dirty?: boolean;
}

export interface EditorSelectionSnapshot {
  anchor: number;
  head: number;
}

export interface EditorLinkSnapshot {
  href: string;
  title: string | null;
  text: string;
  from: number;
  to: number;
  active: boolean;
}

export interface EditorAnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface EditorSnapshot {
  markdown: string;
  version: number;
  selection?: EditorSelectionSnapshot;
  meta?: Record<string, unknown>;
}

export interface EditorChangeEvent {
  markdown: string;
  version: number;
  dirty: boolean;
  mode: EditorMode;
  readonly: boolean;
  reason: string;
  pendingInlineMarks: InlinePendingMarks;
}

export interface EditorImageDeletionEvent {
  srcs: string[];
}

export interface EditorSelectionEvent {
  selection: EditorSelectionSnapshot | null;
}

export interface EditorError {
  code: string;
  message: string;
  cause?: unknown;
}

export type EditorCommand =
  | { type: 'toggleBold' }
  | { type: 'toggleItalic' }
  | { type: 'toggleCode' }
  | { type: 'toggleStrikethrough' }
  | { type: 'toggleUnderline' }
  | { type: 'toggleHighlight' }
  | { type: 'clearInlineStyles' }
  | { type: 'setHeading'; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'setParagraph' }
  | { type: 'toggleBlockquote' }
  | { type: 'insertCallout'; calloutType?: 'note' | 'tip' | 'important' | 'warning' | 'caution' }
  | {
      type: 'toggleCalloutType';
      calloutType?: 'note' | 'tip' | 'important' | 'warning' | 'caution';
    }
  | { type: 'unwrapCallout' }
  | { type: 'toggleBulletList' }
  | { type: 'toggleOrderedList' }
  | { type: 'toggleTaskList' }
  | { type: 'insertLink'; href: string; title?: string; text?: string }
  | { type: 'removeLink' }
  | {
      type: 'insertImage';
      src: string;
      alt?: string;
      title?: string;
      width?: string | null;
      align?: 'left' | 'center' | 'right' | null;
    }
  | { type: 'insertFootnote' }
  | { type: 'insertCommentInline'; content?: string }
  | { type: 'insertCommentBlock'; content?: string }
  | { type: 'insertCodeBlock'; language?: string; code?: string }
  | { type: 'insertMathBlock'; tex?: string }
  | { type: 'insertMermaidBlock'; code?: string }
  | { type: 'insertDiagramBlock'; diagramType: DiagramType }
  | { type: 'insertToc' }
  | { type: 'insertFrontMatter' }
  | { type: 'insertTable'; rows?: number; columns?: number }
  | { type: 'addTableRowBefore' }
  | { type: 'addTableRowAfter' }
  | { type: 'addTableColumnBefore' }
  | { type: 'addTableColumnAfter' }
  | { type: 'deleteTableRow' }
  | { type: 'deleteTableColumn' }
  | { type: 'deleteTable' }
  | { type: 'toggleTableHeader' }
  | { type: 'setTableColumnAlignment'; align: 'left' | 'center' | 'right' }
  | { type: 'insertParagraphAfter' }
  | { type: 'insertParagraphBefore' }
  | { type: 'increaseHeadingLevel' }
  | { type: 'decreaseHeadingLevel' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'formatDocument' }
  | { type: 'insertHorizontalRule' }
  | { type: 'scrollToHeading'; headingIndex: number; text: string; level: number };

export type EditorListener = (event: EditorChangeEvent) => void;

export interface EditorCoreOptions {
  target?: HTMLElement;
  markdown: string;
  readonly?: boolean;
  mode?: EditorMode;
  theme?: EditorThemeOptions;
  onChange?: (event: EditorChangeEvent) => void;
  onSelectionChange?: (event: EditorSelectionEvent) => void;
  onError?: (error: EditorError) => void;
  onLinkShortcut?: () => void;
  onOpenLink?: (href: string) => void;
  getImageContext?: () => ImageContext;
  onImagesDeleted?: (event: EditorImageDeletionEvent) => void;
  /** 上下文菜单打开回调（NodeView 右键） */
  onContextMenuOpen?: (event: ContextMenuOpenEvent) => void;
}

export interface EditorCore {
  mount(target: HTMLElement): void;
  destroy(): void;
  getMarkdown(): string;
  setMarkdown(markdown: string, options?: SetMarkdownOptions): void;
  getSnapshot(): EditorSnapshot;
  restoreSnapshot(snapshot: EditorSnapshot): void;
  focus(): void;
  blur(): void;
  getActiveLink(): EditorLinkSnapshot | null;
  getSelectionAnchorRect(): EditorAnchorRect | null;
  execute(command: EditorCommand): boolean;
  canExecute(command: EditorCommand): boolean;
  updateTheme(theme: EditorThemeOptions): void;
  updateOptions(options: Partial<EditorRuntimeOptions>): void;
  subscribe(listener: EditorListener): () => void;
  /** 判断指定行内格式是否处于 pending 状态 */
  isPendingMarkActive?(markName: InlinePendingMarkName): boolean;
}
