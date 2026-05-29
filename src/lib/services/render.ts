export interface ImageContext {
  documentPath?: string;
  assetsDirectory?: string;
}

export interface ImageResolveResult {
  src: string;
  displaySrc: string;
  exists: boolean;
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
  width?: number;
  height?: number;
}

export interface ImageLoader {
  resolve(src: string, context: ImageContext): Promise<ImageResolveResult>;
  import(input: ImageImportInput, context: ImageContext): Promise<ImageImportResult>;
}

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
