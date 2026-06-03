import { describe, expect, it } from 'vitest';
import type { OutlineItem } from '../../lib/outline/outlineService';
import {
  isOutlineItemExpanded,
  isOutlineItemVisible,
  toggleOutlineItemExpanded,
} from './outlineState';

describe('outlineState', () => {
  const outline: OutlineItem[] = [
    { id: 'root', level: 1, title: 'Root', line: 1 },
    { id: 'child', level: 2, title: 'Child', line: 3 },
    { id: 'grandchild', level: 3, title: 'Grandchild', line: 5 },
    { id: 'sibling', level: 2, title: 'Sibling', line: 7 },
  ];

  it('toggles collapsed heading visibility for all descendants', () => {
    const collapsed = toggleOutlineItemExpanded(new Set<string>(), outline[0]);

    expect(isOutlineItemExpanded(collapsed, outline[0])).toBe(false);
    expect(isOutlineItemVisible(outline, collapsed, 0)).toBe(true);
    expect(isOutlineItemVisible(outline, collapsed, 1)).toBe(false);
    expect(isOutlineItemVisible(outline, collapsed, 2)).toBe(false);
    expect(isOutlineItemVisible(outline, collapsed, 3)).toBe(false);

    const expanded = toggleOutlineItemExpanded(collapsed, outline[0]);
    expect(isOutlineItemExpanded(expanded, outline[0])).toBe(true);
    expect(isOutlineItemVisible(outline, expanded, 1)).toBe(true);
  });
});
