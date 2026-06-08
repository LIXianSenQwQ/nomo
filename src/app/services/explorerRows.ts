import type { FileTreeNode } from '../types';

export type ExplorerTreeRowData =
  | {
      key: string;
      type: 'folder' | 'file';
      node: FileTreeNode;
      depth: number;
    }
  | {
      key: string;
      type: 'creating';
      depth: number;
    };

export type ExplorerTreeRow = ExplorerTreeRowData & { top: number };

export function buildVisibleExplorerRows(
  nodes: FileTreeNode[],
  expandedFolders: Set<string>,
  creatingParentPath: string | null,
  rowHeight: number,
): ExplorerTreeRow[] {
  const rows: ExplorerTreeRowData[] = [];
  appendVisibleRows(rows, nodes, 1, expandedFolders, creatingParentPath);
  return rows.map((row, index) => ({
    ...row,
    top: index * rowHeight,
  }));
}

function appendVisibleRows(
  rows: ExplorerTreeRowData[],
  nodes: FileTreeNode[],
  depth: number,
  expandedFolders: Set<string>,
  creatingParentPath: string | null,
) {
  for (const node of nodes) {
    rows.push({
      key: node.path,
      type: node.is_dir ? 'folder' : 'file',
      node,
      depth,
    });
    if (node.is_dir && creatingParentPath === node.path) {
      rows.push({
        key: `${node.path}:creating`,
        type: 'creating',
        depth,
      });
    }
    if (node.is_dir && expandedFolders.has(node.path) && node.children?.length) {
      appendVisibleRows(rows, node.children, depth + 1, expandedFolders, creatingParentPath);
    }
  }
}
