import { describe, expect, it } from 'vitest';
import { createEditorCore, setImageLoader } from './createEditorCore';

describe('ImageNodeView', () => {
  it('renders resolved images with a fullscreen button', async () => {
    setImageLoader({
      async resolve(src) {
        return {
          src,
          displaySrc: 'data:image/png;base64,AA==',
          exists: true,
        };
      },
      async import() {
        return { markdownSrc: './assets/a.png' };
      },
    });

    const target = document.createElement('div');
    document.body.appendChild(target);
    const editor = createEditorCore({ markdown: '![截图](./assets/a.png)', target });

    await Promise.resolve();
    await Promise.resolve();

    const imageNode = target.querySelector('.image-node');
    const button = target.querySelector<HTMLButtonElement>('.image-node-fullscreen-button');
    expect(imageNode).not.toBeNull();
    expect(target.querySelector('.image-node img')?.getAttribute('alt')).toBe('截图');
    expect(button).not.toBeNull();

    button?.click();
    expect(document.body.querySelector('.image-fullscreen-overlay')).not.toBeNull();
    expect(document.body.querySelector('.image-fullscreen-zoom-badge')?.textContent).toBe('100%');

    document.body.querySelector<HTMLButtonElement>('.image-fullscreen-close-button')?.click();
    expect(document.body.querySelector('.image-fullscreen-overlay')).toBeNull();

    editor.destroy();
    target.remove();
  });

  it('shows a placeholder for missing images', async () => {
    setImageLoader({
      async resolve(src) {
        return {
          src,
          displaySrc: src,
          exists: false,
          error: '图片文件不存在',
        };
      },
      async import() {
        return { markdownSrc: './assets/missing.png' };
      },
    });

    const target = document.createElement('div');
    document.body.appendChild(target);
    const editor = createEditorCore({ markdown: '![缺失](./assets/missing.png)', target });

    await Promise.resolve();
    await Promise.resolve();

    expect(target.querySelector('.image-node-placeholder')?.textContent).toContain('图片文件不存在');

    editor.destroy();
    target.remove();
  });

  it('reports an image deletion only after the final reference is removed', () => {
    const deleted: string[][] = [];
    const editor = createEditorCore({
      markdown: '![a](./assets/a.png)\n\n![b](./assets/a.png)\n\n![c](./assets/c.png)',
      onImagesDeleted: (event) => deleted.push(event.srcs),
    });

    editor.setMarkdown('![a](./assets/a.png)\n\n![c](./assets/c.png)');
    expect(deleted).toEqual([]);

    editor.setMarkdown('![c](./assets/c.png)');
    expect(deleted).toEqual([['./assets/a.png']]);

    editor.setMarkdown('', { reason: 'open-file' });
    expect(deleted).toEqual([['./assets/a.png']]);

    editor.destroy();
  });
});
