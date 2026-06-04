export type EditorMode = 'semantic' | 'source';

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
  | { type: 'setHeading'; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'setParagraph' }
  | { type: 'toggleBlockquote' }
  | { type: 'toggleBulletList' }
  | { type: 'toggleOrderedList' }
  | { type: 'toggleTaskList' }
  | { type: 'insertLink'; href: string; title?: string; text?: string }
  | { type: 'insertImage'; src: string; alt?: string; title?: string }
  | { type: 'insertCodeBlock'; language?: string; code?: string }
  | { type: 'insertMathBlock'; tex?: string }
  | { type: 'insertMermaidBlock'; code?: string }
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
  execute(command: EditorCommand): boolean;
  canExecute(command: EditorCommand): boolean;
  updateTheme(theme: EditorThemeOptions): void;
  updateOptions(options: Partial<EditorRuntimeOptions>): void;
  subscribe(listener: EditorListener): () => void;
}
