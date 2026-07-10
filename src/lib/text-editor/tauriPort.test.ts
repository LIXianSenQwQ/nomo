import { describe, expect, it, vi } from 'vitest';
import type { SegmentedIndexProgress, SegmentedTaskProgress } from './protocol';
import {
  createTauriSegmentedDocumentPort,
  SegmentedDocumentError,
  type TauriPortRuntime,
} from './tauriPort';

function createRuntime() {
  const listeners = new Map<string, (payload: unknown) => void>();
  const runtime: TauriPortRuntime = {
    invoke: vi.fn(async (command: string) => {
      if (command === 'open_segmented_document') {
        return {
          sessionId: 'session-1',
          revision: 0,
          persistedRevision: 0,
          documentKind: 'text',
          encoding: 'utf-8',
          lineEnding: 'lf',
          byteLength: 3,
          readonly: false,
          firstWindow: {
            revision: 0,
            startByte: 0,
            endByte: 3,
            startLine: 0,
            text: 'abc',
            leadingPartialLine: false,
            trailingPartialLine: false,
            indexProgress: 1,
          },
        };
      }
      if (command === 'check_segmented_external_change') {
        return {
          sessionId: 'session-1',
          revision: 0,
          change: 'modified',
          modifiedAt: 9,
          dirty: true,
          saveInProgress: false,
        };
      }
      return undefined;
    }) as TauriPortRuntime['invoke'],
    listen: vi.fn(async (event, handler) => {
      listeners.set(event, handler as (payload: unknown) => void);
      return () => listeners.delete(event);
    }) as TauriPortRuntime['listen'],
  };
  return { runtime, listeners };
}

describe('TauriSegmentedDocumentPort', () => {
  it('uses the agreed command names and top-level camelCase arguments', async () => {
    const { runtime } = createRuntime();
    const port = createTauriSegmentedDocumentPort(runtime);

    await port.open('/tmp/a.txt');
    await port.reloadSession('session-1');
    await port.readWindow({
      sessionId: 'session-1',
      revision: 2,
      startByte: 4096,
      targetBytes: 8192,
      requestId: 7,
    });
    await port.undoRevision('session-1', 2);
    await port.redoRevision('session-1', 3);
    await port.cancelTask('task-9');
    await port.closeSession('session-1', true);
    const externalChange = await port.checkExternalChange('session-1');
    await port.getStatus('session-1');

    expect(runtime.invoke).toHaveBeenNthCalledWith(1, 'open_segmented_document', {
      path: '/tmp/a.txt',
    });
    expect(runtime.invoke).toHaveBeenNthCalledWith(2, 'reload_segmented_session', {
      sessionId: 'session-1',
    });
    expect(runtime.invoke).toHaveBeenNthCalledWith(3, 'read_segmented_window', {
      sessionId: 'session-1',
      revision: 2,
      startByte: 4096,
      targetBytes: 8192,
      requestId: 7,
    });
    expect(runtime.invoke).toHaveBeenNthCalledWith(4, 'undo_segmented_revision', {
      sessionId: 'session-1',
      baseRevision: 2,
    });
    expect(runtime.invoke).toHaveBeenNthCalledWith(5, 'redo_segmented_revision', {
      sessionId: 'session-1',
      baseRevision: 3,
    });
    expect(runtime.invoke).toHaveBeenNthCalledWith(6, 'cancel_segmented_task', {
      taskId: 'task-9',
    });
    expect(runtime.invoke).toHaveBeenNthCalledWith(7, 'close_segmented_session', {
      sessionId: 'session-1',
      discardChanges: true,
    });
    expect(runtime.invoke).toHaveBeenNthCalledWith(8, 'check_segmented_external_change', {
      sessionId: 'session-1',
    });
    expect(runtime.invoke).toHaveBeenNthCalledWith(9, 'get_segmented_session_status', {
      sessionId: 'session-1',
    });
    expect(externalChange.type).toBe('modified');
  });

  it('only forwards directed progress events for the requested session', async () => {
    const { runtime, listeners } = createRuntime();
    const port = createTauriSegmentedDocumentPort(runtime);
    const onIndex = vi.fn();
    const onTask = vi.fn();

    await port.listenIndexProgress('session-1', onIndex);
    await port.listenTaskProgress('session-1', onTask);

    const indexListener = listeners.get('nomo://segmented-index-progress');
    const taskListener = listeners.get('nomo://segmented-task-progress');
    indexListener?.({ sessionId: 'other', revision: 0 } as SegmentedIndexProgress);
    indexListener?.({ sessionId: 'session-1', revision: 0 } as SegmentedIndexProgress);
    taskListener?.({ sessionId: 'other', taskId: 'x' } as SegmentedTaskProgress);
    taskListener?.({ sessionId: 'session-1', taskId: 'y' } as SegmentedTaskProgress);

    expect(onIndex).toHaveBeenCalledTimes(1);
    expect(onTask).toHaveBeenCalledTimes(1);
  });

  it('normalizes structured Rust errors without dropping recovery metadata', async () => {
    const { runtime } = createRuntime();
    vi.mocked(runtime.invoke).mockRejectedValueOnce({
      code: 'source-missing-recovered',
      message: '源文件不存在，未保存内容已恢复',
      actualRevision: 7,
      recoveryPath: '/tmp/recovered.txt',
    });
    const port = createTauriSegmentedDocumentPort(runtime);

    const error = await port.open('/tmp/missing.txt').catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(SegmentedDocumentError);
    expect(error).toMatchObject({
      name: 'SegmentedDocumentError',
      code: 'source-missing-recovered',
      message: '源文件不存在，未保存内容已恢复',
      actualRevision: 7,
      recoveryPath: '/tmp/recovered.txt',
    });
  });
});
