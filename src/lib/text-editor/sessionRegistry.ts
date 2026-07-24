import type {
  OpenSegmentedDocumentResult,
  SegmentedDocumentKind,
  SegmentedEncoding,
  SegmentedLineEnding,
  SegmentedWindow,
} from './protocol';
import { estimateSegmentedWindowBytes } from './chunkCache';

export interface SegmentedSessionMetadata {
  sessionId: string;
  revision: number;
  persistedRevision: number;
  documentKind: SegmentedDocumentKind;
  encoding: SegmentedEncoding;
  lineEnding: SegmentedLineEnding;
  byteLength: number;
  filesystemReadonly: boolean;
  readonly: boolean;
}

export type SegmentedSessionMetadataUpdate = Partial<
  Pick<
    SegmentedSessionMetadata,
    | 'revision'
    | 'persistedRevision'
    | 'encoding'
    | 'lineEnding'
    | 'byteLength'
    | 'filesystemReadonly'
    | 'readonly'
  >
>;

interface SessionEntry {
  metadata: SegmentedSessionMetadata;
  firstWindow?: SegmentedWindow;
  firstWindowBytes: number;
}

const DEFAULT_MAX_FIRST_WINDOW_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_FIRST_WINDOW_BYTES = 8 * 1024 * 1024;

/**
 * 打开命令与工作区挂载之间的短生命周期 registry。
 * 正文只允许以单个有界 firstWindow 暂存，消费后立即删除，长期状态仅保留元数据。
 */
export class SegmentedSessionRegistry {
  private readonly sessions = new Map<string, SessionEntry>();
  private retainedFirstWindowBytes = 0;

  constructor(
    readonly maxFirstWindowBytes = DEFAULT_MAX_FIRST_WINDOW_BYTES,
    readonly maxTotalFirstWindowBytes = DEFAULT_MAX_TOTAL_FIRST_WINDOW_BYTES,
  ) {
    if (!Number.isSafeInteger(maxFirstWindowBytes) || maxFirstWindowBytes <= 0) {
      throw new RangeError('maxFirstWindowBytes 必须是正安全整数');
    }
    if (!Number.isSafeInteger(maxTotalFirstWindowBytes) || maxTotalFirstWindowBytes <= 0) {
      throw new RangeError('maxTotalFirstWindowBytes 必须是正安全整数');
    }
    if (maxFirstWindowBytes > maxTotalFirstWindowBytes) {
      throw new RangeError('maxFirstWindowBytes 不得超过 maxTotalFirstWindowBytes');
    }
  }

  register(result: OpenSegmentedDocumentResult) {
    const firstWindowBytes = estimateSegmentedWindowBytes(result.firstWindow);
    if (firstWindowBytes < 0 || firstWindowBytes > this.maxFirstWindowBytes) {
      throw new RangeError(
        `firstWindow 超过容量限制：${firstWindowBytes}/${this.maxFirstWindowBytes}`,
      );
    }

    const metadata: SegmentedSessionMetadata = {
      sessionId: result.sessionId,
      revision: result.revision,
      persistedRevision: result.persistedRevision,
      documentKind: result.documentKind,
      encoding: result.encoding,
      lineEnding: result.lineEnding,
      byteLength: result.byteLength,
      filesystemReadonly: result.filesystemReadonly ?? false,
      readonly: result.readonly,
    };
    const previous = this.sessions.get(result.sessionId);
    if (previous) this.retainedFirstWindowBytes -= previous.firstWindowBytes;
    this.sessions.delete(result.sessionId);
    this.sessions.set(result.sessionId, {
      metadata,
      firstWindow: result.firstWindow,
      firstWindowBytes,
    });
    this.retainedFirstWindowBytes += firstWindowBytes;
    this.evictFirstWindowsToCapacity(result.sessionId);
    return { ...metadata };
  }

  has(sessionId: string) {
    return this.sessions.has(sessionId);
  }

  get(sessionId: string) {
    const metadata = this.sessions.get(sessionId)?.metadata;
    return metadata ? { ...metadata } : undefined;
  }

  update(sessionId: string, update: SegmentedSessionMetadataUpdate) {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`分段会话不存在：${sessionId}`);
    }
    entry.metadata = { ...entry.metadata, ...update };
    return { ...entry.metadata };
  }

  consumeFirstWindow(sessionId: string) {
    const entry = this.sessions.get(sessionId);
    if (!entry?.firstWindow) {
      return undefined;
    }
    const firstWindow = entry.firstWindow;
    delete entry.firstWindow;
    this.retainedFirstWindowBytes -= entry.firstWindowBytes;
    entry.firstWindowBytes = 0;
    return firstWindow;
  }

  delete(sessionId: string) {
    const entry = this.sessions.get(sessionId);
    if (entry) this.retainedFirstWindowBytes -= entry.firstWindowBytes;
    return this.sessions.delete(sessionId);
  }

  clear() {
    this.sessions.clear();
    this.retainedFirstWindowBytes = 0;
  }

  private evictFirstWindowsToCapacity(protectedSessionId: string) {
    if (this.retainedFirstWindowBytes <= this.maxTotalFirstWindowBytes) return;
    for (const [sessionId, entry] of this.sessions) {
      if (this.retainedFirstWindowBytes <= this.maxTotalFirstWindowBytes) break;
      if (sessionId === protectedSessionId || !entry.firstWindow) continue;
      delete entry.firstWindow;
      this.retainedFirstWindowBytes -= entry.firstWindowBytes;
      entry.firstWindowBytes = 0;
    }
  }
}

export const segmentedSessionRegistry = new SegmentedSessionRegistry();
