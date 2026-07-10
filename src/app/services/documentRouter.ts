import type { DocumentKind } from '../types';
import { getDocumentKindFromPath } from './tabs';

export interface DocumentOpenPorts<MarkdownResult, SegmentedResult> {
  openMarkdown(path: string): Promise<MarkdownResult>;
  openSegmented(path: string, documentKind: 'text' | 'json'): Promise<SegmentedResult>;
}

export type RoutedDocumentOpenResult<MarkdownResult, SegmentedResult> =
  | { documentKind: 'markdown'; value: MarkdownResult }
  | { documentKind: 'text' | 'json'; value: SegmentedResult };

/**
 * 文件扩展名是两条存储链路的唯一入口事实源；这里先判型再读取，确保 TXT/JSON
 * 永远没有机会调用会构造完整字符串的 Markdown port。
 */
export async function openDocumentByPath<MarkdownResult, SegmentedResult>(
  path: string,
  ports: DocumentOpenPorts<MarkdownResult, SegmentedResult>,
): Promise<RoutedDocumentOpenResult<MarkdownResult, SegmentedResult>> {
  const documentKind: DocumentKind | null = getDocumentKindFromPath(path);
  if (!documentKind) {
    throw new Error(`Unsupported document type: ${path}`);
  }

  if (documentKind === 'markdown') {
    return { documentKind, value: await ports.openMarkdown(path) };
  }

  return {
    documentKind,
    value: await ports.openSegmented(path, documentKind),
  };
}
