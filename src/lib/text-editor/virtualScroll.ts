export const SEGMENTED_FULL_WINDOW_BYTES = 512 * 1024;
export const SEGMENTED_PREVIEW_MIN_BYTES = 16 * 1024;
export const SEGMENTED_PREVIEW_MAX_BYTES = 64 * 1024;
export const SEGMENTED_PREVIEW_FALLBACK_BYTES = 32 * 1024;
export const SEGMENTED_PREVIEW_THROTTLE_MS = 50;
export const SEGMENTED_SCROLL_SETTLE_MS = 100;
export const SEGMENTED_MAX_VIRTUAL_HEIGHT = 16_000_000;

const MIN_PIXELS_PER_BYTE = 1 / 1024;
const MAX_PIXELS_PER_BYTE = 16;
const PREVIEW_ALIGNMENT_BYTES = 4 * 1024;

export interface SegmentedVirtualScrollMetrics {
  byteLength: number;
  viewportHeight: number;
  totalHeight: number;
  maxScrollTop: number;
  pixelsPerByte: number;
}

/**
 * 用首个已渲染窗口校准一次“字节到虚拟像素”的比例。
 * 比例随后保持冻结，分段切换、自动换行和索引进度不得反向改变滚动总高度。
 */
export function estimateSegmentedPixelsPerByte(
  visibleBytes: number,
  measuredWindowHeight: number,
  fallback = 0.25,
) {
  if (visibleBytes <= 0 || measuredWindowHeight <= 0) {
    return clamp(fallback, MIN_PIXELS_PER_BYTE, MAX_PIXELS_PER_BYTE);
  }
  return clamp(measuredWindowHeight / visibleBytes, MIN_PIXELS_PER_BYTE, MAX_PIXELS_PER_BYTE);
}

/**
 * 固定虚拟轨道只由文件字节长度、视口和冻结比例决定。
 * 每个正式窗口至少分配一个视口的滚动跨度，保证极长单行也能抵达全部字节区域。
 */
export function createSegmentedVirtualScrollMetrics(
  byteLength: number,
  viewportHeight: number,
  pixelsPerByte: number,
  maxVirtualHeight = SEGMENTED_MAX_VIRTUAL_HEIGHT,
): SegmentedVirtualScrollMetrics {
  assertNonNegativeSafeInteger(byteLength, 'byteLength');
  const safeViewportHeight = Math.max(1, finiteOr(viewportHeight, 1));
  const safePixelsPerByte = clamp(
    finiteOr(pixelsPerByte, MIN_PIXELS_PER_BYTE),
    MIN_PIXELS_PER_BYTE,
    MAX_PIXELS_PER_BYTE,
  );
  const pagingHeight =
    Math.max(1, Math.ceil(byteLength / SEGMENTED_FULL_WINDOW_BYTES)) * safeViewportHeight;
  const estimatedHeight = Math.ceil(byteLength * safePixelsPerByte);
  const totalHeight = Math.max(
    safeViewportHeight,
    Math.min(maxVirtualHeight, Math.max(pagingHeight, estimatedHeight)),
  );
  return {
    byteLength,
    viewportHeight: safeViewportHeight,
    totalHeight,
    maxScrollTop: Math.max(0, totalHeight - safeViewportHeight),
    pixelsPerByte: safePixelsPerByte,
  };
}

/** 固定轨道上的位置只表达全文字节进度，不依赖当前窗口的 DOM 高度。 */
export function resolveByteOffsetFromVirtualScroll(
  scrollTop: number,
  metrics: SegmentedVirtualScrollMetrics,
) {
  if (metrics.byteLength === 0 || metrics.maxScrollTop === 0) return 0;
  const ratio = clamp(finiteOr(scrollTop, 0) / metrics.maxScrollTop, 0, 1);
  return Math.round(ratio * metrics.byteLength);
}

/** 在轨道或窗口重建后，把同一全局字节锚点恢复到原来的文件进度。 */
export function resolveVirtualScrollTopForByteOffset(
  byteOffset: number,
  metrics: SegmentedVirtualScrollMetrics,
) {
  if (metrics.byteLength === 0 || metrics.maxScrollTop === 0) return 0;
  const ratio = clamp(finiteOr(byteOffset, 0) / metrics.byteLength, 0, 1);
  return ratio * metrics.maxScrollTop;
}

/** 正式窗口和快速预览都围绕用户锚点读取，避免锚点总落在窗口边缘。 */
export function resolveCenteredSegmentWindowStart(
  anchorByte: number,
  byteLength: number,
  targetBytes: number,
) {
  assertNonNegativeSafeInteger(byteLength, 'byteLength');
  if (!Number.isSafeInteger(targetBytes) || targetBytes <= 0) {
    throw new RangeError('targetBytes 必须是正安全整数');
  }
  const safeAnchor = clamp(Math.trunc(finiteOr(anchorByte, 0)), 0, byteLength);
  const maxStart = Math.max(0, byteLength - targetBytes);
  return Math.min(maxStart, Math.max(0, safeAnchor - Math.floor(targetBytes / 2)));
}

/**
 * 快速拖动只抢占约两个视口的文字；下限保证一次 IPC 有意义，上限控制临时 CodeMirror 成本。
 */
export function resolveSegmentedPreviewBytes(
  viewportHeight: number,
  visibleBytes: number,
  measuredWindowHeight: number,
) {
  if (viewportHeight <= 0 || visibleBytes <= 0 || measuredWindowHeight <= 0) {
    return SEGMENTED_PREVIEW_FALLBACK_BYTES;
  }
  const bytesPerPixel = visibleBytes / measuredWindowHeight;
  const desired = Math.ceil(bytesPerPixel * viewportHeight * 2);
  const aligned = Math.ceil(desired / PREVIEW_ALIGNMENT_BYTES) * PREVIEW_ALIGNMENT_BYTES;
  return clamp(aligned, SEGMENTED_PREVIEW_MIN_BYTES, SEGMENTED_PREVIEW_MAX_BYTES);
}

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function assertNonNegativeSafeInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} 必须是非负安全整数`);
  }
}
