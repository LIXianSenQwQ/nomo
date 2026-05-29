export interface OpenDocumentResult {
  path: string;
  markdown: string;
  modifiedAt?: number;
}

export interface SaveDocumentInput {
  path: string;
  markdown: string;
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
