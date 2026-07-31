export type MarkdownEncoding =
  | 'utf-8'
  | 'utf-8-bom'
  | 'utf-16le-bom'
  | 'utf-16be-bom'
  | 'gbk';

export const DEFAULT_MARKDOWN_ENCODING: MarkdownEncoding = 'utf-8';

export function normalizeMarkdownEncoding(value: unknown): MarkdownEncoding {
  switch (value) {
    case 'utf-8':
    case 'utf-8-bom':
    case 'utf-16le-bom':
    case 'utf-16be-bom':
    case 'gbk':
      return value;
    default:
      return DEFAULT_MARKDOWN_ENCODING;
  }
}

export interface OpenDocumentResult {
  path: string;
  markdown: string;
  encoding: MarkdownEncoding;
  modifiedAt?: number;
}

export interface SaveDocumentInput {
  path: string;
  markdown: string;
  encoding: MarkdownEncoding;
}

export interface DocumentSnapshotRecord {
  id: string;
  documentPath: string;
  markdown: string;
  contentHash: string;
  createdAt: number;
  reason: string;
}

export interface FileStorage {
  open(path: string): Promise<OpenDocumentResult>;
  save(input: SaveDocumentInput): Promise<void>;
  saveAs(input: SaveDocumentInput): Promise<string>;
}

export interface DocumentRepository {
  rememberRecentFile(path: string): Promise<void>;
  listRecentFiles(): Promise<string[]>;
  createSnapshot(record: DocumentSnapshotRecord): Promise<void>;
}
