import type { CodeTokenizer, DiagramRenderer, ImageLoader, MathRenderer } from '../services/render';

let codeTokenizer: CodeTokenizer | null = null;
let diagramRenderer: DiagramRenderer | null = null;
let mathRenderer: MathRenderer | null = null;
let imageLoader: ImageLoader | null = null;

export function setCodeBlockTokenizer(tokenizer: CodeTokenizer): void {
  codeTokenizer = tokenizer;
}

export function setCodeBlockDiagramRenderer(renderer: DiagramRenderer): void {
  diagramRenderer = renderer;
}

export function setCodeBlockMathRenderer(renderer: MathRenderer): void {
  mathRenderer = renderer;
}

export function setImageLoader(loader: ImageLoader): void {
  imageLoader = loader;
}

export function getCodeTokenizer() {
  return codeTokenizer;
}

export function getDiagramRenderer() {
  return diagramRenderer;
}

export function getMathRenderer() {
  return mathRenderer;
}

export function getImageLoader() {
  return imageLoader;
}
