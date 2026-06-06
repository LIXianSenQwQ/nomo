export interface ImageContext {
  documentPath?: string;
  documentFileName?: string;
  documentDir?: string;
  assetsDirectory?: string;
  settings?: ImageHandlingSettings;
}

export interface ImageResolveResult {
  src: string;
  displaySrc: string;
  exists: boolean;
  absolutePath?: string;
  width?: number;
  height?: number;
  error?: string;
}

export interface ImageImportInput {
  fileName: string;
  bytes?: Uint8Array;
  sourcePath?: string;
}

export interface ImageImportResult {
  markdownSrc: string;
  absolutePath?: string;
  reused?: boolean;
  width?: number;
  height?: number;
}

export interface ImageRemoveResult {
  src: string;
  removed: boolean;
  skipped?: boolean;
  error?: string;
}

export interface ImageLoader {
  resolve(src: string, context: ImageContext): Promise<ImageResolveResult>;
  import(input: ImageImportInput, context: ImageContext): Promise<ImageImportResult>;
  remove?(src: string, context: ImageContext): Promise<ImageRemoveResult>;
}

export type ImageInsertStrategy =
  | 'copy-current-folder'
  | 'copy-assets'
  | 'copy-document-assets'
  | 'upload';

export type ImageUploadProvider = 'picgo' | 'picgo-core';

export interface ImageHandlingSettings {
  imageInsertStrategy: ImageInsertStrategy;
  uploadProvider: ImageUploadProvider;
  picgoServerUrl: string;
  picgoCoreCommand: string;
  picgoCoreConfigPath: string;
}

export const DEFAULT_IMAGE_HANDLING_SETTINGS: ImageHandlingSettings = {
  imageInsertStrategy: 'copy-assets',
  uploadProvider: 'picgo',
  picgoServerUrl: 'http://127.0.0.1:36677/upload',
  picgoCoreCommand: 'picgo',
  picgoCoreConfigPath: '',
};

export interface CodeTokenizeInput {
  code: string;
  language?: string;
  theme?: string;
}

export interface CodeTokenLine {
  tokens: Array<{
    content: string;
    color?: string;
    fontStyle?: string;
  }>;
}

export interface CodeTokenizeResult {
  language?: string;
  tokens: CodeTokenLine[];
  html?: string;
}

export interface CodeTokenizer {
  tokenize(input: CodeTokenizeInput): Promise<CodeTokenizeResult>;
}

export interface MathRenderOptions {
  displayMode: boolean;
}

export interface MathRenderResult {
  html: string;
  error?: string;
}

export interface MathRenderer {
  render(tex: string, options: MathRenderOptions): Promise<MathRenderResult>;
}

export interface DiagramRenderOptions {
  theme: 'light' | 'dark';
}

export interface DiagramRenderResult {
  svg: string;
  error?: string;
}

export interface DiagramRenderer {
  renderMermaid(code: string, options: DiagramRenderOptions): Promise<DiagramRenderResult>;
}
