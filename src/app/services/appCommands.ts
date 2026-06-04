import type { EditorCommand, EditorMode } from '../../lib/editor-core';

export interface AppCommandHandlers {
  createNewFile: () => void;
  createNewWindow: () => void;
  openFileDialog: () => void;
  openFolderDialog: () => void;
  openRecentFile: (path: string) => void;
  saveMarkdownFile: (saveAs?: boolean) => void;
  runCommand: (command: EditorCommand) => void;
  openTablePicker: () => void;
  showUnavailableFeature: (featureName: string) => void;
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
  } else if (command === 'toggle-blockquote') {
    handlers.runCommand({ type: 'toggleBlockquote' });
  } else if (command === 'insert-table') {
    handlers.openTablePicker();
  } else if (command === 'insert-math-block') {
    handlers.runCommand({ type: 'insertMathBlock', tex: '' });
  } else if (command === 'insert-code-block') {
    handlers.runCommand({ type: 'insertCodeBlock', language: 'ts' });
  } else if (command === 'set-heading-1') {
    handlers.runCommand({ type: 'setHeading', level: 1 });
  } else if (command === 'set-heading-2') {
    handlers.runCommand({ type: 'setHeading', level: 2 });
  } else if (command === 'set-heading-3') {
    handlers.runCommand({ type: 'setHeading', level: 3 });
  } else if (command === 'set-heading-4') {
    handlers.runCommand({ type: 'setHeading', level: 4 });
  } else if (command === 'set-heading-5') {
    handlers.runCommand({ type: 'setHeading', level: 5 });
  } else if (command === 'set-heading-6') {
    handlers.runCommand({ type: 'setHeading', level: 6 });
  } else if (command === 'set-paragraph') {
    handlers.runCommand({ type: 'setParagraph' });
  } else if (command === 'toggle-bold') {
    handlers.runCommand({ type: 'toggleBold' });
  } else if (command === 'toggle-italic') {
    handlers.runCommand({ type: 'toggleItalic' });
  } else if (command === 'toggle-inline-code') {
    handlers.runCommand({ type: 'toggleCode' });
  } else if (command === 'menu-heading-up') {
    handlers.showUnavailableFeature('提升标题级别');
  } else if (command === 'menu-heading-down') {
    handlers.showUnavailableFeature('降低标题级别');
  } else if (command === 'menu-insert-paragraph-before') {
    handlers.showUnavailableFeature('在上方插入段落');
  } else if (command === 'menu-insert-paragraph-after') {
    handlers.runCommand({ type: 'insertParagraphAfter' });
  } else if (command === 'menu-chart') {
    handlers.showUnavailableFeature('图表');
  } else if (command === 'menu-footnote') {
    handlers.showUnavailableFeature('脚注');
  } else if (command === 'menu-horizontal-rule') {
    handlers.showUnavailableFeature('水平分割线');
  } else if (command === 'menu-content-directory') {
    handlers.showUnavailableFeature('内容目录');
  } else if (command === 'menu-yaml-front-matter') {
    handlers.showUnavailableFeature('YAML Front Matter');
  } else if (command === 'menu-underline') {
    handlers.showUnavailableFeature('下划线');
  } else if (command === 'menu-inline-math') {
    handlers.showUnavailableFeature('行公式');
  } else if (command === 'menu-strikethrough') {
    handlers.showUnavailableFeature('删除线');
  } else if (command === 'menu-highlight') {
    handlers.showUnavailableFeature('高亮');
  } else if (command === 'menu-comment') {
    handlers.showUnavailableFeature('注释');
  } else if (command === 'menu-link') {
    handlers.showUnavailableFeature('超链接');
  } else if (command === 'menu-image') {
    handlers.showUnavailableFeature('图像');
  } else if (command === 'menu-clear-format') {
    handlers.showUnavailableFeature('清除样式');
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
  } else if (key === 'q') {
    // Ctrl+Shift+Q → 引用块
    event.preventDefault();
    handlers.runCommand({ type: 'toggleBlockquote' });
  } else if (key === 't') {
    // Ctrl+Shift+T → 表格尺寸选择
    event.preventDefault();
    handlers.openTablePicker();
  } else if (key === 'm') {
    // Ctrl+Shift+M → 公式块
    event.preventDefault();
    handlers.runCommand({ type: 'insertMathBlock', tex: '' });
  } else if (key === 'k') {
    // Ctrl+Shift+K → 代码块
    event.preventDefault();
    handlers.runCommand({ type: 'insertCodeBlock', language: 'ts' });
  }
}
