import { describe, expect, it } from 'vitest';
import type { FileTreeNode } from '../types';
import { canExpandFolderNode } from './folderTree';

describe('canExpandFolderNode', () => {
  function folder(overrides: Partial<FileTreeNode> = {}): FileTreeNode {
    return {
      name: 'docs',
      path: 'D:\\Demo\\Workspace\\docs',
      is_dir: true,
      has_children: false,
      children_loaded: false,
      loading: false,
      children: [],
      ...overrides,
    };
  }

  it('does not expand unloaded folders when the backend says they have no visible children', () => {
    expect(canExpandFolderNode(folder({ children_loaded: false, has_children: false }))).toBe(
      false,
    );
  });

  it('expands unloaded folders when the backend says they have visible children', () => {
    expect(canExpandFolderNode(folder({ children_loaded: false, has_children: true }))).toBe(true);
  });

  it('expands folders that already have loaded children', () => {
    expect(
      canExpandFolderNode(
        folder({
          children_loaded: true,
          children: [
            folder({
              name: 'notes',
              path: 'D:\\Demo\\Workspace\\docs\\notes',
            }),
          ],
        }),
      ),
    ).toBe(true);
  });

  it('keeps loading and pending-create folders expandable for transient UI states', () => {
    expect(canExpandFolderNode(folder({ loading: true }))).toBe(true);
    expect(canExpandFolderNode(folder(), true)).toBe(true);
  });
});
