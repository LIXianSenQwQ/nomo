export function getImageFiles(fileList: FileList | undefined | null) {
  return Array.from(fileList ?? []).filter((file) => file.type.startsWith('image/'));
}

export function createImageMarkdownSrc(fileName: string, imageName: string) {
  const baseName = fileName.replace(/\.(md|markdown)$/i, '') || 'document';
  const safeName = imageName
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-');
  return `./assets/${safeName || `${baseName}.png`}`;
}

export function createImageMarkdown(alt: string, src: string) {
  const safeAlt = alt.replace(/[\[\]\n\r]/g, ' ').trim() || 'image';
  return `![${safeAlt}](${src})`;
}
