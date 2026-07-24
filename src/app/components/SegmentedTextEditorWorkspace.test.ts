import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { EditorView } from '@codemirror/view';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { segmentedSessionRegistry } from '../../lib/text-editor/sessionRegistry';
import { SEGMENTED_FULL_WINDOW_BYTES } from '../../lib/text-editor/virtualScroll';
import {
  SegmentedTextEditorCore,
  type SegmentedEditorMetadata,
} from '../../lib/text-editor/SegmentedTextEditorCore';
import type {
  OpenSegmentedDocumentResult,
  ReadSegmentedWindowRequest,
  SegmentedDocumentPort,
  SegmentedIndexProgress,
  SegmentedTaskProgress,
} from '../../lib/text-editor/protocol';
import { createSegmentedTextTab } from '../services/tabs';
import SegmentedTextEditorWorkspace from './SegmentedTextEditorWorkspace.svelte';

const port = vi.hoisted(() => ({
  readWindow: vi.fn(),
  reloadSession: vi.fn(),
  applyEdits: vi.fn(),
  undoRevision: vi.fn(),
  redoRevision: vi.fn(),
  flushJournal: vi.fn(),
  saveRevision: vi.fn(),
  startTask: vi.fn(),
  cancelTask: vi.fn(),
  checkExternalChange: vi.fn(),
  getStatus: vi.fn(),
  closeSession: vi.fn(),
  listenIndexProgress: vi.fn(),
  listenTaskProgress: vi.fn(),
}));

vi.mock('../../lib/text-editor/tauriPort', () => ({
  createTauriSegmentedDocumentPort: () => port as unknown as SegmentedDocumentPort,
}));

const WINDOW_BYTES = SEGMENTED_FULL_WINDOW_BYTES;
let indexProgressHandler: ((progress: SegmentedIndexProgress) => void) | null = null;
let taskProgressHandler: ((progress: SegmentedTaskProgress) => void) | null = null;

beforeEach(() => {
  segmentedSessionRegistry.clear();
  vi.clearAllMocks();
  indexProgressHandler = null;
  taskProgressHandler = null;
  port.readWindow.mockImplementation(async (request: ReadSegmentedWindowRequest) => {
    const session = segmentedSessionRegistry.get(request.sessionId);
    if (!session) throw new Error(`missing session: ${request.sessionId}`);
    const endByte = Math.min(session.byteLength, request.startByte + request.targetBytes);
    return {
      revision: request.revision,
      requestId: request.requestId,
      startByte: request.startByte,
      endByte,
      startLine: 0,
      text: 'x'.repeat(endByte - request.startByte),
      leadingPartialLine: request.startByte > 0,
      trailingPartialLine: endByte < session.byteLength,
      indexProgress: session.byteLength === 0 ? 1 : 1,
    };
  });
  port.applyEdits.mockResolvedValue({
    revision: 2,
    persistedRevision: 1,
    dirty: true,
    invalidatedFromByte: 0,
    invalidatedToByte: 0,
  });
  port.flushJournal.mockImplementation(async (_sessionId: string, revision: number) => ({
    revision,
  }));
  port.getStatus.mockImplementation(async (sessionId: string) => {
    const session = segmentedSessionRegistry.get(sessionId);
    if (!session) throw new Error(`missing session: ${sessionId}`);
    return {
      sessionId,
      revision: session.revision,
      persistedRevision: session.persistedRevision,
      byteLength: session.byteLength,
      indexedBytes: session.byteLength,
      totalBytes: session.byteLength,
      estimatedLines: 1,
      completed: true,
      encoding: session.encoding,
      lineEnding: session.lineEnding,
      readonly: session.readonly,
      canUndo: false,
      canRedo: false,
    };
  });
  port.cancelTask.mockImplementation(async (taskId: string) => ({ taskId, cancelled: true }));
  port.listenIndexProgress.mockImplementation(
    async (_sessionId: string, handler: (progress: SegmentedIndexProgress) => void) => {
      indexProgressHandler = handler;
      return () => undefined;
    },
  );
  port.listenTaskProgress.mockImplementation(
    async (_sessionId: string, handler: (progress: SegmentedTaskProgress) => void) => {
      taskProgressHandler = handler;
      return () => undefined;
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  segmentedSessionRegistry.clear();
});

describe('SegmentedTextEditorWorkspace', () => {
  it('removes completed index progress and does not present a temporary edit lock as a readonly source', async () => {
    const opened = createOpenedSession('utf-8');
    opened.readonly = true;
    opened.filesystemReadonly = false;
    const tab = registerJsonTab(opened);

    render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    await waitFor(() => {
      expect(document.querySelector('[data-segmented-editor="true"]')).toBeTruthy();
    });
    expect(screen.queryByText(/Building line index 100%/i)).toBeNull();
    expect(screen.queryByText(/source file is not writable/i)).toBeNull();
  });

  it('still explains a genuinely readonly source file', async () => {
    const opened = createOpenedSession('utf-8');
    opened.readonly = true;
    opened.filesystemReadonly = true;
    const tab = registerJsonTab(opened);
    tab.diskReadonly = true;

    render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    expect(await screen.findByText(/source file is not writable/i)).toBeTruthy();
  });

  it('mounts JSON through the segmented Core and consumes the bounded first window', async () => {
    const opened = createOpenedSession('utf-8');
    segmentedSessionRegistry.register(opened);
    const tab = createSegmentedTextTab({
      id: 'json-tab',
      documentKind: 'json',
      fileName: 'large.json',
      filePath: '/tmp/large.json',
      nativePath: '/tmp/large.json',
      sessionId: opened.sessionId,
      revision: opened.revision,
      persistedRevision: opened.persistedRevision,
      indexProgress: 1,
    });

    render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    expect(screen.queryByText('Validate JSON')).toBeNull();
    expect(screen.queryByText('Format JSON')).toBeNull();
    await waitFor(() => {
      expect(document.querySelector('[data-segmented-editor="true"]')).toBeTruthy();
    });
    expect(segmentedSessionRegistry.consumeFirstWindow(opened.sessionId)).toBeUndefined();
  });

  it('expands the backend 256 KiB probe into the 512 KiB editing window on mount', async () => {
    const opened = createLongSingleLineSession();
    const backendProbeBytes = 256 * 1024;
    opened.firstWindow = {
      ...opened.firstWindow,
      endByte: backendProbeBytes,
      text: 'x'.repeat(backendProbeBytes),
    };
    const tab = registerTextTab(opened);

    render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    await waitFor(() => {
      expect(port.readWindow).toHaveBeenCalledWith(
        expect.objectContaining({ startByte: 0, targetBytes: WINDOW_BYTES }),
      );
      expect(document.querySelector('[data-segmented-editor="true"]')).toBeTruthy();
    });
  });

  it('keeps unsupported encoding read-only and explains the boundary', async () => {
    const opened = createOpenedSession('unsupported');
    segmentedSessionRegistry.register(opened);
    const tab = createSegmentedTextTab({
      documentKind: 'json',
      fileName: 'legacy.json',
      filePath: '/tmp/legacy.json',
      nativePath: '/tmp/legacy.json',
      sessionId: opened.sessionId,
      revision: 1,
      persistedRevision: 1,
      indexProgress: 1,
      diskReadonly: true,
    });

    render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    expect(await screen.findByText(/not UTF-8/i)).toBeTruthy();
    await fireEvent.keyDown(screen.getByRole('application'), {
      key: 'F',
      altKey: true,
      shiftKey: true,
    });
    expect(port.startTask).not.toHaveBeenCalled();
  });

  it('moves forward through a long single line with the byte-segment keyboard shortcut', async () => {
    const opened = createLongSingleLineSession();
    const tab = registerTextTab(opened);
    const stateChanges: SegmentedEditorMetadata[] = [];

    render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
      events: {
        stateChange: (event: CustomEvent<SegmentedEditorMetadata>) => {
          stateChanges.push(event.detail);
        },
      },
    });

    const workspace = await screen.findByRole('application');
    await fireEvent.keyDown(workspace, { key: 'PageDown', altKey: true });
    await waitFor(() => {
      expect(port.readWindow).toHaveBeenCalledWith(
        expect.objectContaining({ startByte: WINDOW_BYTES, targetBytes: WINDOW_BYTES }),
      );
      expect(stateChanges.some((state) => state.scrollAnchor?.byteOffset === WINDOW_BYTES)).toBe(
        true,
      );
    });
  });

  it('restores an EOF anchor from the final non-empty window', async () => {
    const opened = createLongSingleLineSession();
    segmentedSessionRegistry.register(opened);
    segmentedSessionRegistry.consumeFirstWindow(opened.sessionId);
    const tab = createSegmentedTextTab({
      documentKind: 'text',
      fileName: 'long.txt',
      filePath: '/tmp/long.txt',
      nativePath: '/tmp/long.txt',
      sessionId: opened.sessionId,
      revision: opened.revision,
      persistedRevision: opened.persistedRevision,
      indexProgress: 1,
      scrollAnchor: { byteOffset: opened.byteLength, line: 0 },
    });

    render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    await waitFor(() => {
      expect(port.readWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          startByte: opened.byteLength - WINDOW_BYTES,
          targetBytes: WINDOW_BYTES,
        }),
      );
    });
    expect(port.readWindow).not.toHaveBeenCalledWith(
      expect.objectContaining({ startByte: opened.byteLength }),
    );
  });

  it('keeps the fixed virtual runway stable while line-index estimates change', async () => {
    const opened = createLongSingleLineSession(0.25);
    const tab = registerTextTab(opened);
    render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    await waitFor(() => expect(indexProgressHandler).not.toBeNull());
    const runway = screen.getByTestId('segmented-scroll-runway');
    const initialHeight = runway.getAttribute('style');
    indexProgressHandler?.({
      sessionId: opened.sessionId,
      revision: opened.revision,
      indexedBytes: opened.byteLength / 2,
      totalBytes: opened.byteLength,
      estimatedLines: 10_000_000,
      completed: false,
    });
    await tick();

    expect(runway.getAttribute('style')).toBe(initialHeight);
  });

  it('uses a small read-only preview for a fast jump, then expands to the full window', async () => {
    const opened = createLongSingleLineSession();
    const tab = registerTextTab(opened);
    render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    const content = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[data-segmented-editor="true"]');
      expect(element).not.toBeNull();
      return element!;
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    port.readWindow.mockClear();

    const scroller = document.querySelector<HTMLElement>('.segmented-scroll')!;
    scroller.scrollTop = 1_000_000;
    await fireEvent.scroll(scroller);

    await waitFor(() => {
      const previewCall = port.readWindow.mock.calls.find(
        ([request]) => request.targetBytes >= 16 * 1024 && request.targetBytes <= 64 * 1024,
      );
      expect(previewCall).toBeTruthy();
      expect(content.getAttribute('contenteditable')).toBe('false');
    });
    await waitFor(
      () => {
        const requests = port.readWindow.mock.calls.map(([request]) => request);
        expect(requests.some((request) => request.targetBytes === WINDOW_BYTES)).toBe(true);
        expect(content.getAttribute('contenteditable')).toBe('true');
      },
      { timeout: 2_000 },
    );
  });

  it('replays a completed task that arrives before start returns', async () => {
    const opened = createLongSingleLineSession();
    const tab = registerTextTab(opened);
    const start = deferred<{ taskId: string }>();
    const stateChanges: SegmentedEditorMetadata[] = [];
    port.startTask.mockReturnValueOnce(start.promise);
    const rendered = render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
      events: {
        stateChange: (event: CustomEvent<SegmentedEditorMetadata>) => {
          stateChanges.push(event.detail);
        },
      },
    });

    await openSearchAndSubmit(rendered.component, 'needle');
    await waitFor(() => expect(port.startTask).toHaveBeenCalledTimes(1));
    taskProgressHandler?.(
      createTaskProgress('task-fast', 'completed', {
        currentMatch: { startByte: WINDOW_BYTES + 10, endByte: WINDOW_BYTES + 16 },
        matchCount: 1,
      }),
    );
    start.resolve({ taskId: 'task-fast' });

    await waitFor(() => {
      expect(port.readWindow).toHaveBeenCalledWith(
        expect.objectContaining({ startByte: WINDOW_BYTES + 10 }),
      );
      expect(
        stateChanges.some(
          (state) =>
            state.selection?.anchorByte === WINDOW_BYTES + 10 &&
            state.selection.headByte === WINDOW_BYTES + 16,
        ),
      ).toBe(true);
    });
  });

  it('preserves an empty replace-all replacement as an explicit deletion', async () => {
    const opened = createLongSingleLineSession();
    const tab = registerTextTab(opened);
    port.startTask.mockResolvedValueOnce({ taskId: 'task-delete-all' });
    const rendered = render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    rendered.component.openSearch(true);
    const queryInput = await screen.findByRole('textbox', {
      name: /Search in .*document/i,
    });
    await fireEvent.input(queryInput, { target: { value: 'needle' } });
    expect(screen.getByRole('textbox', { name: /Replace with/i })).toHaveProperty('value', '');
    await fireEvent.click(screen.getByRole('button', { name: /Replace all/i }));

    await waitFor(() => {
      expect(port.startTask).toHaveBeenCalledWith(
        expect.objectContaining({
          task: { type: 'replace-all', query: 'needle', replacement: '' },
        }),
      );
    });
  });

  it('routes keyboard and DOM full-copy through the cancellable workspace task lifecycle', async () => {
    const opened = createLongSingleLineSession();
    const tab = registerTextTab(opened);
    port.startTask.mockResolvedValue({ taskId: 'task-copy' });
    render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    const workspace = await screen.findByRole('application');
    await fireEvent.keyDown(workspace, { key: 'a', metaKey: true });
    await fireEvent.keyDown(workspace, { key: 'c', metaKey: true });

    await waitFor(() => {
      expect(port.startTask).toHaveBeenCalledWith(
        expect.objectContaining({ task: { type: 'select-all-copy' } }),
      );
    });

    taskProgressHandler?.(
      createTaskProgress('task-copy', 'completed', {
        kind: 'select-all-copy',
        outputPath: '/tmp/nomo-copy-fallback.txt',
        message: 'Clipboard unavailable, wrote a temporary file',
      }),
    );
    expect(await screen.findByText(/\/tmp\/nomo-copy-fallback\.txt/)).toBeTruthy();
  });

  it('waits for the old terminal event and ignores its late duplicate after starting a new task', async () => {
    const opened = createLongSingleLineSession();
    const tab = registerTextTab(opened);
    port.startTask
      .mockResolvedValueOnce({ taskId: 'task-old' })
      .mockResolvedValueOnce({ taskId: 'task-new' });
    const rendered = render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    await openSearchAndSubmit(rendered.component, 'first');
    await waitFor(() => expect(port.startTask).toHaveBeenCalledTimes(1));
    await openSearchAndSubmit(rendered.component, 'second');
    await waitFor(() => expect(port.cancelTask).toHaveBeenCalledWith('task-old'));
    expect(port.startTask).toHaveBeenCalledTimes(1);

    taskProgressHandler?.(createTaskProgress('task-old', 'cancelled'));
    await waitFor(() => expect(port.startTask).toHaveBeenCalledTimes(2));
    taskProgressHandler?.(createTaskProgress('task-new', 'running', { matchCount: 3 }));
    taskProgressHandler?.(createTaskProgress('task-old', 'completed', { matchCount: 99 }));

    await waitFor(() => expect(screen.getByText('3', { selector: '.match-count' })).toBeTruthy());
  });

  it('does not navigate stale search results after the Core revision advances', async () => {
    const opened = createLongSingleLineSession();
    const tab = registerTextTab(opened);
    port.startTask.mockResolvedValueOnce({ taskId: 'task-search' });
    port.undoRevision.mockResolvedValueOnce({
      changed: true,
      revision: 2,
      persistedRevision: 1,
      byteLength: opened.byteLength,
      dirty: true,
      canUndo: false,
      canRedo: true,
    });
    const rendered = render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    await openSearchAndSubmit(rendered.component, 'needle');
    await waitFor(() => expect(port.startTask).toHaveBeenCalledTimes(1));
    taskProgressHandler?.(
      createTaskProgress('task-search', 'running', {
        nearbyMatches: [{ startByte: WINDOW_BYTES + 30, endByte: WINDOW_BYTES + 36 }],
        matchCount: 1,
      }),
    );
    await rendered.component.undo();
    await waitFor(() => expect(port.undoRevision).toHaveBeenCalled());
    port.readWindow.mockClear();

    taskProgressHandler?.(
      createTaskProgress('task-search', 'completed', {
        currentMatch: { startByte: WINDOW_BYTES + 20, endByte: WINDOW_BYTES + 26 },
        matchCount: 1,
      }),
    );
    await waitFor(() => expect(screen.getByText('0', { selector: '.match-count' })).toBeTruthy());
    await fireEvent.click(screen.getByRole('button', { name: /Next match/i }));
    expect(port.readWindow).not.toHaveBeenCalledWith(
      expect.objectContaining({ startByte: expect.any(Number) }),
    );
  });

  it('requests the next bounded search page instead of wrapping within nearby matches', async () => {
    const opened = createLongSingleLineSession();
    const tab = registerTextTab(opened);
    port.startTask
      .mockResolvedValueOnce({ taskId: 'task-page-1' })
      .mockResolvedValueOnce({ taskId: 'task-page-2' });
    const stateChanges: SegmentedEditorMetadata[] = [];
    const rendered = render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
      events: {
        stateChange: (event: CustomEvent<SegmentedEditorMetadata>) => {
          stateChanges.push(event.detail);
        },
      },
    });

    await openSearchAndSubmit(rendered.component, 'needle');
    await waitFor(() => expect(port.startTask).toHaveBeenCalledTimes(1));
    taskProgressHandler?.(
      createTaskProgress('task-page-1', 'completed', {
        nearbyMatches: [{ startByte: 10, endByte: 16 }],
        currentMatch: { startByte: 10, endByte: 16 },
        matchCount: 41,
      }),
    );
    await waitFor(() =>
      expect(
        stateChanges.some(
          (state) => state.selection?.anchorByte === 10 && state.selection.headByte === 16,
        ),
      ).toBe(true),
    );
    port.readWindow.mockClear();

    await fireEvent.click(screen.getByRole('button', { name: /Next match/i }));
    await waitFor(() => {
      expect(port.startTask).toHaveBeenLastCalledWith(
        expect.objectContaining({
          task: {
            type: 'search',
            query: 'needle',
            anchorByte: 10,
            direction: 'forward',
          },
        }),
      );
    });
    await waitFor(() => expect(screen.getByText('0', { selector: '.match-count' })).toBeTruthy());
    taskProgressHandler?.(
      createTaskProgress('task-page-2', 'completed', {
        nearbyMatches: [{ startByte: 20, endByte: 26 }],
        currentMatch: { startByte: 20, endByte: 26 },
        matchCount: 41,
      }),
    );
    await waitFor(() =>
      expect(
        stateChanges.some(
          (state) => state.selection?.anchorByte === 20 && state.selection.headByte === 26,
        ),
      ).toBe(true),
    );
  });

  it('queues the latest full-document request until indexing completes', async () => {
    const opened = createLongSingleLineSession(0.5);
    const tab = registerTextTab(opened);
    port.getStatus.mockResolvedValue({
      sessionId: opened.sessionId,
      revision: 1,
      persistedRevision: 1,
      byteLength: opened.byteLength,
      indexedBytes: opened.byteLength / 2,
      totalBytes: opened.byteLength,
      estimatedLines: 1,
      completed: false,
      encoding: 'utf-8',
      lineEnding: 'lf',
      readonly: false,
      canUndo: false,
      canRedo: false,
    });
    port.startTask.mockResolvedValue({ taskId: 'task-after-index' });
    const rendered = render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    await openSearchAndSubmit(rendered.component, 'first');
    await openSearchAndSubmit(rendered.component, 'latest');
    expect(port.startTask).not.toHaveBeenCalled();
    expect(screen.getByText(/available after the full index/i)).toBeTruthy();

    indexProgressHandler?.({
      sessionId: opened.sessionId,
      revision: 1,
      indexedBytes: opened.byteLength,
      totalBytes: opened.byteLength,
      estimatedLines: 1,
      completed: true,
    });
    await waitFor(() => {
      expect(port.startTask).toHaveBeenCalledWith(
        expect.objectContaining({ task: expect.objectContaining({ query: 'latest' }) }),
      );
    });
  });

  it('cancels a task queued behind an incomplete index', async () => {
    const opened = createLongSingleLineSession(0.5);
    const tab = registerTextTab(opened);
    port.getStatus.mockResolvedValue({
      sessionId: opened.sessionId,
      revision: 1,
      persistedRevision: 1,
      byteLength: opened.byteLength,
      indexedBytes: opened.byteLength / 2,
      totalBytes: opened.byteLength,
      estimatedLines: 1,
      completed: false,
      encoding: 'utf-8',
      lineEnding: 'lf',
      readonly: false,
      canUndo: false,
      canRedo: false,
    });
    const rendered = render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    await openSearchAndSubmit(rendered.component, 'cancel-me');
    const cancel = await screen.findByRole('button', { name: /Cancel task/i });
    await fireEvent.click(cancel);
    indexProgressHandler?.({
      sessionId: opened.sessionId,
      revision: 1,
      indexedBytes: opened.byteLength,
      totalBytes: opened.byteLength,
      estimatedLines: 1,
      completed: true,
    });

    await waitFor(() => expect(screen.queryByText(/available after the full index/i)).toBeNull());
    expect(port.startTask).not.toHaveBeenCalled();
  });

  it('locks the Core before a write-task flush and releases it only after terminal progress', async () => {
    const opened = createOpenedSession('utf-8');
    const tab = registerJsonTab(opened);
    const lockSpy = vi.spyOn(SegmentedTextEditorCore.prototype, 'setExclusiveTaskLocked');
    const flushSpy = vi.spyOn(SegmentedTextEditorCore.prototype, 'flush');
    port.startTask.mockResolvedValueOnce({ taskId: 'task-format' });

    render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    await fireEvent.keyDown(await screen.findByRole('application'), {
      key: 'F',
      altKey: true,
      shiftKey: true,
    });
    await waitFor(() => expect(port.startTask).toHaveBeenCalledTimes(1));

    expect(lockSpy).toHaveBeenCalledWith(true);
    expect(lockSpy.mock.invocationCallOrder[0]).toBeLessThan(flushSpy.mock.invocationCallOrder[0]);
    expect(lockSpy).not.toHaveBeenCalledWith(false);

    taskProgressHandler?.(
      createTaskProgress('task-format', 'completed', {
        sessionId: opened.sessionId,
        baseRevision: opened.revision,
        kind: 'json-format',
        resultRevision: opened.revision + 1,
        resultByteLength: opened.byteLength,
      }),
    );
    await waitFor(() => expect(lockSpy).toHaveBeenLastCalledWith(false));
  });

  it('releases a write-task lock when start fails and when an active workspace is destroyed', async () => {
    const opened = createOpenedSession('utf-8');
    const tab = registerJsonTab(opened);
    const lockSpy = vi.spyOn(SegmentedTextEditorCore.prototype, 'setExclusiveTaskLocked');
    port.startTask.mockRejectedValueOnce(new Error('start failed'));

    const failed = render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });
    await fireEvent.keyDown(await screen.findByRole('application'), {
      key: 'F',
      altKey: true,
      shiftKey: true,
    });
    await waitFor(() => expect(screen.getByText('start failed')).toBeTruthy());
    expect(lockSpy).toHaveBeenLastCalledWith(false);
    failed.unmount();

    vi.clearAllMocks();
    const secondOpened = { ...createOpenedSession('utf-8'), sessionId: 'session-destroy-lock' };
    const secondTab = registerJsonTab(secondOpened);
    port.startTask.mockResolvedValueOnce({ taskId: 'task-destroyed' });
    const active = render(SegmentedTextEditorWorkspace, {
      props: {
        interfaceLocale: 'en-US',
        tab: secondTab,
        autoSaveEnabled: false,
        autoSaveDelayMs: 500,
      },
    });
    await fireEvent.keyDown(await screen.findByRole('application'), {
      key: 'F',
      altKey: true,
      shiftKey: true,
    });
    await waitFor(() => expect(lockSpy).toHaveBeenLastCalledWith(true));

    active.unmount();
    expect(lockSpy).toHaveBeenLastCalledWith(false);
  });

  it('does not lock the Core for read-only search tasks', async () => {
    const opened = createLongSingleLineSession();
    const tab = registerTextTab(opened);
    const lockSpy = vi.spyOn(SegmentedTextEditorCore.prototype, 'setExclusiveTaskLocked');
    port.startTask.mockResolvedValueOnce({ taskId: 'task-read' });
    const rendered = render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: false, autoSaveDelayMs: 500 },
    });

    await openSearchAndSubmit(rendered.component, 'needle');
    await waitFor(() => expect(port.startTask).toHaveBeenCalledTimes(1));

    expect(lockSpy).not.toHaveBeenCalledWith(true);
  });

  it('auto-save bypasses journal flush and allows a later edit to advance while save is pending', async () => {
    const opened = { ...createOpenedSession('utf-8'), persistedRevision: 0 };
    const tab = registerJsonTab(opened);
    const save = deferred<Awaited<ReturnType<SegmentedDocumentPort['saveRevision']>>>();
    const journal = deferred<Awaited<ReturnType<SegmentedDocumentPort['flushJournal']>>>();
    const stateChanges: SegmentedEditorMetadata[] = [];
    port.flushJournal.mockReturnValue(journal.promise);
    port.saveRevision.mockReturnValueOnce(save.promise);
    const rendered = render(SegmentedTextEditorWorkspace, {
      props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: true, autoSaveDelayMs: 0 },
      events: {
        stateChange: (event: CustomEvent<SegmentedEditorMetadata>) => {
          stateChanges.push(event.detail);
        },
      },
    });

    await waitFor(() => expect(port.saveRevision).toHaveBeenCalledTimes(1));
    expect(port.flushJournal).not.toHaveBeenCalled();

    const editor = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement);
    if (!editor) throw new Error('Expected mounted CodeMirror view');
    editor.dispatch({ changes: { from: editor.state.doc.length, insert: '!' } });
    expect(rendered.component.hasPendingEdits()).toBe(true);

    const prepared = await rendered.component.prepareSave();
    expect(prepared).toMatchObject({ revision: 2, persistedRevision: 1 });
    expect(rendered.component.hasPendingEdits()).toBe(false);
    expect(port.applyEdits).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: opened.sessionId, baseRevision: 1 }),
    );
    expect(port.flushJournal).not.toHaveBeenCalled();

    save.resolve({
      sessionId: opened.sessionId,
      savedRevision: 1,
      currentRevision: 2,
      persistedRevision: 1,
      dirty: true,
      readonly: false,
      modifiedAt: 10,
    });
    await waitFor(() => {
      expect(stateChanges.at(-1)).toMatchObject({ revision: 2, persistedRevision: 1, dirty: true });
    });
    journal.resolve({ revision: 2 });
  });

  it('cancels a queued auto-save when the preference is disabled before the timer fires', async () => {
    vi.useFakeTimers();
    try {
      const opened = { ...createOpenedSession('utf-8'), persistedRevision: 0 };
      const tab = registerJsonTab(opened);
      const rendered = render(SegmentedTextEditorWorkspace, {
        props: { interfaceLocale: 'en-US', tab, autoSaveEnabled: true, autoSaveDelayMs: 1000 },
      });

      // onMount/ready 经微任务发布 dirty 元数据并建立 timer，再模拟用户关闭自动保存。
      await vi.advanceTimersByTimeAsync(0);
      await tick();
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      // 即使底层 timer 已进入队列、clearTimeout 来不及撤回，执行入口也必须再次检查设置。
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {});
      await rendered.rerender({
        interfaceLocale: 'en-US',
        tab,
        autoSaveEnabled: false,
        autoSaveDelayMs: 1000,
      });
      await tick();
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
      await vi.advanceTimersByTimeAsync(1500);

      expect(port.saveRevision).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

function createOpenedSession(
  encoding: OpenSegmentedDocumentResult['encoding'],
): OpenSegmentedDocumentResult {
  const text = '{"name":"Nomo"}\n';
  const byteLength = new TextEncoder().encode(text).byteLength;
  return {
    sessionId: `session-${encoding}`,
    revision: 1,
    persistedRevision: 1,
    documentKind: 'json',
    encoding,
    lineEnding: 'lf',
    byteLength,
    readonly: encoding === 'unsupported',
    firstWindow: {
      revision: 1,
      startByte: 0,
      endByte: byteLength,
      startLine: 0,
      text,
      leadingPartialLine: false,
      trailingPartialLine: false,
      indexProgress: 1,
    },
  };
}

function createLongSingleLineSession(indexProgress = 1): OpenSegmentedDocumentResult {
  return {
    sessionId: 'session-long-line',
    revision: 1,
    persistedRevision: 1,
    documentKind: 'text',
    encoding: 'utf-8',
    lineEnding: 'lf',
    byteLength: WINDOW_BYTES * 2,
    readonly: false,
    firstWindow: {
      revision: 1,
      startByte: 0,
      endByte: WINDOW_BYTES,
      startLine: 0,
      text: 'x'.repeat(WINDOW_BYTES),
      leadingPartialLine: false,
      trailingPartialLine: true,
      indexProgress,
    },
  };
}

function registerTextTab(opened: OpenSegmentedDocumentResult) {
  segmentedSessionRegistry.register(opened);
  return createSegmentedTextTab({
    documentKind: 'text',
    fileName: 'long.txt',
    filePath: '/tmp/long.txt',
    nativePath: '/tmp/long.txt',
    sessionId: opened.sessionId,
    revision: opened.revision,
    persistedRevision: opened.persistedRevision,
    indexProgress: opened.firstWindow.indexProgress,
  });
}

function registerJsonTab(opened: OpenSegmentedDocumentResult) {
  segmentedSessionRegistry.register(opened);
  return createSegmentedTextTab({
    documentKind: 'json',
    fileName: 'large.json',
    filePath: '/tmp/large.json',
    nativePath: '/tmp/large.json',
    sessionId: opened.sessionId,
    revision: opened.revision,
    persistedRevision: opened.persistedRevision,
    indexProgress: opened.firstWindow.indexProgress,
  });
}

async function openSearchAndSubmit(
  component: { openSearch(showReplace?: boolean): void },
  query: string,
) {
  component.openSearch(false);
  const input = await screen.findByRole('textbox', { name: /Search in .*document/i });
  await fireEvent.input(input, { target: { value: query } });
  await fireEvent.submit(input.closest('form')!);
}

function createTaskProgress(
  taskId: string,
  state: SegmentedTaskProgress['state'],
  overrides: Partial<SegmentedTaskProgress> = {},
): SegmentedTaskProgress {
  return {
    sessionId: 'session-long-line',
    taskId,
    baseRevision: 1,
    kind: 'search',
    state,
    processedBytes: WINDOW_BYTES * 2,
    totalBytes: WINDOW_BYTES * 2,
    matchCount: 0,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
