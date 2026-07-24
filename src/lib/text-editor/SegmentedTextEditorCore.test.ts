import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@codemirror/view';
import type {
  ApplySegmentedEditsResult,
  OpenSegmentedDocumentResult,
  ReadSegmentedWindowRequest,
  SegmentedDocumentPort,
  SegmentedIndexProgress,
  SegmentedSessionStatus,
  SegmentedWindow,
} from './protocol';
import { SegmentedTextEditorCore } from './SegmentedTextEditorCore';

function createOpenResult(indexProgress = 0.5): OpenSegmentedDocumentResult {
  return {
    sessionId: 'session-1',
    revision: 0,
    persistedRevision: 0,
    documentKind: 'json',
    encoding: 'utf-8',
    lineEnding: 'lf',
    byteLength: 20,
    readonly: false,
    firstWindow: { ...createWindow(0, 0, 'first'), indexProgress },
  };
}

function createWindow(revision: number, startByte: number, text: string): SegmentedWindow {
  return {
    revision,
    startByte,
    endByte: startByte + new TextEncoder().encode(text).byteLength,
    startLine: startByte,
    text,
    leadingPartialLine: startByte > 0,
    trailingPartialLine: true,
    indexProgress: 0.5,
  };
}

function createPort(readWindow?: SegmentedDocumentPort['readWindow']): SegmentedDocumentPort {
  return {
    open: vi.fn(),
    reloadSession: vi.fn(),
    readWindow:
      readWindow ??
      vi.fn(async (request) => createWindow(request.revision, request.startByte, 'next')),
    applyEdits: vi.fn(),
    undoRevision: vi.fn(async (_sessionId, baseRevision) => ({
      changed: false,
      revision: baseRevision,
      persistedRevision: 0,
      byteLength: 20,
      dirty: baseRevision !== 0,
      canUndo: false,
      canRedo: false,
    })),
    redoRevision: vi.fn(async (_sessionId, baseRevision) => ({
      changed: false,
      revision: baseRevision,
      persistedRevision: 0,
      byteLength: 20,
      dirty: baseRevision !== 0,
      canUndo: false,
      canRedo: false,
    })),
    flushJournal: vi.fn(async (_sessionId, revision) => ({ revision })),
    saveRevision: vi.fn(),
    startTask: vi.fn(async () => ({ taskId: 'task-1' })),
    cancelTask: vi.fn(),
    checkExternalChange: vi.fn(),
    getStatus: vi.fn(async () => ({
      sessionId: 'session-1',
      revision: 0,
      persistedRevision: 0,
      byteLength: 20,
      indexedBytes: 10,
      totalBytes: 20,
      estimatedLines: 1,
      completed: false,
      encoding: 'utf-8',
      lineEnding: 'lf',
      readonly: false,
      canUndo: false,
      canRedo: false,
    })),
    closeSession: vi.fn(),
    listenIndexProgress: vi.fn(async () => () => undefined),
    listenTaskProgress: vi.fn(async () => () => undefined),
  } as SegmentedDocumentPort;
}

function editorText(host: HTMLElement) {
  return host.querySelector('.cm-content')?.textContent ?? '';
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

afterEach(() => {
  document.body.innerHTML = '';
});

describe('SegmentedTextEditorCore', () => {
  it('mounts real CodeMirror with only the current window and replaces it on loadWindow', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port: createPort(),
      prefetch: false,
    });

    expect(host.querySelector('.cm-editor')).not.toBeNull();
    expect(editorText(host)).toContain('first');
    await core.loadWindow(10);

    expect(editorText(host)).toContain('next');
    expect(editorText(host)).not.toContain('first');
    await core.destroy();
  });

  it('disables JSON highlighting for a nonzero window whose lexical checkpoint is unknown', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const session = createOpenResult(1);
    session.byteLength = 32;
    session.firstWindow = createWindow(0, 12, 'tail", "value": true}');
    const core = new SegmentedTextEditorCore({
      host,
      session,
      port: createPort(),
      prefetch: false,
    });

    expect(host.querySelector('[class*="cm-segmented-json-"]')).toBeNull();
    await core.destroy();
  });

  it('uses the default JSON lexical state only at byte zero', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const session = createOpenResult(1);
    session.firstWindow = createWindow(0, 0, '{"value": true}');
    const core = new SegmentedTextEditorCore({
      host,
      session,
      port: createPort(),
      prefetch: false,
    });

    expect(host.querySelector('.cm-segmented-json-string')).not.toBeNull();
    expect(host.querySelector('.cm-segmented-json-boolean')).not.toBeNull();
    await core.destroy();
  });

  it('keeps wrapping and JSON highlighting disabled for a short tail window of a long line', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const session = createOpenResult(1);
    session.byteLength = 300_000;
    session.firstWindow = {
      ...createWindow(0, 290_000, '"short-tail"}'),
      longLine: true,
      jsonLexicalState: { mode: 'string', escaped: false },
    };
    const core = new SegmentedTextEditorCore({
      host,
      session,
      port: createPort(),
      prefetch: false,
    });

    expect(host.querySelector('.cm-lineWrapping')).toBeNull();
    expect(host.querySelector('[class*="cm-segmented-json-"]')).toBeNull();
    await core.destroy();
  });

  it('persists a pure virtual-scroll anchor independently from the cursor selection', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port: createPort(),
      prefetch: false,
    });

    core.setScrollAnchor(15, 7);

    expect(core.getMetadata().scrollAnchor).toEqual({ byteOffset: 15, line: 7 });
    await core.destroy();
  });

  it('projects a global search-result selection into the visible CodeMirror window', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port: createPort(),
      prefetch: false,
    });

    core.setSelection({ anchorByte: 1, headByte: 4 });

    expect(core.getMetadata().selection).toEqual({ anchorByte: 1, headByte: 4 });
    const view = (core as unknown as { view: EditorView }).view;
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
      'irs',
    );
    await core.destroy();
  });

  it('keeps the CodeMirror state when loading the same visible cached window', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort();
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port,
      prefetch: false,
    });
    const view = (core as unknown as { view: EditorView }).view;
    const setState = vi.spyOn(view, 'setState');

    expect((await core.loadWindow(0, { targetBytes: 5, prefetch: false })).status).toBe('cached');

    expect(port.readWindow).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
    await core.destroy();
  });

  it('does not rebuild the CodeMirror window during IME composition', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    let capturedRequest: ReadSegmentedWindowRequest | undefined;
    const port = createPort(async (request) => {
      capturedRequest = request;
      return createWindow(request.revision, request.startByte, 'deferred');
    });
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(),
      port,
      prefetch: false,
    });
    const content = host.querySelector('.cm-content')!;

    content.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    await core.loadWindow(10);
    expect(capturedRequest?.startByte).toBe(10);
    expect(editorText(host)).toContain('first');

    content.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(editorText(host)).toContain('deferred');
    await core.destroy();
  });

  it('keeps a pending-validation lossy window read-only until the exact window is applied', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const exactRead = deferred<SegmentedWindow>();
    let indexHandler: ((progress: SegmentedIndexProgress) => void) | undefined;
    const port = createPort(vi.fn(() => exactRead.promise));
    vi.mocked(port.applyEdits).mockResolvedValue({
      revision: 1,
      persistedRevision: 0,
      dirty: true,
      invalidatedFromByte: 2,
      invalidatedToByte: 3,
    });
    vi.mocked(port.listenIndexProgress).mockImplementation(async (_sessionId, handler) => {
      indexHandler = handler;
      return () => undefined;
    });
    vi.mocked(port.getStatus).mockResolvedValue({
      sessionId: 'session-1',
      revision: 0,
      persistedRevision: 0,
      byteLength: 2,
      indexedBytes: 2,
      totalBytes: 2,
      estimatedLines: 1,
      completed: true,
      encoding: 'utf-8',
      lineEnding: 'lf',
      readonly: true,
      canUndo: false,
      canRedo: false,
    });
    const session = createOpenResult(1);
    session.byteLength = 2;
    session.readonly = true;
    session.firstWindow = {
      ...createWindow(0, 0, '\ufffd'),
      endByte: 1,
      utf16ByteOffsets: [0, 1],
      trailingPartialLine: true,
    };
    const core = new SegmentedTextEditorCore({ host, session, port, prefetch: false });
    await core.ready();
    const view = (core as unknown as { view: EditorView }).view;
    core.setScrollAnchor(1, 0);

    indexHandler?.({
      sessionId: 'session-1',
      revision: 0,
      indexedBytes: 2,
      totalBytes: 2,
      estimatedLines: 1,
      completed: true,
      encoding: 'utf-8',
      lineEnding: 'lf',
      readonly: false,
    });

    expect(core.getMetadata().readonly).toBe(true);
    expect(view.state.readOnly).toBe(true);
    await vi.waitFor(() =>
      expect(port.readWindow).toHaveBeenCalledWith(expect.objectContaining({ startByte: 1 })),
    );
    indexHandler?.({
      sessionId: 'session-1',
      revision: 0,
      indexedBytes: 1,
      totalBytes: 2,
      estimatedLines: 1,
      completed: false,
      // 普通索引进度不携带 readonly，不能覆盖 exact-reread 的临时门禁。
    });
    expect(core.getMetadata().readonly).toBe(true);
    exactRead.resolve({
      revision: 0,
      startByte: 0,
      endByte: 2,
      startLine: 0,
      text: 'é',
      leadingPartialLine: false,
      trailingPartialLine: false,
      indexProgress: 1,
    });

    await vi.waitFor(() => expect(core.getMetadata().readonly).toBe(false));
    expect(editorText(host)).toContain('é');
    expect(view.state.readOnly).toBe(false);
    view.dispatch({ changes: { from: view.state.doc.length, insert: '!' } });
    await core.flushEdits();
    expect(port.applyEdits).toHaveBeenCalledWith({
      sessionId: 'session-1',
      baseRevision: 0,
      edits: [{ fromByte: 2, toByte: 2, insertedText: '!' }],
    });
    await core.destroy();
  });

  it('defers validation exact rereads during composition and does not unlock after destroy', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const exactRead = deferred<SegmentedWindow>();
    let indexHandler: ((progress: SegmentedIndexProgress) => void) | undefined;
    const port = createPort(vi.fn(() => exactRead.promise));
    vi.mocked(port.listenIndexProgress).mockImplementation(async (_sessionId, handler) => {
      indexHandler = handler;
      return () => undefined;
    });
    const session = createOpenResult(1);
    session.readonly = true;
    session.firstWindow = {
      ...session.firstWindow,
      utf16ByteOffsets: [0, 1, 2, 3, 4, 5],
    };
    const core = new SegmentedTextEditorCore({ host, session, port, prefetch: false });
    await vi.waitFor(() => expect(indexHandler).toBeTypeOf('function'));
    const content = host.querySelector('.cm-content')!;
    content.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));

    indexHandler?.({
      sessionId: 'session-1',
      revision: 0,
      indexedBytes: 20,
      totalBytes: 20,
      estimatedLines: 1,
      completed: true,
      encoding: 'utf-8',
      readonly: false,
    });
    expect(port.readWindow).not.toHaveBeenCalled();
    expect(core.getMetadata().readonly).toBe(true);

    content.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    await vi.waitFor(() => expect(port.readWindow).toHaveBeenCalledTimes(1));
    await core.destroy();
    exactRead.resolve(createWindow(0, 0, 'exact'));
    await Promise.resolve();
    expect(core.getMetadata().readonly).toBe(true);
  });

  it('flushes edits before forcing the Rust recovery journal', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort();
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(),
      port,
      prefetch: false,
    });

    const state = await core.flush();

    expect(port.flushJournal).toHaveBeenCalledWith('session-1', 0);
    expect(state).toMatchObject({ revision: 0, persistedRevision: 0, dirty: false });
    await core.destroy();
  });

  it('routes full-document selection and copy to the Rust streaming task', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort();
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port,
      prefetch: false,
    });

    const selected = core.selectAll();
    expect(selected.selection).toEqual({ anchorByte: 0, headByte: 20 });
    expect(await core.copy()).toBe(true);
    expect(port.startTask).toHaveBeenCalledWith({
      sessionId: 'session-1',
      baseRevision: 0,
      task: { type: 'select-all-copy' },
    });
    await core.destroy();
  });

  it('delegates DOM full-copy to the workspace task lifecycle when provided', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort();
    const onCopyAllRequested = vi.fn();
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port,
      prefetch: false,
      onCopyAllRequested,
    });

    core.selectAll();
    host
      .querySelector('.cm-content')!
      .dispatchEvent(new Event('copy', { bubbles: true, cancelable: true }));

    expect(onCopyAllRequested).toHaveBeenCalledOnce();
    expect(port.startTask).not.toHaveBeenCalled();
    await core.destroy();
  });

  it('applies typing over a global selection to the full byte range instead of only the window', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort();
    vi.mocked(port.applyEdits).mockResolvedValue({
      revision: 1,
      persistedRevision: 0,
      dirty: true,
      invalidatedFromByte: 0,
      invalidatedToByte: 20,
    });
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port,
      prefetch: false,
    });

    core.selectAll();
    const view = (core as unknown as { view: EditorView }).view;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'x' } });
    await core.flush();

    expect(port.applyEdits).toHaveBeenCalledWith({
      sessionId: 'session-1',
      baseRevision: 0,
      edits: [{ fromByte: 0, toByte: 20, insertedText: 'x' }],
    });
    expect(core.getMetadata().byteLength).toBe(1);
    await core.destroy();
  });

  it('rolls back an oversized rejected edit and accepts the next edit from the acknowledged revision', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort();
    vi.mocked(port.applyEdits)
      .mockRejectedValueOnce({
        code: 'edit-transaction-too-large',
        message: 'single edit transaction is too large',
      })
      .mockResolvedValueOnce({
        revision: 1,
        persistedRevision: 0,
        dirty: true,
        invalidatedFromByte: 5,
        invalidatedToByte: 6,
      });
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port,
      prefetch: false,
    });
    const view = (core as unknown as { view: EditorView }).view;

    core.selectAll();
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'x' } });
    await expect(core.flush()).rejects.toMatchObject({ code: 'edit-transaction-too-large' });

    expect(editorText(host)).toContain('first');
    expect(core.getMetadata()).toMatchObject({ revision: 0, byteLength: 20, dirty: false });

    view.dispatch({ changes: { from: view.state.doc.length, insert: '!' } });
    await core.flush();

    expect(port.applyEdits).toHaveBeenLastCalledWith({
      sessionId: 'session-1',
      baseRevision: 0,
      edits: [{ fromByte: 5, toByte: 5, insertedText: '!' }],
    });
    expect(core.getMetadata()).toMatchObject({ revision: 1, byteLength: 21, dirty: true });
    await core.destroy();
  });

  it('rolls back a revision-conflict batch and accepts the next edit from a rebuilt batcher', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort();
    vi.mocked(port.applyEdits)
      .mockRejectedValueOnce({
        code: 'revision-conflict',
        message: 'document revision changed',
        actualRevision: 0,
      })
      .mockResolvedValueOnce({
        revision: 1,
        persistedRevision: 0,
        dirty: true,
        invalidatedFromByte: 5,
        invalidatedToByte: 6,
      });
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port,
      prefetch: false,
    });
    const view = (core as unknown as { view: EditorView }).view;

    view.dispatch({ changes: { from: view.state.doc.length, insert: '?' } });
    await expect(core.flush()).rejects.toMatchObject({ code: 'revision-conflict' });

    expect(view.state.doc.toString()).toBe('first');
    expect(core.hasPendingEdits).toBe(false);
    expect(core.getMetadata()).toMatchObject({ revision: 0, byteLength: 20, dirty: false });

    view.dispatch({ changes: { from: view.state.doc.length, insert: '!' } });
    await core.flushEdits();

    expect(port.applyEdits).toHaveBeenLastCalledWith({
      sessionId: 'session-1',
      baseRevision: 0,
      edits: [{ fromByte: 5, toByte: 5, insertedText: '!' }],
    });
    expect(core.getMetadata()).toMatchObject({ revision: 1, byteLength: 21, dirty: true });
    await core.destroy();
  });

  it('does not start full-document copy before the line index is ready', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort();
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(0.5),
      port,
      prefetch: false,
    });

    core.selectAll();
    await expect(core.copy()).rejects.toThrow(/索引/);
    expect(port.startTask).not.toHaveBeenCalled();
    await core.destroy();
  });

  it('polls bounded session metadata to close the index event registration race', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort();
    vi.mocked(port.getStatus).mockResolvedValue({
      sessionId: 'session-1',
      revision: 0,
      persistedRevision: 0,
      byteLength: 20,
      indexedBytes: 20,
      totalBytes: 20,
      estimatedLines: 1,
      completed: true,
      encoding: 'utf-8',
      lineEnding: 'lf',
      readonly: false,
      canUndo: false,
      canRedo: false,
    });
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(0.5),
      port,
      prefetch: false,
    });

    expect(await core.refreshIndexProgress()).toBe(1);
    expect(port.getStatus).toHaveBeenCalledWith('session-1');
    expect(core.getMetadata().indexProgress).toBe(1);
    await core.destroy();
  });

  it('surfaces a baseline materialization failure once and keeps the session observable', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort();
    const onError = vi.fn();
    let indexHandler: ((progress: SegmentedIndexProgress) => void) | undefined;
    vi.mocked(port.getStatus).mockResolvedValue({
      sessionId: 'session-1',
      revision: 0,
      persistedRevision: 0,
      byteLength: 20,
      indexedBytes: 0,
      totalBytes: 20,
      estimatedLines: 0,
      completed: false,
      encoding: 'utf-8',
      lineEnding: 'lf',
      readonly: true,
      baselineError: '建立不可变 baseline 失败：磁盘已满',
      canUndo: false,
      canRedo: false,
    });
    vi.mocked(port.listenIndexProgress).mockImplementation(async (_sessionId, handler) => {
      indexHandler = handler;
      return () => undefined;
    });
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(0),
      port,
      prefetch: false,
      onError,
    });

    await core.ready();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toMatchObject({
      message: '建立不可变 baseline 失败：磁盘已满',
    });
    indexHandler?.({
      sessionId: 'session-1',
      revision: 0,
      indexedBytes: 0,
      totalBytes: 20,
      estimatedLines: 0,
      completed: false,
      readonly: true,
      baselineError: '建立不可变 baseline 失败：磁盘已满',
    });
    expect(onError).toHaveBeenCalledOnce();
    expect(core.getMetadata().readonly).toBe(true);
    await core.destroy();
  });

  it.each([0, 1])(
    'does not overwrite optimistic bytes or jump revision when status r%i resolves during an edit ack',
    async (statusRevision) => {
      const host = document.createElement('div');
      document.body.append(host);
      const status = deferred<SegmentedSessionStatus>();
      const edit = deferred<ApplySegmentedEditsResult>();
      const port = createPort();
      vi.mocked(port.getStatus).mockReturnValueOnce(status.promise);
      vi.mocked(port.applyEdits).mockReturnValueOnce(edit.promise);
      const core = new SegmentedTextEditorCore({
        host,
        session: createOpenResult(0.5),
        port,
        prefetch: false,
      });
      const view = (core as unknown as { view: EditorView }).view;

      const refreshing = core.refreshIndexProgress();
      await vi.waitFor(() => expect(port.getStatus).toHaveBeenCalledWith('session-1'));
      view.dispatch({ changes: { from: view.state.doc.length, insert: '!' } });
      const flushing = core.flushEdits();
      await vi.waitFor(() => expect(port.applyEdits).toHaveBeenCalledTimes(1));

      status.resolve({
        sessionId: 'session-1',
        revision: statusRevision,
        persistedRevision: 0,
        byteLength: 999,
        indexedBytes: 20,
        totalBytes: 20,
        estimatedLines: 1,
        completed: true,
        encoding: 'utf-8',
        lineEnding: 'lf',
        readonly: true,
        canUndo: false,
        canRedo: false,
      });
      await refreshing;

      expect(core.getMetadata()).toMatchObject({
        revision: 0,
        byteLength: 21,
        readonly: true,
      });
      expect(core.hasPendingEdits).toBe(true);

      edit.resolve({
        revision: 1,
        persistedRevision: 0,
        dirty: true,
        invalidatedFromByte: 5,
        invalidatedToByte: 6,
      });
      await flushing;
      expect(core.getMetadata()).toMatchObject({ revision: 1, byteLength: 21 });
      expect(core.hasPendingEdits).toBe(false);
      await core.destroy();
    },
  );

  it('routes undo and redo through the Rust revision history across window rebuilds', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort(async (request) =>
      createWindow(request.revision, request.startByte, request.revision === 1 ? 'undo' : 'redo'),
    );
    vi.mocked(port.undoRevision).mockResolvedValue({
      changed: true,
      revision: 1,
      persistedRevision: 0,
      byteLength: 4,
      dirty: true,
      canUndo: false,
      canRedo: true,
    });
    vi.mocked(port.redoRevision).mockResolvedValue({
      changed: true,
      revision: 2,
      persistedRevision: 0,
      byteLength: 4,
      dirty: true,
      canUndo: true,
      canRedo: false,
    });
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port,
      prefetch: false,
    });

    expect(await core.undo()).toBe(true);
    expect(port.undoRevision).toHaveBeenCalledWith('session-1', 0);
    expect(core.getMetadata()).toMatchObject({ revision: 1, canRedo: true, byteLength: 4 });
    expect(editorText(host)).toContain('undo');

    expect(await core.redo()).toBe(true);
    expect(port.redoRevision).toHaveBeenCalledWith('session-1', 1);
    expect(core.getMetadata()).toMatchObject({ revision: 2, canUndo: true, byteLength: 4 });
    expect(editorText(host)).toContain('redo');
    await core.destroy();
  });

  it('serializes rapid history commands and temporarily blocks edits until both finish', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    let resolveFirstUndo:
      | ((result: Awaited<ReturnType<SegmentedDocumentPort['undoRevision']>>) => void)
      | undefined;
    const port = createPort(async (request) =>
      createWindow(request.revision, request.startByte, `revision-${request.revision}`),
    );
    vi.mocked(port.undoRevision)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstUndo = resolve;
          }),
      )
      .mockResolvedValueOnce({
        changed: true,
        revision: 2,
        persistedRevision: 0,
        byteLength: 10,
        dirty: true,
        canUndo: false,
        canRedo: true,
      });
    vi.mocked(port.applyEdits).mockResolvedValue({
      revision: 3,
      persistedRevision: 0,
      dirty: true,
      invalidatedFromByte: 10,
      invalidatedToByte: 11,
    });
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port,
      prefetch: false,
    });
    const view = (core as unknown as { view: EditorView }).view;

    const firstUndo = core.undo();
    const secondUndo = core.undo();
    await vi.waitFor(() => expect(port.undoRevision).toHaveBeenCalledTimes(1));

    expect(view.state.readOnly).toBe(true);
    view.dispatch({ changes: { from: 0, insert: 'blocked' } });
    expect(view.state.doc.toString()).toBe('first');

    resolveFirstUndo?.({
      changed: true,
      revision: 1,
      persistedRevision: 0,
      byteLength: 10,
      dirty: true,
      canUndo: true,
      canRedo: true,
    });
    await Promise.all([firstUndo, secondUndo]);

    expect(port.undoRevision).toHaveBeenNthCalledWith(1, 'session-1', 0);
    expect(port.undoRevision).toHaveBeenNthCalledWith(2, 'session-1', 1);
    expect(view.state.readOnly).toBe(false);
    expect(core.getMetadata().revision).toBe(2);

    view.dispatch({ changes: { from: view.state.doc.length, insert: '!' } });
    await core.flush();
    expect(port.applyEdits).toHaveBeenLastCalledWith({
      sessionId: 'session-1',
      baseRevision: 2,
      edits: [{ fromByte: 10, toByte: 10, insertedText: '!' }],
    });
    await core.destroy();
  });

  it('blocks edits and history while an exclusive write task owns the Core', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort();
    vi.mocked(port.applyEdits).mockResolvedValue({
      revision: 1,
      persistedRevision: 0,
      dirty: true,
      invalidatedFromByte: 5,
      invalidatedToByte: 6,
    });
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port,
      prefetch: false,
    });
    const view = (core as unknown as { view: EditorView }).view;

    core.setExclusiveTaskLocked(true);
    expect(view.state.readOnly).toBe(true);
    view.dispatch({ changes: { from: 0, insert: 'blocked' } });
    expect(view.state.doc.toString()).toBe('first');
    expect(await core.undo()).toBe(false);
    expect(port.undoRevision).not.toHaveBeenCalled();

    core.setExclusiveTaskLocked(false);
    expect(view.state.readOnly).toBe(false);
    view.dispatch({ changes: { from: view.state.doc.length, insert: '!' } });
    await core.flushEdits();
    expect(port.applyEdits).toHaveBeenCalledWith({
      sessionId: 'session-1',
      baseRevision: 0,
      edits: [{ fromByte: 5, toByte: 5, insertedText: '!' }],
    });
    await core.destroy();
  });

  it('temporarily blocks editing while a fast-scroll preview owns the visible window', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port: createPort(),
      prefetch: false,
    });
    const view = (core as unknown as { view: EditorView }).view;

    core.setSeekingLocked(true);
    expect(view.state.readOnly).toBe(true);
    view.dispatch({ changes: { from: 0, insert: 'blocked' } });
    expect(view.state.doc.toString()).toBe('first');

    core.setSeekingLocked(false);
    expect(view.state.readOnly).toBe(false);
    await core.destroy();
  });

  it('reveals a byte in the current window without moving the selection', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port: createPort(),
      prefetch: false,
    });
    core.setSelection({ anchorByte: 1, headByte: 3 });
    const selectionBefore = core.getMetadata().selection;

    expect(core.revealByteOffset(4)).toBe(true);
    expect(core.revealByteOffset(10)).toBe(false);
    expect(core.getMetadata().selection).toEqual(selectionBefore);
    await core.destroy();
  });

  it('forwards a bounded preview size to the viewport reader', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort();
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port,
      prefetch: false,
    });

    await core.loadWindow(10, { targetBytes: 16 * 1024, prefetch: false });

    expect(port.readWindow).toHaveBeenCalledWith(
      expect.objectContaining({ startByte: 10, targetBytes: 16 * 1024 }),
    );
    await core.destroy();
  });

  it('accepts a save result that overtakes an in-flight edit ack without jumping Core revision', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const edit = deferred<ApplySegmentedEditsResult>();
    const port = createPort();
    vi.mocked(port.applyEdits).mockReturnValueOnce(edit.promise);
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(1),
      port,
      prefetch: false,
    });
    const view = (core as unknown as { view: EditorView }).view;

    view.dispatch({ changes: { from: view.state.doc.length, insert: '!' } });
    const flushing = core.flushEdits();
    await vi.waitFor(() => expect(port.applyEdits).toHaveBeenCalledTimes(1));

    expect(() =>
      core.applySaveResult({
        sessionId: 'session-1',
        savedRevision: 1,
        currentRevision: 1,
        persistedRevision: 1,
        dirty: false,
        readonly: true,
        modifiedAt: 10,
      }),
    ).not.toThrow();
    expect(core.getMetadata()).toMatchObject({
      revision: 0,
      persistedRevision: 1,
      byteLength: 21,
      readonly: true,
    });
    expect(core.hasPendingEdits).toBe(true);

    edit.resolve({
      revision: 1,
      persistedRevision: 0,
      dirty: true,
      invalidatedFromByte: 5,
      invalidatedToByte: 6,
    });
    await flushing;

    expect(core.getMetadata()).toMatchObject({
      revision: 1,
      persistedRevision: 1,
      byteLength: 21,
      readonly: true,
      dirty: false,
    });
    expect(core.hasPendingEdits).toBe(false);
    await core.destroy();
  });

  it('applies task and save revisions through Core metadata without exposing document text', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const port = createPort(async (request) =>
      createWindow(request.revision, request.startByte, 'new'),
    );
    const core = new SegmentedTextEditorCore({
      host,
      session: createOpenResult(),
      port,
      prefetch: false,
    });

    expect(() =>
      core.applySaveResult({
        sessionId: 'other-session',
        savedRevision: 0,
        currentRevision: 0,
        persistedRevision: 0,
        dirty: false,
        readonly: false,
        modifiedAt: 1,
      }),
    ).toThrow(/其他会话/);

    await core.applyTaskResult(2, 32);
    const saved = core.applySaveResult({
      sessionId: 'session-1',
      savedRevision: 2,
      currentRevision: 2,
      persistedRevision: 2,
      dirty: false,
      readonly: false,
      modifiedAt: 10,
    });

    expect(saved).toMatchObject({
      revision: 2,
      persistedRevision: 2,
      dirty: false,
      byteLength: 32,
    });
    expect(saved).not.toHaveProperty('text');
    const staleSave = core.applySaveResult({
      sessionId: 'session-1',
      savedRevision: 1,
      currentRevision: 1,
      persistedRevision: 1,
      dirty: true,
      readonly: false,
      modifiedAt: 9,
    });
    expect(staleSave).toMatchObject({ revision: 2, persistedRevision: 2, dirty: false });
    await core.destroy();
  });
});
