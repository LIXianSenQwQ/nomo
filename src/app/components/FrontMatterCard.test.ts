import { cleanup, fireEvent, render } from '@testing-library/svelte/pure';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FrontMatterCard from './FrontMatterCard.svelte';
import { createDefaultFrontMatterBlock, extractFrontMatterBlock } from '../../lib/markdown/frontMatter';

describe('FrontMatterCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('focuses the metadata textarea and selects the title value when requested', async () => {
    const frontMatter = extractFrontMatterBlock(createDefaultFrontMatterBlock('2026-06-09'));
    expect(frontMatter).not.toBeNull();

    const { container } = render(FrontMatterCard, {
      props: {
        interfaceLocale: 'zh-CN',
        frontMatter: frontMatter!,
        editing: true,
        focusRequest: 1,
        focusTarget: 'title-value',
        enterEdit: vi.fn(),
        leaveEdit: vi.fn(),
        updateContent: vi.fn(),
        deleteFrontMatter: vi.fn(),
      },
    });

    await waitForFocusWork();

    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(document.activeElement).toBe(textarea);

    const titleStart = frontMatter!.content.indexOf('文档标题');
    expect(textarea!.selectionStart).toBe(titleStart);
    expect(textarea!.selectionEnd).toBe(titleStart + '文档标题'.length);
  });

  it('leaves edit mode only when clicking outside the metadata card', async () => {
    const frontMatter = extractFrontMatterBlock(createDefaultFrontMatterBlock('2026-06-09'));
    const leaveEdit = vi.fn();
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    const { container } = render(FrontMatterCard, {
      props: {
        interfaceLocale: 'zh-CN',
        frontMatter: frontMatter!,
        editing: true,
        focusRequest: 1,
        focusTarget: 'title-value',
        enterEdit: vi.fn(),
        leaveEdit,
        updateContent: vi.fn(),
        deleteFrontMatter: vi.fn(),
      },
    });

    await waitForFocusWork();

    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();

    await fireEvent.click(textarea!);
    expect(leaveEdit).not.toHaveBeenCalled();

    await fireEvent.click(outside);
    expect(leaveEdit).toHaveBeenCalledTimes(1);

    outside.remove();
  });
});

function waitForFocusWork() {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => window.setTimeout(resolve, 0), 0);
  });
}
