import type { EditorCore } from '../../lib/editor-core';
import { createImageMarkdownSrc, getImageFiles } from './imageMarkdown';

interface ImageInsertionOptions {
  getEditor(): EditorCore;
  getFileName(): string;
  setStatusMessage(message: string): void;
}

export function createImageInsertionHandlers(options: ImageInsertionOptions) {
  function handleEditorDrop(event: DragEvent) {
    const files = getImageFiles(event.dataTransfer?.files);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    insertImageFiles(files);
  }

  function handleEditorPaste(event: ClipboardEvent) {
    const files = getImageFiles(event.clipboardData?.files);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    insertImageFiles(files);
  }

  function insertImageFiles(files: File[]) {
    const editor = options.getEditor();
    for (const file of files) {
      const markdownSrc = createImageMarkdownSrc(options.getFileName(), file.name);
      editor.execute({
        type: 'insertImage',
        src: markdownSrc,
        alt: file.name
      });
    }
    options.setStatusMessage(`已插入 ${files.length} 张图片相对路径`);
    editor.focus();
  }

  return {
    handleEditorDrop,
    handleEditorPaste
  };
}
