import { ByteLruCache, estimateSegmentedWindowBytes } from './chunkCache';
import type {
  ReadSegmentedWindowRequest,
  SegmentedDocumentPort,
  SegmentedWindow,
} from './protocol';

export type ViewportLoadStatus = 'applied' | 'cached' | 'stale';

export interface ViewportLoadResult {
  status: ViewportLoadStatus;
  requestId: number;
  window?: SegmentedWindow;
}

export interface ViewportLoadOptions {
  /** 快速定位可先请求小窗口；省略时使用正式窗口大小。 */
  targetBytes?: number;
  /** 快速预览阶段禁止预取，停止滚动并扩展为正式窗口后再启动。 */
  prefetch?: boolean;
}

export interface ViewportControllerOptions {
  sessionId: string;
  revision: number;
  byteLength: number;
  port: Pick<SegmentedDocumentPort, 'readWindow'>;
  windowBytes: number;
  cacheCapacityBytes: number;
  prefetchBytes?: number;
  prefetch?: boolean;
  onWindow?: (window: SegmentedWindow) => void;
  onError?: (error: unknown) => void;
}

/**
 * 只管理窗口选择、乱序保护和前后预取，不持有完整文档。
 * 主请求与预取请求使用同一递增 requestId，但只有最新主请求能改变可见窗口。
 */
export class ViewportController {
  private revision: number;
  private byteLength: number;
  private requestSequence = 0;
  private latestPrimaryRequestId = 0;
  private destroyed = false;
  private currentWindow?: SegmentedWindow;
  private currentKey?: string;
  private readonly prefetchKeys = new Set<string>();
  private readonly selectionKeys = new Set<string>();
  private readonly inFlight = new Set<Promise<unknown>>();
  private readonly cache: ByteLruCache<string, SegmentedWindow>;

  constructor(private readonly options: ViewportControllerOptions) {
    assertPositiveInteger(options.windowBytes, 'windowBytes');
    assertPositiveInteger(options.cacheCapacityBytes, 'cacheCapacityBytes');
    this.revision = options.revision;
    this.byteLength = options.byteLength;
    this.cache = new ByteLruCache(options.cacheCapacityBytes, estimateSegmentedWindowBytes);
  }

  getRevision() {
    return this.revision;
  }

  getCurrentWindow() {
    return this.currentWindow;
  }

  seedWindow(window: SegmentedWindow) {
    if (window.revision !== this.revision) {
      throw new Error(`窗口 revision ${window.revision} 与当前 ${this.revision} 不一致`);
    }
    this.applyVisibleWindow(window);
  }

  setRevision(revision: number, byteLength = this.byteLength, preservedWindow?: SegmentedWindow) {
    if (revision === this.revision && byteLength === this.byteLength) {
      return;
    }
    this.revision = revision;
    this.byteLength = byteLength;
    this.cancelPending();
    this.cache.clear();
    this.currentWindow = undefined;
    this.currentKey = undefined;
    this.prefetchKeys.clear();
    this.selectionKeys.clear();
    if (preservedWindow) {
      this.seedWindow({ ...preservedWindow, revision });
    }
  }

  /**
   * 后端同一 revision 的读取语义发生变化时（如 UTF-8 校验完成），强制淘汰旧窗口。
   * requestSequence 同步推进，保证校验前发出的迟到 lossy 响应不能重新进入缓存。
   */
  invalidateCurrentRevisionCache() {
    this.assertAlive();
    this.cancelPending();
    this.cache.clear();
    this.currentWindow = undefined;
    this.currentKey = undefined;
    this.prefetchKeys.clear();
    this.selectionKeys.clear();
  }

  async loadWindow(
    startByte: number,
    options: ViewportLoadOptions = {},
  ): Promise<ViewportLoadResult> {
    this.assertAlive();
    const targetBytes = options.targetBytes ?? this.options.windowBytes;
    assertPositiveInteger(targetBytes, 'targetBytes');
    const targetStart = normalizeWindowStart(
      clampByte(startByte, this.byteLength),
      this.byteLength,
      targetBytes,
    );
    const requestId = ++this.requestSequence;
    this.latestPrimaryRequestId = requestId;

    const cached = this.findCachedWindow(targetStart, targetBytes);
    if (cached) {
      this.applyVisibleWindow(cached);
      if (options.prefetch !== false) this.schedulePrefetch(cached);
      return { status: 'cached', requestId, window: cached };
    }

    const request = this.createRequest(targetStart, requestId, targetBytes);
    const requestPromise = this.options.port.readWindow(request);
    this.track(requestPromise);
    try {
      const window = await requestPromise;
      if (!this.isCurrentResponse(request, window, true)) {
        return { status: 'stale', requestId };
      }
      this.applyVisibleWindow(window);
      if (options.prefetch !== false) this.schedulePrefetch(window);
      return { status: 'applied', requestId, window };
    } catch (error) {
      if (
        this.destroyed ||
        requestId !== this.latestPrimaryRequestId ||
        request.revision !== this.revision
      ) {
        return { status: 'stale', requestId };
      }
      throw error;
    }
  }

  cancelPending() {
    this.latestPrimaryRequestId = ++this.requestSequence;
  }

  setSelectionPins(byteOffsets: number[]) {
    for (const key of this.selectionKeys) {
      if (key !== this.currentKey && !this.prefetchKeys.has(key)) {
        this.cache.unpin(key);
      }
    }
    this.selectionKeys.clear();
    for (const byteOffset of byteOffsets) {
      const window = this.findCachedWindow(byteOffset);
      if (!window) continue;
      const key = cacheKey(window);
      this.selectionKeys.add(key);
      this.cache.pin(key);
    }
  }

  hasCachedWindowAt(byteOffset: number) {
    return Boolean(this.findCachedWindow(byteOffset));
  }

  async waitForIdle() {
    while (this.inFlight.size > 0) {
      await Promise.allSettled([...this.inFlight]);
    }
  }

  destroy() {
    this.destroyed = true;
    this.cancelPending();
    this.cache.clear();
    this.prefetchKeys.clear();
    this.selectionKeys.clear();
    this.currentWindow = undefined;
    this.currentKey = undefined;
  }

  private createRequest(
    startByte: number,
    requestId: number,
    targetBytes = this.options.windowBytes,
  ): ReadSegmentedWindowRequest {
    return {
      sessionId: this.options.sessionId,
      revision: this.revision,
      startByte,
      targetBytes,
      requestId,
    };
  }

  private applyVisibleWindow(window: SegmentedWindow) {
    const key = cacheKey(window);
    if (
      this.currentWindow &&
      this.currentKey === key &&
      sameVisibleWindow(this.currentWindow, window)
    ) {
      // 重复命中当前缓存时只刷新 LRU，不重复通知 Core 重建 CodeMirror，避免滚动锚点抖动。
      this.cache.pin(key);
      this.cache.set(key, window);
      this.currentWindow = window;
      return;
    }
    this.releaseViewportPins();
    this.removeWindowsContainedBy(window);
    this.storeAndPin(window);
    this.currentWindow = window;
    this.currentKey = key;
    this.options.onWindow?.(window);
  }

  private schedulePrefetch(window: SegmentedWindow) {
    if (this.options.prefetch === false || this.destroyed || this.byteLength === 0) {
      return;
    }
    const distance = this.options.prefetchBytes ?? this.options.windowBytes;
    const ownerKey = cacheKey(window);
    // 停止快速拖动后优先补用户继续向下滚动最可能命中的前方窗口，再补后方。
    const starts = [window.endByte, Math.max(0, window.startByte - distance)].filter(
      (start) => start < this.byteLength && !containsByte(window, start),
    );
    for (const start of new Set(starts)) {
      if (this.findCachedWindow(start, this.options.windowBytes)) continue;
      this.prefetch(start, ownerKey);
    }
  }

  private prefetch(startByte: number, ownerKey: string) {
    const requestId = ++this.requestSequence;
    const request = this.createRequest(startByte, requestId);
    const promise = this.options.port
      .readWindow(request)
      .then((window) => {
        if (!this.isCurrentResponse(request, window, false)) return;
        // 预取只服务于发起它的可见窗口；快速滚动后的迟到结果不能继续 pin 缓存。
        if (this.currentKey !== ownerKey) return;
        const key = cacheKey(window);
        this.cache.pin(key);
        this.cache.set(key, window);
        this.prefetchKeys.add(key);
      })
      .catch((error) => reportViewportError(error, this.options.onError));
    this.track(promise);
  }

  private isCurrentResponse(
    request: ReadSegmentedWindowRequest,
    window: SegmentedWindow,
    primary: boolean,
  ) {
    if (this.destroyed || request.revision !== this.revision || window.revision !== this.revision) {
      return false;
    }
    if (window.requestId !== undefined && window.requestId !== request.requestId) {
      return false;
    }
    return !primary || request.requestId === this.latestPrimaryRequestId;
  }

  private storeAndPin(window: SegmentedWindow) {
    const key = cacheKey(window);
    this.cache.pin(key);
    this.cache.set(key, window);
    return key;
  }

  private releaseViewportPins() {
    const keys = new Set([...(this.currentKey ? [this.currentKey] : []), ...this.prefetchKeys]);
    this.prefetchKeys.clear();
    for (const key of keys) {
      if (!this.selectionKeys.has(key)) {
        this.cache.unpin(key);
      }
    }
  }

  private findCachedWindow(byteOffset: number, requiredBytes = 1) {
    const requiredEnd = Math.min(this.byteLength, byteOffset + Math.max(1, requiredBytes));
    for (const window of this.cache.values()) {
      if (
        window.revision === this.revision &&
        window.startByte <= byteOffset &&
        window.endByte >= requiredEnd
      ) {
        return this.cache.get(cacheKey(window));
      }
    }
    return undefined;
  }

  /** 正式窗口覆盖快速预览后立即移除小窗口，避免同一正文重复占用 LRU。 */
  private removeWindowsContainedBy(container: SegmentedWindow) {
    for (const cached of this.cache.values()) {
      if (
        cached.revision === container.revision &&
        cached.startByte >= container.startByte &&
        cached.endByte <= container.endByte &&
        cacheKey(cached) !== cacheKey(container)
      ) {
        this.cache.delete(cacheKey(cached));
        this.prefetchKeys.delete(cacheKey(cached));
        this.selectionKeys.delete(cacheKey(cached));
      }
    }
  }

  private track<T>(promise: Promise<T>) {
    this.inFlight.add(promise);
    void promise.then(
      () => this.inFlight.delete(promise),
      () => this.inFlight.delete(promise),
    );
  }

  private assertAlive() {
    if (this.destroyed) {
      throw new Error('ViewportController 已销毁');
    }
  }
}

function containsByte(window: SegmentedWindow, byteOffset: number) {
  if (window.startByte === window.endByte) {
    return byteOffset === window.startByte;
  }
  return byteOffset >= window.startByte && byteOffset < window.endByte;
}

function cacheKey(window: SegmentedWindow) {
  return `${window.revision}:${window.startByte}:${window.endByte}`;
}

function clampByte(value: number, byteLength: number) {
  if (!Number.isFinite(value)) {
    throw new RangeError('startByte 必须是有限数值');
  }
  return Math.min(byteLength, Math.max(0, Math.trunc(value)));
}

function normalizeWindowStart(startByte: number, byteLength: number, windowBytes: number) {
  if (byteLength === 0 || startByte < byteLength) return startByte;
  // byteLength 是合法的 EOF 光标位置，但读取必须落到最后一个非空窗口。
  return Math.max(0, byteLength - windowBytes);
}

function sameVisibleWindow(left: SegmentedWindow, right: SegmentedWindow) {
  return (
    left.revision === right.revision &&
    left.startByte === right.startByte &&
    left.endByte === right.endByte &&
    left.startLine === right.startLine &&
    left.text === right.text &&
    left.leadingPartialLine === right.leadingPartialLine &&
    left.trailingPartialLine === right.trailingPartialLine &&
    left.indexProgress === right.indexProgress &&
    (left.utf16ByteOffsets === undefined) === (right.utf16ByteOffsets === undefined) &&
    left.jsonLexicalState === right.jsonLexicalState
  );
}

function assertPositiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} 必须是正安全整数`);
  }
}

function reportViewportError(error: unknown, handler?: (error: unknown) => void) {
  if (handler) {
    handler(error);
    return;
  }
  if (typeof globalThis.reportError === 'function') {
    globalThis.reportError(error);
    return;
  }
  console.error(error);
}
