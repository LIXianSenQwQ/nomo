export function getImageFiles(fileList: FileList | undefined | null) {
  return Array.from(fileList ?? []).filter((file) => file.type.startsWith('image/'));
}

export function createImageMarkdownSrc(fileName: string, imageName: string) {
  const baseName = fileName.replace(/\.(md|markdown)$/i, '') || 'document';
  const safeName = imageName.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-');
  return `./${baseName}.assets/${safeName}`;
}
