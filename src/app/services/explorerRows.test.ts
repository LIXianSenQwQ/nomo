import { describe, expect, it } from 'vitest';
import type { FileTreeNode } from '../types';
import { buildVisibleExplorerRows } from './explorerRows';

describe('buildVisibleExplorerRows', () => {
  const folderPath = 'D:\\Demo\\Workspace\\docs';
  const childPath = 'D:\\Demo\\Workspace\\docs\\note.md';

  const folderTree: FileTreeNode[] = [
    {
      name: 'docs',
      path: folderPath,
      is_dir: true,
      children_loaded: true,
      has_children: true,
      loading: false,
      children: [
        {
          name: 'note.md',
          path: childPath,
          is_dir: false,
          children_loaded: true,
          has_children: false,
          loading: false,
          children: [],
        },
      ],
    },
  ];

  it('removes descendant rows when expanded folders are collapsed', () => {
    const expandedRows = buildVisibleExplorerRows(folderTree, new Set([folderPath]), null, 26);
    const collapsedRows = buildVisibleExplorerRows(folderTree, new Set(), null, 26);

    expect(expandedRows.map((row) => row.key)).toEqual([folderPath, childPath]);
    expect(collapsedRows.map((row) => row.key)).toEqual([folderPath]);
  });

  it('keeps creating rows tied to the visible parent folder', () => {
    const rows = buildVisibleExplorerRows(folderTree, new Set(), folderPath, 26);

    expect(rows.map((row) => row.key)).toEqual([folderPath, `${folderPath}:creating`]);
  });
});
