import { describe, expect, it } from 'vitest';
import type { FileTreeNode } from '../types';
import {
  canExpandFolderNode,
  collectTreePaths,
  pruneExpandedFolders,
  removeTreePaths,
} from './folderTree';

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

  it('collects loaded file tree paths for existence checks', () => {
    const tree = [
      folder({
        children_loaded: true,
        children: [
          {
            name: 'demo.md',
            path: 'D:\\Demo\\Workspace\\docs\\demo.md',
            is_dir: false,
            has_children: false,
            children_loaded: true,
            children: [],
          },
        ],
      }),
    ];

    expect(collectTreePaths(tree)).toEqual([
      'D:\\Demo\\Workspace\\docs',
      'D:\\Demo\\Workspace\\docs\\demo.md',
    ]);
  });

  it('removes missing files from loaded folder children', () => {
    const tree = [
      folder({
        children_loaded: true,
        has_children: true,
        children: [
          {
            name: 'demo.md',
            path: 'D:\\Demo\\Workspace\\docs\\demo.md',
            is_dir: false,
            has_children: false,
            children_loaded: true,
            children: [],
          },
          {
            name: 'keep.md',
            path: 'D:\\Demo\\Workspace\\docs\\keep.md',
            is_dir: false,
            has_children: false,
            children_loaded: true,
            children: [],
          },
        ],
      }),
    ];

    expect(removeTreePaths(tree, ['D:\\Demo\\Workspace\\docs\\demo.md'])).toEqual([
      folder({
        children_loaded: true,
        has_children: true,
        children: [
          {
            name: 'keep.md',
            path: 'D:\\Demo\\Workspace\\docs\\keep.md',
            is_dir: false,
            has_children: false,
            children_loaded: true,
            children: [],
          },
        ],
      }),
    ]);
  });

  it('removes missing folders with descendants and prunes expanded state', () => {
    const expandedFolders = new Set([
      'D:\\Demo\\Workspace\\docs',
      'D:\\Demo\\Workspace\\docs\\notes',
      'D:\\Demo\\Workspace\\assets',
    ]);

    expect(
      removeTreePaths(
        [
          folder({
            name: 'docs',
            path: 'D:\\Demo\\Workspace\\docs',
            has_children: true,
            children_loaded: true,
            children: [
              folder({
                name: 'notes',
                path: 'D:\\Demo\\Workspace\\docs\\notes',
              }),
            ],
          }),
          folder({
            name: 'assets',
            path: 'D:\\Demo\\Workspace\\assets',
          }),
        ],
        ['D:\\Demo\\Workspace\\docs'],
      ),
    ).toEqual([
      folder({
        name: 'assets',
        path: 'D:\\Demo\\Workspace\\assets',
      }),
    ]);
    expect(
      Array.from(pruneExpandedFolders(expandedFolders, ['D:\\Demo\\Workspace\\docs'])),
    ).toEqual(['D:\\Demo\\Workspace\\assets']);
  });
});
