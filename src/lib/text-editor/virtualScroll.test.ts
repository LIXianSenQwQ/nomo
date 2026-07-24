import { describe, expect, it } from 'vitest';
import {
  SEGMENTED_FULL_WINDOW_BYTES,
  SEGMENTED_PREVIEW_FALLBACK_BYTES,
  SEGMENTED_PREVIEW_MAX_BYTES,
  SEGMENTED_PREVIEW_MIN_BYTES,
  createSegmentedVirtualScrollMetrics,
  estimateSegmentedPixelsPerByte,
  resolveByteOffsetFromVirtualScroll,
  resolveCenteredSegmentWindowStart,
  resolveSegmentedPreviewBytes,
  resolveVirtualScrollTopForByteOffset,
} from './virtualScroll';

describe('segmented virtual scroll', () => {
  it('keeps total height independent from later rendered window heights', () => {
    const pixelsPerByte = estimateSegmentedPixelsPerByte(512 * 1024, 120_000);
    const first = createSegmentedVirtualScrollMetrics(8 * 1024 * 1024, 900, pixelsPerByte);
    const afterWrappedWindow = createSegmentedVirtualScrollMetrics(
      8 * 1024 * 1024,
      900,
      pixelsPerByte,
    );

    expect(afterWrappedWindow.totalHeight).toBe(first.totalHeight);
    expect(afterWrappedWindow.maxScrollTop).toBe(first.maxScrollTop);
  });

  it('allocates at least one viewport per full window for a long unwrapped line', () => {
    const byteLength = SEGMENTED_FULL_WINDOW_BYTES * 4;
    const metrics = createSegmentedVirtualScrollMetrics(byteLength, 800, 1 / 1024);

    expect(metrics.totalHeight).toBe(3_200);
    expect(metrics.maxScrollTop).toBe(2_400);
  });

  it('round-trips byte anchors across the fixed virtual runway', () => {
    const metrics = createSegmentedVirtualScrollMetrics(10_000_000, 900, 0.2);
    for (const byteOffset of [0, 1_000_000, 5_000_000, 9_500_000, 10_000_000]) {
      const scrollTop = resolveVirtualScrollTopForByteOffset(byteOffset, metrics);
      expect(resolveByteOffsetFromVirtualScroll(scrollTop, metrics)).toBe(byteOffset);
    }
  });

  it('centers preview and full windows while keeping both file boundaries reachable', () => {
    expect(resolveCenteredSegmentWindowStart(0, 1_000, 200)).toBe(0);
    expect(resolveCenteredSegmentWindowStart(500, 1_000, 200)).toBe(400);
    expect(resolveCenteredSegmentWindowStart(1_000, 1_000, 200)).toBe(800);
  });

  it('sizes seek previews to about two viewports and clamps exceptional densities', () => {
    expect(resolveSegmentedPreviewBytes(0, 0, 0)).toBe(SEGMENTED_PREVIEW_FALLBACK_BYTES);
    expect(resolveSegmentedPreviewBytes(800, 512 * 1024, 100_000)).toBe(
      SEGMENTED_PREVIEW_MIN_BYTES,
    );
    expect(resolveSegmentedPreviewBytes(1_000, 512 * 1024, 1_000)).toBe(
      SEGMENTED_PREVIEW_MAX_BYTES,
    );
  });
});
