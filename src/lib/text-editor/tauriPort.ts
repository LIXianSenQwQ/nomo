import type {
  ApplySegmentedEditsResult,
  CancelSegmentedTaskResult,
  FlushSegmentedJournalResult,
  OpenSegmentedDocumentResult,
  SaveSegmentedRevisionResult,
  SegmentedDocumentPort,
  SegmentedExternalChangeResult,
  SegmentedIndexProgress,
  SegmentedHistoryResult,
  SegmentedSessionStatus,
  SegmentedTaskProgress,
  SegmentedWindow,
  StartSegmentedTaskResult,
  Unlisten,
} from './protocol';

export interface TauriPortRuntime {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  listen<T>(event: string, handler: (payload: T) => void): Promise<Unlisten>;
}

const INDEX_PROGRESS_EVENT = 'nomo://segmented-index-progress';
const TASK_PROGRESS_EVENT = 'nomo://segmented-task-progress';

/**
 * Tauri 会把 Rust `TextDocumentError` 作为普通对象拒绝 Promise。
 * 在唯一 IPC seam 转成真正的 Error，确保 UI 能显示 message，调用方仍可按 code/revision 处理冲突。
 */
export class SegmentedDocumentError extends Error {
  readonly code?: string;
  readonly actualRevision?: number;
  readonly recoveryPath?: string;

  constructor(input: {
    message: string;
    code?: string;
    actualRevision?: number;
    recoveryPath?: string;
  }) {
    super(input.message);
    this.name = 'SegmentedDocumentError';
    this.code = input.code;
    this.actualRevision = input.actualRevision;
    this.recoveryPath = input.recoveryPath;
  }
}

/** 创建生产 Tauri adapter；runtime 参数只用于在系统 seam 上做契约测试。 */
export function createTauriSegmentedDocumentPort(
  runtime: TauriPortRuntime = createDefaultTauriRuntime(),
): SegmentedDocumentPort {
  const invoke = async <T>(command: string, args?: Record<string, unknown>) => {
    try {
      return await runtime.invoke<T>(command, args);
    } catch (error) {
      throw normalizeSegmentedDocumentError(error);
    }
  };

  return {
    open(path) {
      return invoke<OpenSegmentedDocumentResult>('open_segmented_document', { path });
    },
    reloadSession(sessionId) {
      return invoke<OpenSegmentedDocumentResult>('reload_segmented_session', { sessionId });
    },
    readWindow(request) {
      return invoke<SegmentedWindow>('read_segmented_window', { ...request });
    },
    applyEdits(batch) {
      return invoke<ApplySegmentedEditsResult>('apply_segmented_edits', { batch });
    },
    undoRevision(sessionId, baseRevision) {
      return invoke<SegmentedHistoryResult>('undo_segmented_revision', {
        sessionId,
        baseRevision,
      });
    },
    redoRevision(sessionId, baseRevision) {
      return invoke<SegmentedHistoryResult>('redo_segmented_revision', {
        sessionId,
        baseRevision,
      });
    },
    flushJournal(sessionId, revision) {
      return invoke<FlushSegmentedJournalResult>('flush_segmented_journal', {
        sessionId,
        revision,
      });
    },
    saveRevision(request) {
      return invoke<SaveSegmentedRevisionResult>('save_segmented_revision', {
        ...request,
      });
    },
    startTask(request) {
      return invoke<StartSegmentedTaskResult>('start_segmented_task', { request });
    },
    cancelTask(taskId) {
      return invoke<CancelSegmentedTaskResult>('cancel_segmented_task', { taskId });
    },
    async checkExternalChange(sessionId) {
      const result = await invoke<
        Omit<SegmentedExternalChangeResult, 'type'> & {
          type?: SegmentedExternalChangeResult['type'];
          change?: SegmentedExternalChangeResult['type'];
        }
      >('check_segmented_external_change', { sessionId });
      const type = result.type ?? result.change;
      if (!type) {
        throw new Error('check_segmented_external_change 缺少 type/change');
      }
      return { ...result, type };
    },
    getStatus(sessionId) {
      return invoke<SegmentedSessionStatus>('get_segmented_session_status', { sessionId });
    },
    async closeSession(sessionId, discardChanges = false) {
      await invoke<void>('close_segmented_session', { sessionId, discardChanges });
    },
    listenIndexProgress(sessionId, handler) {
      return runtime.listen<SegmentedIndexProgress>(INDEX_PROGRESS_EVENT, (payload) => {
        if (payload.sessionId === sessionId) {
          handler(payload);
        }
      });
    },
    listenTaskProgress(sessionId, handler) {
      return runtime.listen<SegmentedTaskProgress>(TASK_PROGRESS_EVENT, (payload) => {
        if (payload.sessionId === sessionId) {
          handler(payload);
        }
      });
    },
  };
}

function normalizeSegmentedDocumentError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  if (!error || typeof error !== 'object') {
    return new Error('分段文档命令失败');
  }

  const payload = error as Record<string, unknown>;
  return new SegmentedDocumentError({
    message: typeof payload.message === 'string' ? payload.message : '分段文档命令失败',
    code: typeof payload.code === 'string' ? payload.code : undefined,
    actualRevision: typeof payload.actualRevision === 'number' ? payload.actualRevision : undefined,
    recoveryPath: typeof payload.recoveryPath === 'string' ? payload.recoveryPath : undefined,
  });
}

function createDefaultTauriRuntime(): TauriPortRuntime {
  return {
    async invoke<T>(command: string, args?: Record<string, unknown>) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<T>(command, args);
    },
    async listen<T>(event: string, handler: (payload: T) => void) {
      const { listen } = await import('@tauri-apps/api/event');
      return listen<T>(event, (eventPayload) => handler(eventPayload.payload));
    },
  };
}
