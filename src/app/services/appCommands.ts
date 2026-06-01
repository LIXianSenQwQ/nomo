import type { EditorCommand, EditorMode } from '../../lib/editor-core';

export interface AppCommandHandlers {
  createNewFile: () => void;
  createNewWindow: () => void;
  openFileDialog: () => void;
  openFolderDialog: () => void;
  openRecentFile: (path: string) => void;
  saveMarkdownFile: (saveAs?: boolean) => void;
  runCommand: (command: EditorCommand) => void;
  setMode: (mode: EditorMode) => void;
  getMode: () => EditorMode;
  toggleTheme: () => void;
  toggleFocusMode: () => void;
}

export function executeDesktopCommand(command: string, handlers: AppCommandHandlers) {
  if (command === 'new-file') {
    handlers.createNewFile();
  } else if (command === 'open-file') {
    handlers.openFileDialog();
  } else if (command === 'open-directory') {
    handlers.openFolderDialog();
  } else if (command.startsWith('open-recent:')) {
    handlers.openRecentFile(command.slice('open-recent:'.length));
  } else if (command === 'save-file') {
    handlers.saveMarkdownFile();
  } else if (command === 'save-file-as') {
    handlers.saveMarkdownFile(true);
  } else if (command === 'undo') {
    handlers.runCommand({ type: 'undo' });
  } else if (command === 'redo') {
    handlers.runCommand({ type: 'redo' });
  } else if (command === 'toggle-source') {
    handlers.setMode(handlers.getMode() === 'source' ? 'semantic' : 'source');
  } else if (command === 'toggle-theme') {
    handlers.toggleTheme();
  } else if (command === 'toggle-focus') {
    handlers.toggleFocusMode();
  }
}

export function handleGlobalShortcut(event: KeyboardEvent, handlers: AppCommandHandlers) {
  if (event.defaultPrevented) {
    return;
  }

  if (!event.ctrlKey || event.altKey) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === 'n' && !event.shiftKey) {
    event.preventDefault();
    handlers.createNewFile();
  } else if (key === 'n' && event.shiftKey) {
    event.preventDefault();
    handlers.createNewWindow();
  } else if (key === 'o' && !event.shiftKey) {
    event.preventDefault();
    handlers.openFileDialog();
  } else if (key === 'o' && event.shiftKey) {
    event.preventDefault();
    handlers.openFolderDialog();
  } else if (key === 's') {
    event.preventDefault();
    handlers.saveMarkdownFile(event.shiftKey);
  } else if (key === 'e') {
    event.preventDefault();
    handlers.setMode(handlers.getMode() === 'source' ? 'semantic' : 'source');
  } else if (key === 'l' && event.shiftKey) {
    event.preventDefault();
    handlers.toggleTheme();
  } else if (key === 'f' && event.shiftKey) {
    event.preventDefault();
    handlers.toggleFocusMode();
  } else if (['1', '2', '3', '4', '5', '6'].includes(key)) {
    event.preventDefault();
    handlers.runCommand({ type: 'setHeading', level: Number(key) as 1 | 2 | 3 | 4 | 5 | 6 });
  } else if (key === '0') {
    event.preventDefault();
    handlers.runCommand({ type: 'setParagraph' });
  }
  // Ctrl+Shift 快捷键：用 event.code 按物理按键匹配，避免 Shift 影响 event.key
  if (!event.shiftKey) return;

  const code = event.code;
  if (code === 'BracketLeft') {
    // Ctrl+Shift+[ → 有序列表
    event.preventDefault();
    handlers.runCommand({ type: 'toggleOrderedList' });
  } else if (code === 'BracketRight') {
    // Ctrl+Shift+] → 无序列表
    event.preventDefault();
    handlers.runCommand({ type: 'toggleBulletList' });
  } else if (key === 'x') {
    // Ctrl+Shift+X → 任务列表
    event.preventDefault();
    handlers.runCommand({ type: 'toggleTaskList' });
  }
}
