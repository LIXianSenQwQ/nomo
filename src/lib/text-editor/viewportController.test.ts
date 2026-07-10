import { describe, expect, it, vi } from 'vitest';
import type {
  ReadSegmentedWindowRequest,
  SegmentedDocumentPort,
  SegmentedWindow,
} from './protocol';
import { ViewportController } from './viewportController';

function createWindow(request: ReadSegmentedWindowRequest): SegmentedWindow {
  const endByte = Math.min(200, request.startByte + request.targetBytes);
  return {
    revision: request.revision,
    requestId: request.requestId,
    startByte: request.startByte,
    endByte,
    startLine: request.startByte,
    text: 'x'.repeat(endByte - request.startByte),
    leadingPartialLine: request.startByte > 0,
    trailingPartialLine: endByte < 200,
    indexProgress: 1,
  };
}

function createPort(
  readWindow: SegmentedDocumentPort['readWindow'],
): Pick<SegmentedDocumentPort, 'readWindow'> {
  return { readWindow };
}

describe('ViewportController', () => {
  it('normalizes an EOF byte offset to the final non-empty window', async () => {
    const readWindow = vi.fn(async (request: ReadSegmentedWindowRequest) => createWindow(request));
    const controller = new ViewportController({
      sessionId: 'session-1',
      revision: 0,
      byteLength: 200,
      port: createPort(readWindow),
      windowBytes: 10,
      cacheCapacityBytes: 40,
      prefetch: false,
    });

    const result = await controller.loadWindow(200);

    expect(result.status).toBe('applied');
    expect(readWindow).toHaveBeenCalledWith(
      expect.objectContaining({ startByte: 190, targetBytes: 10 }),
    );
    expect(result.window).toMatchObject({ startByte: 190, endByte: 200 });
    expect(result.window?.text).toHaveLength(10);
  });

  it('does not notify the same visible cached window twice', async () => {
    const readWindow = vi.fn(async (request: ReadSegmentedWindowRequest) => createWindow(request));
    const onWindow = vi.fn();
    const controller = new ViewportController({
      sessionId: 'session-1',
      revision: 0,
      byteLength: 200,
      port: createPort(readWindow),
      windowBytes: 10,
      cacheCapacityBytes: 40,
      prefetch: false,
      onWindow,
    });

    expect((await controller.loadWindow(50)).status).toBe('applied');
    expect((await controller.loadWindow(50)).status).toBe('cached');

    expect(readWindow).toHaveBeenCalledTimes(1);
    expect(onWindow).toHaveBeenCalledTimes(1);
  });

  it('drops an out-of-order primary response using requestId and revision', async () => {
    const resolvers = new Map<number, (window: SegmentedWindow) => void>();
    const requests = new Map<number, ReadSegmentedWindowRequest>();
    const readWindow = vi.fn(
      (request: ReadSegmentedWindowRequest) =>
        new Promise<SegmentedWindow>((resolve) => {
          requests.set(request.requestId, request);
          resolvers.set(request.requestId, resolve);
        }),
    );
    const controller = new ViewportController({
      sessionId: 'session-1',
      revision: 3,
      byteLength: 200,
      port: createPort(readWindow),
      windowBytes: 10,
      cacheCapacityBytes: 40,
      prefetch: false,
    });

    const first = controller.loadWindow(0);
    const second = controller.loadWindow(100);
    resolvers.get(2)?.(createWindow(requests.get(2)!));
    expect((await second).status).toBe('applied');
    resolvers.get(1)?.(createWindow(requests.get(1)!));

    expect((await first).status).toBe('stale');
    expect(controller.getCurrentWindow()?.startByte).toBe(100);
  });

  it('prefetches adjacent windows without replacing the visible window', async () => {
    const readWindow = vi.fn(async (request: ReadSegmentedWindowRequest) => createWindow(request));
    const controller = new ViewportController({
      sessionId: 'session-1',
      revision: 0,
      byteLength: 200,
      port: createPort(readWindow),
      windowBytes: 10,
      cacheCapacityBytes: 40,
    });

    await controller.loadWindow(50);
    await controller.waitForIdle();

    expect(controller.getCurrentWindow()?.startByte).toBe(50);
    expect(controller.hasCachedWindowAt(45)).toBe(true);
    expect(controller.hasCachedWindowAt(65)).toBe(true);
  });

  it('invalidates pending reads when the document revision changes', async () => {
    let resolveRead: ((window: SegmentedWindow) => void) | undefined;
    let capturedRequest: ReadSegmentedWindowRequest | undefined;
    const controller = new ViewportController({
      sessionId: 'session-1',
      revision: 0,
      byteLength: 200,
      port: createPort((request) => {
        capturedRequest = request;
        return new Promise((resolve) => {
          resolveRead = resolve;
        });
      }),
      windowBytes: 10,
      cacheCapacityBytes: 40,
      prefetch: false,
    });

    const pending = controller.loadWindow(10);
    controller.setRevision(1);
    resolveRead?.(createWindow(capturedRequest!));

    expect((await pending).status).toBe('stale');
    expect(controller.getCurrentWindow()).toBeUndefined();
  });

  it('invalidates cached and pending windows without changing revision', async () => {
    const pendingReads: Array<{
      request: ReadSegmentedWindowRequest;
      resolve: (window: SegmentedWindow) => void;
    }> = [];
    const readWindow = vi.fn(
      (request: ReadSegmentedWindowRequest) =>
        new Promise<SegmentedWindow>((resolve) => pendingReads.push({ request, resolve })),
    );
    const controller = new ViewportController({
      sessionId: 'session-1',
      revision: 0,
      byteLength: 200,
      port: createPort(readWindow),
      windowBytes: 10,
      cacheCapacityBytes: 40,
      prefetch: false,
    });
    controller.seedWindow(
      createWindow({
        sessionId: 'session-1',
        revision: 0,
        startByte: 0,
        targetBytes: 10,
        requestId: 0,
      }),
    );

    const oldRead = controller.loadWindow(20);
    controller.invalidateCurrentRevisionCache();
    const exactRead = controller.loadWindow(0);
    expect(readWindow).toHaveBeenCalledTimes(2);

    pendingReads[0].resolve(createWindow(pendingReads[0].request));
    expect((await oldRead).status).toBe('stale');
    pendingReads[1].resolve(createWindow(pendingReads[1].request));
    expect((await exactRead).status).toBe('applied');
    expect(controller.getRevision()).toBe(0);
  });

  it('charges lossy UTF-16 offset arrays against the viewport LRU budget', async () => {
    const readWindow = vi.fn(async (request: ReadSegmentedWindowRequest) => {
      const window = createWindow(request);
      return {
        ...window,
        utf16ByteOffsets: Array.from(
          { length: window.endByte - window.startByte + 1 },
          (_, index) => index,
        ),
      };
    });
    const controller = new ViewportController({
      sessionId: 'session-1',
      revision: 0,
      byteLength: 200,
      port: createPort(readWindow),
      windowBytes: 10,
      // 每个窗口约 130 bytes（正文 + number[]）；预算只允许保留一个。
      cacheCapacityBytes: 200,
      prefetch: false,
    });

    await controller.loadWindow(0);
    await controller.loadWindow(10);

    expect(controller.hasCachedWindowAt(0)).toBe(false);
    expect(controller.hasCachedWindowAt(10)).toBe(true);
  });

  it('drops a late prefetch that no longer belongs to the visible viewport', async () => {
    let resolveOldPrefetch: ((window: SegmentedWindow) => void) | undefined;
    let oldPrefetchRequest: ReadSegmentedWindowRequest | undefined;
    const readWindow = vi.fn((request: ReadSegmentedWindowRequest) => {
      if (request.startByte === 10) {
        oldPrefetchRequest = request;
        return new Promise<SegmentedWindow>((resolve) => {
          resolveOldPrefetch = resolve;
        });
      }
      return Promise.resolve(createWindow(request));
    });
    const controller = new ViewportController({
      sessionId: 'session-1',
      revision: 0,
      byteLength: 200,
      port: createPort(readWindow),
      windowBytes: 10,
      cacheCapacityBytes: 40,
    });
    controller.seedWindow(
      createWindow({
        sessionId: 'session-1',
        revision: 0,
        startByte: 0,
        targetBytes: 10,
        requestId: 0,
      }),
    );

    await controller.loadWindow(0);
    await controller.loadWindow(50);
    resolveOldPrefetch?.(createWindow(oldPrefetchRequest!));
    await controller.waitForIdle();

    expect(controller.getCurrentWindow()?.startByte).toBe(50);
    expect(controller.hasCachedWindowAt(10)).toBe(false);
  });
});
