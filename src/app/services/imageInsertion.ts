import type { EditorCore, EditorMode } from '../../lib/editor-core';
import { getImageLoader } from '../../lib/editor-core/renderers';
import type { ImageContext } from '../../lib/services/render';
import { createPerfTimer, logError, logInfo } from '../../lib/services/logger';
import { t } from '../i18n';
import { createImageMarkdown, getImageFiles } from './imageMarkdown';

interface ImageInsertionOptions {
  getEditor(): EditorCore;
  getMode(): EditorMode;
  getFileName(): string;
  getNativePath(): string | null;
  getSourceTextarea(): HTMLTextAreaElement;
  getImageContext(): ImageContext;
  saveMarkdownFile(saveAs?: boolean): Promise<void> | void;
  setMarkdown(markdown: string): void;
  setStatusMessage(message: string): void;
  syncSourceTextareaHeight(): void;
}

export function createImageInsertionHandlers(options: ImageInsertionOptions) {
  function handleEditorDrop(event: DragEvent) {
    const files = getImageFiles(event.dataTransfer?.files);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    void insertImageFiles(files);
  }

  function handleEditorPaste(event: ClipboardEvent) {
    const files = getImageFiles(event.clipboardData?.files);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    void insertImageFiles(files);
  }

  async function insertImageFiles(files: File[]) {
    const timer = createPerfTimer('ImageInsertion', '插入图片');
    logInfo('ImageInsertion', '开始插入图片', { count: files.length });
    const loader = getImageLoader();
    if (!loader) {
      timer.end({ failed: true, reason: 'loader-not-ready' });
      options.setStatusMessage(t.imageServiceNotReady());
      return;
    }

    const context = options.getImageContext();
    const strategy = context.settings?.imageInsertStrategy ?? 'copy-assets';
    if (strategy !== 'upload' && !options.getNativePath()) {
      options.setStatusMessage(t.saveBeforeInsertLocalImage());
      await options.saveMarkdownFile(true);
      if (!options.getNativePath()) {
        timer.end({ cancelled: true, reason: 'document-not-saved' });
        options.setStatusMessage(t.imageInsertCancelled());
        return;
      }
    }

    const editor = options.getEditor();
    const imported: Array<{ src: string; alt: string }> = [];
    let failed = 0;

    for (const file of files) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const result = await loader.import(
          {
            fileName: getInsertFileName(file, imported.length),
            bytes,
          },
          options.getImageContext(),
        );
        imported.push({ src: result.markdownSrc, alt: file.name || 'image' });
      } catch (error) {
        failed += 1;
        logError('ImageInsertion', 'Failed to import image', {
          fileName: file.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (imported.length > 0) {
      if (options.getMode() === 'source') {
        insertSourceMarkdown(imported);
      } else {
        for (const item of imported) {
          const imageSettings = context.settings;
          const defaultAlign =
            imageSettings?.defaultImageAlign && imageSettings.defaultImageAlign !== 'none'
              ? imageSettings.defaultImageAlign
              : null;
          editor.execute({
            type: 'insertImage',
            src: item.src,
            alt: item.alt,
            width: imageSettings?.defaultImageWidth || null,
            align: defaultAlign,
          });
        }
        editor.focus();
      }
    }

    if (failed > 0) {
      options.setStatusMessage(
        t.imagesInsertedWithFailures({ inserted: imported.length, failed }),
      );
    } else {
      options.setStatusMessage(t.imagesInserted({ inserted: imported.length }));
    }
    timer.end({ inserted: imported.length, failed });
    logInfo('ImageInsertion', '图片插入完成', { inserted: imported.length, failed });
  }

  function insertSourceMarkdown(items: Array<{ src: string; alt: string }>) {
    const textarea = options.getSourceTextarea();
    const markdown = options.getEditor().getMarkdown();
    const start = textarea?.selectionStart ?? markdown.length;
    const end = textarea?.selectionEnd ?? start;
    const imageSettings = options.getImageContext().settings;
    const attrs = createImageAttributeText(
      imageSettings?.defaultImageWidth || '',
      imageSettings?.defaultImageAlign ?? 'none',
    );
    const snippet = items.map((item) => `${createImageMarkdown(item.alt, item.src)}${attrs}`).join('\n');
    const prefix = markdown.slice(0, start);
    const suffix = markdown.slice(end);
    const before = prefix.endsWith('\n') || prefix.length === 0 ? '' : '\n';
    const after = suffix.startsWith('\n') || suffix.length === 0 ? '' : '\n';
    const nextMarkdown = `${prefix}${before}${snippet}${after}${suffix}`;
    const nextSelection = prefix.length + before.length + snippet.length;

    options.setMarkdown(nextMarkdown);
    requestAnimationFrame(() => {
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(nextSelection, nextSelection);
      options.syncSourceTextareaHeight();
    });
  }

  function createImageAttributeText(width: string, align: string) {
    const attributes: string[] = [];
    if (width) {
      attributes.push(`width=${width}`);
    }
    if (align === 'left' || align === 'center' || align === 'right') {
      attributes.push(`align=${align}`);
    }
    return attributes.length > 0 ? `{${attributes.join(' ')}}` : '';
  }

  function getInsertFileName(file: File, index: number) {
    if (file.name?.trim()) {
      return file.name;
    }
    return index === 0 ? 'image.png' : `image-${index + 1}.png`;
  }

  return {
    handleEditorDrop,
    handleEditorPaste,
  };
}
