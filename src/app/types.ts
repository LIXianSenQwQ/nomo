export interface Tab {
  id: string;
  fileName: string;
  filePath: string;
  nativePath: string | null;
  markdown: string;
  dirty: boolean;
  lastKnownModifiedAt: number;
  largeDocumentMode: boolean;
  readonlyDocumentMode: boolean;
  externalFileWarning: string;
  version: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileTreeNode[];
}
