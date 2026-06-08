import { describe, expect, it, vi } from 'vitest';
import type { EditorCommand, EditorMode } from '../../lib/editor-core';
import {
  executeDesktopCommand,
  handleGlobalShortcut,
  type AppCommandHandlers,
} from './appCommands';

function createHandlers(): AppCommandHandlers & { commands: EditorCommand[] } {
  const commands: EditorCommand[] = [];
  return {
    commands,
    createNewFile: vi.fn(),
    createNewWindow: vi.fn(),
    openFileDialog: vi.fn(),
    openFolderDialog: vi.fn(),
    openRecentEntry: vi.fn(),
    saveMarkdownFile: vi.fn(),
    runCommand: vi.fn((command: EditorCommand) => {
      commands.push(command);
    }),
    openTablePicker: vi.fn(),
    openLinkPicker: vi.fn(),
    editFrontMatter: vi.fn(),
    showUnavailableFeature: vi.fn(),
    setMode: vi.fn(),
    getMode: vi.fn((): EditorMode => 'semantic'),
    toggleTheme: vi.fn(),
    toggleFocusMode: vi.fn(),
    switchToNextTab: vi.fn(),
    switchToPrevTab: vi.fn(),
    getDefaultCodeBlockLanguage: vi.fn(() => 'ts'),
    getDefaultDiagramType: vi.fn(() => 'flowchart'),
  };
}

describe('appCommands', () => {
  it('通过桌面菜单命令新建窗口', () => {
    const handlers = createHandlers();

    executeDesktopCommand('new-window', handlers);

    expect(handlers.createNewWindow).toHaveBeenCalledTimes(1);
  });

  it('通过桌面菜单命令打开最近文件', () => {
    const handlers = createHandlers();

    executeDesktopCommand('open-recent:file:D:\\Docs\\demo.md', handlers);

    expect(handlers.openRecentEntry).toHaveBeenCalledWith('D:\\Docs\\demo.md', 'file');
  });

  it('通过桌面菜单命令打开最近文件夹', () => {
    const handlers = createHandlers();

    executeDesktopCommand('open-recent:folder:D:\\Docs', handlers);

    expect(handlers.openRecentEntry).toHaveBeenCalledWith('D:\\Docs', 'folder');
  });

  it('兼容旧格式打开最近文件', () => {
    const handlers = createHandlers();

    executeDesktopCommand('open-recent:D:\\Docs\\demo.md', handlers);

    expect(handlers.openRecentEntry).toHaveBeenCalledWith('D:\\Docs\\demo.md', 'file');
  });

  it('通过桌面菜单命令触发清除样式', () => {
    const handlers = createHandlers();

    executeDesktopCommand('menu-clear-format', handlers);

    expect(handlers.commands).toEqual([{ type: 'clearInlineStyles' }]);
    expect(handlers.showUnavailableFeature).not.toHaveBeenCalled();
  });

  it('通过桌面菜单命令触发高亮', () => {
    const handlers = createHandlers();

    executeDesktopCommand('menu-highlight', handlers);

    expect(handlers.commands).toEqual([{ type: 'toggleHighlight' }]);
    expect(handlers.showUnavailableFeature).not.toHaveBeenCalled();
  });

  it('通过桌面菜单命令打开超链接编辑器', () => {
    const handlers = createHandlers();

    executeDesktopCommand('menu-link', handlers);

    expect(handlers.openLinkPicker).toHaveBeenCalledTimes(1);
    expect(handlers.showUnavailableFeature).not.toHaveBeenCalled();
  });

  it('通过桌面菜单命令插入行内注释', () => {
    const handlers = createHandlers();

    executeDesktopCommand('menu-comment', handlers);

    expect(handlers.commands).toEqual([{ type: 'insertCommentInline' }]);
    expect(handlers.showUnavailableFeature).not.toHaveBeenCalled();
  });

  it('通过桌面菜单命令插入注释块', () => {
    const handlers = createHandlers();

    executeDesktopCommand('menu-comment-block', handlers);

    expect(handlers.commands).toEqual([{ type: 'insertCommentBlock' }]);
    expect(handlers.showUnavailableFeature).not.toHaveBeenCalled();
  });

  it('通过 Ctrl + K 打开超链接编辑器', () => {
    const handlers = createHandlers();
    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'k',
      code: 'KeyK',
      bubbles: true,
      cancelable: true,
    });

    handleGlobalShortcut(event, handlers);

    expect(event.defaultPrevented).toBe(true);
    expect(handlers.openLinkPicker).toHaveBeenCalledTimes(1);
    expect(handlers.commands).toEqual([]);
  });

  it('通过 Ctrl + \\ 触发清除样式快捷键', () => {
    const handlers = createHandlers();
    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: '\\',
      code: 'Backslash',
      bubbles: true,
      cancelable: true,
    });

    handleGlobalShortcut(event, handlers);

    expect(event.defaultPrevented).toBe(true);
    expect(handlers.commands).toEqual([{ type: 'clearInlineStyles' }]);
  });

  it('支持使用设置覆盖常用快捷键', () => {
    const handlers = createHandlers();
    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      altKey: true,
      key: 'e',
      code: 'KeyE',
      bubbles: true,
      cancelable: true,
    });

    handleGlobalShortcut(event, handlers, {
      'new-file': 'Ctrl+N',
      'open-file': 'Ctrl+O',
      'save-file': 'Ctrl+S',
      'toggle-source': 'Ctrl+Alt+E',
      'toggle-theme': 'Ctrl+Shift+L',
      'toggle-focus': 'Ctrl+Shift+F',
      'insert-code-block': 'Ctrl+Shift+K',
      'insert-table': 'Ctrl+Shift+T',
      'insert-math-block': 'Ctrl+Shift+M',
      'menu-link': 'Ctrl+K',
      'menu-clear-format': 'Ctrl+\\',
    });

    expect(event.defaultPrevented).toBe(true);
    expect(handlers.setMode).toHaveBeenCalledWith('source');
  });
});
