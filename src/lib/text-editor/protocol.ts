export type SegmentedDocumentKind = 'text' | 'json';

export type SegmentedEncoding = 'utf-8' | 'utf-8-bom' | 'unsupported';

export type SegmentedLineEnding = 'lf' | 'crlf' | 'mixed';

export interface GlobalSelection {
  anchorByte: number;
  headByte: number;
}

export interface GlobalScrollAnchor {
  byteOffset: number;
  line: number;
}

export interface JsonLexicalState {
  mode: 'default' | 'string';
  escaped: boolean;
}

export interface SegmentedWindow {
  revision: number;
  requestId?: number;
  startByte: number;
  endByte: number;
  startLine: number;
  text: string;
  leadingPartialLine: boolean;
  trailingPartialLine: boolean;
  /** 当前窗口与超长逻辑行相交；由 Rust 做有界前后扫描，不能只看窗口内尾段。 */
  longLine?: boolean;
  indexProgress: number;
  /** 非 UTF-8 只读窗口中，每个 UTF-16 边界对应的原始相对字节偏移。 */
  utf16ByteOffsets?: number[];
  /** JSON 后端检查点是可选扩展；缺失时仅从当前窗口默认词法态开始。 */
  jsonLexicalState?: JsonLexicalState;
}

export interface OpenSegmentedDocumentResult {
  sessionId: string;
  revision: number;
  persistedRevision: number;
  documentKind: SegmentedDocumentKind;
  encoding: SegmentedEncoding;
  lineEnding: SegmentedLineEnding;
  byteLength: number;
  readonly: boolean;
  recoveryConflictPath?: string;
  firstWindow: SegmentedWindow;
}

export interface ReadSegmentedWindowRequest {
  sessionId: string;
  revision: number;
  startByte: number;
  targetBytes: number;
  requestId: number;
}

export interface SegmentedEdit {
  fromByte: number;
  toByte: number;
  insertedText: string;
}

export interface SegmentedEditBatch {
  sessionId: string;
  baseRevision: number;
  edits: SegmentedEdit[];
}

export interface ApplySegmentedEditsResult {
  revision: number;
  persistedRevision: number;
  dirty: boolean;
  invalidatedFromByte: number;
  invalidatedToByte: number;
}

export interface SegmentedHistoryResult {
  changed: boolean;
  revision: number;
  persistedRevision: number;
  byteLength: number;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export interface FlushSegmentedJournalResult {
  revision: number;
}

export interface SaveSegmentedRevisionRequest {
  sessionId: string;
  revision: number;
  targetPath?: string;
  overwriteExternal?: boolean;
}

export interface SaveSegmentedRevisionResult {
  sessionId: string;
  savedRevision: number;
  currentRevision: number;
  persistedRevision: number;
  dirty: boolean;
  readonly: boolean;
  modifiedAt: number;
}

export type SegmentedTaskType =
  | 'search'
  | 'replace-all'
  | 'select-all-copy'
  | 'json-validate'
  | 'json-format';

export type SegmentedSearchDirection = 'forward' | 'backward';

export interface SegmentedTaskSpec {
  type: SegmentedTaskType;
  query?: string;
  replacement?: string;
  /** 搜索分页始终只取 anchor 附近的有界结果，不把全部命中传入 WebView。 */
  anchorByte?: number;
  direction?: SegmentedSearchDirection;
}

export interface StartSegmentedTaskRequest {
  sessionId: string;
  baseRevision: number;
  task: SegmentedTaskSpec;
}

export interface StartSegmentedTaskResult {
  taskId: string;
}

export interface CancelSegmentedTaskResult {
  taskId: string;
  cancelled: boolean;
}

export interface SegmentedIndexProgress {
  sessionId: string;
  revision: number;
  indexedBytes: number;
  totalBytes: number;
  estimatedLines: number;
  completed: boolean;
  encoding?: SegmentedEncoding;
  lineEnding?: SegmentedLineEnding;
  readonly?: boolean;
  /** 不可变 baseline 后台物化失败时保持只读，并向用户暴露具体原因。 */
  baselineError?: string;
}

export interface SegmentedSessionStatus {
  sessionId: string;
  revision: number;
  persistedRevision: number;
  byteLength: number;
  indexedBytes: number;
  totalBytes: number;
  estimatedLines: number;
  completed: boolean;
  encoding: SegmentedEncoding;
  lineEnding: SegmentedLineEnding;
  readonly: boolean;
  baselineError?: string;
  canUndo: boolean;
  canRedo: boolean;
}

export type SegmentedTaskState = 'running' | 'completed' | 'cancelled' | 'conflict' | 'failed';

export interface SegmentedTaskProgress {
  sessionId: string;
  taskId: string;
  requestId?: string;
  baseRevision: number;
  revision?: number;
  kind: SegmentedTaskType;
  state: SegmentedTaskState;
  processedBytes: number;
  totalBytes: number;
  matchCount: number;
  currentMatch?: SegmentedMatchRange;
  nearbyMatches?: SegmentedMatchRange[];
  resultRevision?: number;
  /** Rust 写任务提交后的逻辑全文字节数；字段名与 TaskProgressEvent 保持一致。 */
  resultByteLength?: number;
  persistedRevision?: number;
  dirty?: boolean;
  outputPath?: string;
  message?: string;
}

export interface SegmentedMatchRange {
  startByte: number;
  endByte: number;
}

export type SegmentedExternalChangeType = 'none' | 'modified' | 'deleted';

export interface SegmentedExternalChangeResult {
  sessionId: string;
  revision: number;
  type: SegmentedExternalChangeType;
  modifiedAt: number;
  /** 后端生成的不透明磁盘身份；同一身份被用户忽略后不应在下一轮轮询重复提示。 */
  changeToken?: string;
  dirty: boolean;
  saveInProgress: boolean;
}

export type Unlisten = () => void;

/**
 * Rust 分段文档引擎的唯一 WebView seam。
 * Core 和测试只依赖该接口，Tauri 事件及 invoke 细节不会扩散到编辑逻辑。
 */
export interface SegmentedDocumentPort {
  open(path: string): Promise<OpenSegmentedDocumentResult>;
  reloadSession(sessionId: string): Promise<OpenSegmentedDocumentResult>;
  readWindow(request: ReadSegmentedWindowRequest): Promise<SegmentedWindow>;
  applyEdits(batch: SegmentedEditBatch): Promise<ApplySegmentedEditsResult>;
  undoRevision(sessionId: string, baseRevision: number): Promise<SegmentedHistoryResult>;
  redoRevision(sessionId: string, baseRevision: number): Promise<SegmentedHistoryResult>;
  flushJournal(sessionId: string, revision: number): Promise<FlushSegmentedJournalResult>;
  saveRevision(request: SaveSegmentedRevisionRequest): Promise<SaveSegmentedRevisionResult>;
  startTask(request: StartSegmentedTaskRequest): Promise<StartSegmentedTaskResult>;
  cancelTask(taskId: string): Promise<CancelSegmentedTaskResult>;
  checkExternalChange(sessionId: string): Promise<SegmentedExternalChangeResult>;
  getStatus(sessionId: string): Promise<SegmentedSessionStatus>;
  closeSession(sessionId: string, discardChanges?: boolean): Promise<void>;
  listenIndexProgress(
    sessionId: string,
    handler: (progress: SegmentedIndexProgress) => void,
  ): Promise<Unlisten>;
  listenTaskProgress(
    sessionId: string,
    handler: (progress: SegmentedTaskProgress) => void,
  ): Promise<Unlisten>;
}
