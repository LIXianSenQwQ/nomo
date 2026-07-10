import { defaultKeymap } from '@codemirror/commands';
import { Compartment, EditorSelection, EditorState, type Extension } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { SegmentedEditBatcher } from './editBatch';
import {
  DEFAULT_JSON_LEXICAL_STATE,
  hasLineLongerThan,
  lexJsonWindow,
  type JsonTokenType,
} from './jsonLexer';
import {
  WindowPositionMapping,
  createWindowPositionMapping,
  normalizeInsertedTextForLineEnding,
} from './positionMapping';
import type {
  ApplySegmentedEditsResult,
  GlobalScrollAnchor,
  GlobalSelection,
  OpenSegmentedDocumentResult,
  SegmentedDocumentPort,
  SegmentedEncoding,
  SegmentedHistoryResult,
  SegmentedIndexProgress,
  SegmentedLineEnding,
  SegmentedSessionStatus,
  SegmentedTaskProgress,
  SegmentedWindow,
  SaveSegmentedRevisionResult,
  Unlisten,
} from './protocol';
import { ViewportController, type ViewportLoadStatus } from './viewportController';

export interface SegmentedEditorMetadata {
  sessionId: string;
  revision: number;
  persistedRevision: number;
  dirty: boolean;
  byteLength: number;
  indexProgress: number;
  encoding: SegmentedEncoding;
  lineEnding: SegmentedLineEnding;
  readonly: boolean;
  canUndo: boolean;
  canRedo: boolean;
  selection: GlobalSelection | null;
  scrollAnchor: GlobalScrollAnchor | null;
  visibleStartByte: number;
  visibleEndByte: number;
}

export interface SegmentedCoreLoadResult {
  status: ViewportLoadStatus;
  requestId: number;
  startByte?: number;
  endByte?: number;
}

export interface SegmentedTextEditorCoreOptions {
  host: HTMLElement;
  session: OpenSegmentedDocumentResult;
  port: SegmentedDocumentPort;
  cacheCapacityBytes?: number;
  windowBytes?: number;
  prefetchBytes?: number;
  prefetch?: boolean;
  maxJsonHighlightLineLength?: number;
  selection?: GlobalSelection | null;
  scrollAnchor?: GlobalScrollAnchor | null;
  onMetadataChange?: (metadata: SegmentedEditorMetadata) => void;
  onIndexProgress?: (progress: SegmentedIndexProgress) => void;
  onTaskProgress?: (progress: SegmentedTaskProgress) => void;
  /** 宿主提供时，DOM 全文复制交由统一任务状态机启动，以保留进度与取消能力。 */
  onCopyAllRequested?: () => void;
  onError?: (error: unknown) => void;
}

const DEFAULT_CACHE_CAPACITY_BYTES = 8 * 1024 * 1024;
const DEFAULT_WINDOW_BYTES = 256 * 1024;
const DEFAULT_MAX_JSON_HIGHLIGHT_LINE_LENGTH = 100_000;

interface PendingEditSnapshot {
  window: SegmentedWindow;
  byteLength: number;
}

/**
 * 分段文本 EditorCore：CodeMirror 只持有当前窗口，全文能力始终留在 Rust port。
 * 调用方切换或关闭前必须 await flush()；destroy() 只释放 WebView 资源，不关闭 Rust session。
 */
export class SegmentedTextEditorCore {
  private readonly port: SegmentedDocumentPort;
  private readonly viewport: ViewportController;
  private editBatcher: SegmentedEditBatcher;
  private readonly maxJsonHighlightLineLength: number;
  private readonly editabilityCompartment = new Compartment();
  private view: EditorView;
  private mapping: WindowPositionMapping;
  private currentWindow: SegmentedWindow;
  private acknowledgedWindow: SegmentedWindow;
  private acknowledgedByteLength: number;
  private readonly pendingEditSnapshots: PendingEditSnapshot[] = [];
  private revision: number;
  private persistedRevision: number;
  private byteLength: number;
  private indexProgress: number;
  private encoding: SegmentedEncoding;
  private lineEnding: SegmentedLineEnding;
  private backendReadonlyDocument: boolean;
  private readonlyDocument: boolean;
  private canUndo = false;
  private canRedo = false;
  private selection: GlobalSelection | null;
  private scrollAnchor: GlobalScrollAnchor | null;
  private compositionActive = false;
  private deferredWindow?: SegmentedWindow;
  private metadataReconfigurePending = false;
  private validationUnlockPending = false;
  private validationRefreshPromise: Promise<void> | null = null;
  private reportedBaselineError: string | null = null;
  private applyingGlobalSelection = false;
  private historyLocked = false;
  private exclusiveTaskLocked = false;
  private historyQueueDepth = 0;
  private historyTail: Promise<void> = Promise.resolve();
  private destroyed = false;
  private readonly unlisteners: Unlisten[] = [];
  private readonly listenerRegistration: Promise<void>;

  constructor(private readonly options: SegmentedTextEditorCoreOptions) {
    this.port = options.port;
    this.revision = options.session.revision;
    this.persistedRevision = options.session.persistedRevision;
    this.byteLength = options.session.byteLength;
    this.indexProgress = options.session.firstWindow.indexProgress;
    this.encoding = options.session.encoding;
    this.lineEnding = options.session.lineEnding;
    this.backendReadonlyDocument =
      options.session.readonly || options.session.encoding === 'unsupported';
    this.readonlyDocument = this.backendReadonlyDocument;
    this.selection = options.selection ?? null;
    this.scrollAnchor = options.scrollAnchor ?? null;
    this.maxJsonHighlightLineLength =
      options.maxJsonHighlightLineLength ?? DEFAULT_MAX_JSON_HIGHLIGHT_LINE_LENGTH;
    this.currentWindow = options.session.firstWindow;
    this.acknowledgedWindow = options.session.firstWindow;
    this.acknowledgedByteLength = this.byteLength;
    this.mapping = createWindowPositionMapping(this.currentWindow);

    this.viewport = new ViewportController({
      sessionId: options.session.sessionId,
      revision: this.revision,
      byteLength: this.byteLength,
      port: this.port,
      windowBytes: options.windowBytes ?? DEFAULT_WINDOW_BYTES,
      cacheCapacityBytes: options.cacheCapacityBytes ?? DEFAULT_CACHE_CAPACITY_BYTES,
      prefetchBytes: options.prefetchBytes,
      prefetch: options.prefetch,
      onWindow: (window) => this.receiveWindow(window),
      onError: (error) => this.options.onError?.(error),
    });
    this.editBatcher = this.createEditBatcher(this.revision);

    this.view = this.createView(this.mapping, this.currentWindow);
    this.viewport.seedWindow(this.currentWindow);
    this.listenerRegistration = this.registerProgressListeners();
    this.emitMetadata();
  }

  getMetadata(): SegmentedEditorMetadata {
    return {
      sessionId: this.options.session.sessionId,
      revision: this.revision,
      persistedRevision: this.persistedRevision,
      dirty: this.revision !== this.persistedRevision || this.editBatcher.hasPendingEdits,
      byteLength: this.byteLength,
      indexProgress: this.indexProgress,
      encoding: this.encoding,
      lineEnding: this.lineEnding,
      readonly: this.readonlyDocument,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      selection: this.selection,
      scrollAnchor: this.scrollAnchor,
      visibleStartByte: this.currentWindow.startByte,
      visibleEndByte: this.currentWindow.endByte,
    };
  }

  /** 只暴露是否仍有乐观编辑等待 Rust ack，不泄露批次正文或内部队列。 */
  get hasPendingEdits() {
    return this.editBatcher.hasPendingEdits;
  }

  /** 用户启动后台任务前等待定向事件监听完成，避免短任务先完成、监听后挂载。 */
  async ready() {
    this.assertAlive();
    await this.listenerRegistration;
    await this.refreshSessionStatus();
  }

  /**
   * open 返回到事件监听挂载之间可能丢失极短索引任务的 completed 事件。
   * 使用轻量 session status 轮询元数据，不读取正文，也不改变当前视口。
   */
  async refreshIndexProgress() {
    this.assertAlive();
    if (this.indexProgress >= 1) return this.indexProgress;
    await this.refreshSessionStatus();
    return this.indexProgress;
  }

  async loadWindow(startByte: number): Promise<SegmentedCoreLoadResult> {
    this.assertAlive();
    await this.editBatcher.flush();
    const result = await this.viewport.loadWindow(startByte);
    return {
      status: result.status,
      requestId: result.requestId,
      startByte: result.window?.startByte,
      endByte: result.window?.endByte,
    };
  }

  /** 只等待局部 edit ack；保存冻结 revision 时不得被独立 journal 快照阻塞。 */
  async flushEdits() {
    this.assertAlive();
    await this.editBatcher.flush();
    // onApplied 已在真实 ack 时发出元数据；空 flush 不重复发事件，避免 auto-save 自触发循环。
    return this.getMetadata();
  }

  /** 提交全部局部 edits，并强制 Rust 恢复日志落盘。 */
  async flush() {
    await this.flushEdits();
    const result = await this.port.flushJournal(this.options.session.sessionId, this.revision);
    if (result.revision !== this.revision) {
      throw new Error(`flush journal revision 不一致：${result.revision}/${this.revision}`);
    }
    this.emitMetadata();
    return this.getMetadata();
  }

  async undo() {
    this.assertAlive();
    return this.enqueueHistoryAction('undo');
  }

  async redo() {
    this.assertAlive();
    return this.enqueueHistoryAction('redo');
  }

  /** 全文写任务冻结 revision 后，阻止新编辑及 undo/redo 进入同一会话。 */
  setExclusiveTaskLocked(locked: boolean) {
    this.assertAlive();
    if (this.exclusiveTaskLocked === locked) return;
    this.exclusiveTaskLocked = locked;
    this.reconfigureEditability();
  }

  /** 全局端点保存在 Core，CodeMirror 仅绘制当前窗口内的可见部分。 */
  selectAll() {
    this.assertAlive();
    this.selection = { anchorByte: 0, headByte: this.byteLength };
    this.dispatchVisibleGlobalSelection();
    this.viewport.setSelectionPins([0, this.byteLength]);
    this.emitMetadata();
    return this.getMetadata();
  }

  /** 搜索等 Rust 全文任务只回传字节范围；Core 负责把全局端点投影到当前可见窗口。 */
  setSelection(selection: GlobalSelection) {
    this.assertAlive();
    for (const [name, value] of Object.entries(selection)) {
      if (!Number.isSafeInteger(value) || value < 0 || value > this.byteLength) {
        throw new RangeError(`${name} 必须位于 0..${this.byteLength}`);
      }
    }
    this.selection = { ...selection };
    this.dispatchVisibleGlobalSelection();
    this.viewport.setSelectionPins([selection.anchorByte, selection.headByte]);
    this.emitMetadata();
    return this.getMetadata();
  }

  /** 全选复制由 Rust 流式任务处理；普通局部选区继续使用 CodeMirror 原生复制。 */
  async copy() {
    this.assertAlive();
    if (!this.isEntireDocumentSelected()) return false;
    if (this.indexProgress < 1) {
      throw new Error('完整行索引完成后才能执行全文复制');
    }
    await this.editBatcher.flush();
    await this.port.startTask({
      sessionId: this.options.session.sessionId,
      baseRevision: this.revision,
      task: { type: 'select-all-copy' },
    });
    return true;
  }

  /** replace-all/json-format 完成后丢弃旧 cache，并从新 revision 重读当前窗口。 */
  async applyTaskResult(resultRevision: number, byteLength?: number) {
    this.assertAlive();
    await this.editBatcher.flush();
    if (!Number.isSafeInteger(resultRevision) || resultRevision < this.revision) {
      throw new RangeError('任务 resultRevision 不得小于当前 revision');
    }
    const nextByteLength = byteLength ?? this.byteLength;
    if (!Number.isSafeInteger(nextByteLength) || nextByteLength < 0) {
      throw new RangeError('byteLength 必须是非负安全整数');
    }
    this.canUndo = true;
    this.canRedo = false;
    return this.reloadRevision(resultRevision, nextByteLength);
  }

  /** 保存结果是 persistedRevision 的唯一写入口；旧 revision 保存完成时仍保持 dirty。 */
  applySaveResult(result: SaveSegmentedRevisionResult) {
    this.assertAlive();
    if (result.sessionId !== this.options.session.sessionId) {
      throw new Error(`保存结果属于其他会话：${result.sessionId}`);
    }
    if (result.currentRevision < this.revision) {
      // 保存冻结在旧 revision 时只推进已持久化水位，绝不让当前编辑 revision 倒退。
      this.persistedRevision = Math.max(this.persistedRevision, result.persistedRevision);
      this.updateSessionMetadata(this.encoding, this.lineEnding, result.readonly);
      this.emitMetadata();
      return this.getMetadata();
    }
    if (result.currentRevision > this.revision) {
      if (this.editBatcher.hasPendingEdits) {
        // save invoke 与 edit ack 可能反向到达；保存水位可先推进，正文 revision 等 ack 自然确认。
        this.persistedRevision = Math.max(this.persistedRevision, result.persistedRevision);
        this.updateSessionMetadata(this.encoding, this.lineEnding, result.readonly);
        this.emitMetadata();
        return this.getMetadata();
      }
      this.revision = result.currentRevision;
      this.editBatcher.setBaseRevision(result.currentRevision);
      this.currentWindow = { ...this.currentWindow, revision: result.currentRevision };
      this.acknowledgedWindow = {
        ...this.acknowledgedWindow,
        revision: result.currentRevision,
      };
      this.viewport.setRevision(this.revision, this.byteLength, this.currentWindow);
    }
    this.persistedRevision = Math.max(this.persistedRevision, result.persistedRevision);
    this.updateSessionMetadata(this.encoding, this.lineEnding, result.readonly);
    this.emitMetadata();
    return this.getMetadata();
  }

  focus() {
    this.assertAlive();
    this.view.focus();
  }

  /** 虚拟滚动不一定移动光标；显式记录全局 anchor，供切换标签和工作区恢复。 */
  setScrollAnchor(byteOffset: number, line = this.currentWindow.startLine) {
    this.assertAlive();
    if (!Number.isSafeInteger(byteOffset) || byteOffset < 0 || byteOffset > this.byteLength) {
      throw new RangeError(`scroll anchor 必须位于 0..${this.byteLength}`);
    }
    if (!Number.isSafeInteger(line) || line < 0) {
      throw new RangeError('scroll anchor line 必须是非负安全整数');
    }
    this.scrollAnchor = { byteOffset, line };
    this.emitMetadata();
    return this.getMetadata();
  }

  /** destroy 不隐式关闭后端 session；是否丢弃修改必须由应用层显式决定。 */
  async destroy() {
    if (this.destroyed) return;
    // 销毁终止所有前端交互所有权，不能把独占任务锁泄漏给复用宿主。
    this.exclusiveTaskLocked = false;
    this.destroyed = true;
    this.deferredWindow = undefined;
    this.viewport.destroy();
    this.editBatcher.destroy();
    this.view.destroy();
    await this.listenerRegistration;
    for (const unlisten of this.unlisteners.splice(0)) {
      unlisten();
    }
  }

  private createView(mapping: WindowPositionMapping, window: SegmentedWindow) {
    return new EditorView({
      parent: this.options.host,
      state: this.createEditorState(mapping, window),
    });
  }

  private createEditBatcher(baseRevision: number) {
    let batcher: SegmentedEditBatcher;
    batcher = new SegmentedEditBatcher({
      sessionId: this.options.session.sessionId,
      baseRevision,
      applyEdits: (batch) => this.port.applyEdits(batch),
      onApplied: (result) => this.handleAppliedEdits(result),
      onError: (error) => {
        if (isRecoverableEditRejection(error)) {
          this.recoverFromRejectedEdit(batcher);
        }
        this.options.onError?.(error);
      },
    });
    return batcher;
  }

  private createEditorState(mapping: WindowPositionMapping, window: SegmentedWindow) {
    return EditorState.create({
      doc: mapping.editorText,
      selection: this.createLocalSelection(mapping),
      extensions: this.createExtensions(mapping, window),
    });
  }

  private createExtensions(mapping: WindowPositionMapping, window: SegmentedWindow): Extension[] {
    const longLine =
      Boolean(window.longLine) ||
      hasLineLongerThan(mapping.editorText, this.maxJsonHighlightLineLength);
    const extensions: Extension[] = [
      keymap.of([
        {
          key: 'Mod-z',
          run: () => this.queueHistoryAction('undo'),
        },
        {
          key: 'Mod-Shift-z',
          run: () => this.queueHistoryAction('redo'),
        },
        {
          key: 'Mod-y',
          run: () => this.queueHistoryAction('redo'),
        },
        ...defaultKeymap,
      ]),
      this.editabilityCompartment.of(this.createEditabilityExtensions()),
      EditorState.transactionFilter.of((transaction) => {
        // EditorState.readOnly 不拦截程序化 dispatch；历史命令期间统一拒绝正文事务，
        // 保证 undo/redo ack 返回前不会产生基于旧 revision 的 pending edits。
        return this.isInteractionLocked() && transaction.docChanged ? [] : transaction;
      }),
      EditorState.lineSeparator.of('\n'),
      EditorView.updateListener.of((update) => this.handleViewUpdate(update)),
      EditorView.domEventHandlers({
        compositionstart: () => {
          this.compositionActive = true;
          return false;
        },
        compositionend: () => {
          this.compositionActive = false;
          queueMicrotask(() => {
            this.applyPendingMetadataReconfigure();
            this.applyDeferredWindowAfterComposition();
            this.startExactWindowRefreshBeforeValidationUnlock();
          });
          return false;
        },
        copy: (event) => {
          if (!this.isEntireDocumentSelected()) return false;
          event.preventDefault();
          if (this.options.onCopyAllRequested) {
            this.options.onCopyAllRequested();
          } else {
            void this.copy().catch((error) => this.options.onError?.(error));
          }
          return true;
        },
      }),
      EditorView.contentAttributes.of({
        'data-segmented-editor': 'true',
        spellcheck: 'false',
      }),
      segmentedEditorTheme,
    ];
    if (!longLine) {
      extensions.push(EditorView.lineWrapping);
    }
    if (this.options.session.documentKind === 'json' && !longLine) {
      // 非首块缺少 checkpoint 表示索引已失效，而不是字符串外的 default 状态。
      // 此时宁可暂时不高亮，也不能把跨块字符串错误标成 JSON 结构。
      const lexicalState =
        window.jsonLexicalState ??
        (window.startByte === 0 ? DEFAULT_JSON_LEXICAL_STATE : undefined);
      if (lexicalState) {
        extensions.push(
          createJsonHighlightExtension(lexicalState, this.maxJsonHighlightLineLength),
        );
      }
    }
    return extensions;
  }

  private createEditabilityExtensions(): Extension {
    const readonly = this.readonlyDocument || this.isInteractionLocked();
    return [EditorState.readOnly.of(readonly), EditorView.editable.of(!readonly)];
  }

  private handleViewUpdate(update: ViewUpdate) {
    if (this.destroyed) return;
    if (update.docChanged) {
      this.captureLocalEdits(update);
    }
    if ((update.docChanged || update.selectionSet) && !this.applyingGlobalSelection) {
      this.captureSelection(update.state);
      this.emitMetadata();
    }
  }

  private captureLocalEdits(update: ViewUpdate) {
    const previousMapping = this.mapping;
    const projectedSelection = update.startState.selection.main;
    const globalSelection = this.selection;
    const canReplaceGlobalSelection =
      globalSelection !== null &&
      projectedSelection.from < projectedSelection.to &&
      selectionExtendsOutsideMapping(globalSelection, previousMapping);
    const storageChanges: Array<{ from: number; to: number; insertedText: string }> = [];
    const edits: Array<{ fromByte: number; toByte: number; insertedText: string }> = [];
    let usedGlobalSelection = false;
    let nextWindowStart = this.currentWindow.startByte;
    let documentByteDelta = 0;

    update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      const insertedText = normalizeInsertedTextForLineEnding(inserted.toString(), this.lineEnding);
      const replacesProjectedGlobalSelection =
        canReplaceGlobalSelection &&
        !usedGlobalSelection &&
        fromA === projectedSelection.from &&
        toA === projectedSelection.to;
      const byteRange = replacesProjectedGlobalSelection
        ? {
            fromByte: Math.min(globalSelection.anchorByte, globalSelection.headByte),
            toByte: Math.max(globalSelection.anchorByte, globalSelection.headByte),
          }
        : previousMapping.localRangeToGlobalBytes(fromA, toA);
      if (replacesProjectedGlobalSelection) {
        usedGlobalSelection = true;
        // 选区从当前窗口左侧开始时，新插入文本的全局起点也随之左移。
        nextWindowStart = Math.min(nextWindowStart, byteRange.fromByte);
      }
      edits.push({ ...byteRange, insertedText });
      documentByteDelta += utf8ByteLength(insertedText) - (byteRange.toByte - byteRange.fromByte);
      storageChanges.push({
        from: previousMapping.localToStorageOffset(fromA, 'left'),
        to: previousMapping.localToStorageOffset(toA, 'right'),
        insertedText,
      });
    });

    let nextStorageText = previousMapping.storageText;
    for (const change of storageChanges.sort((left, right) => right.from - left.from)) {
      nextStorageText =
        nextStorageText.slice(0, change.from) +
        change.insertedText +
        nextStorageText.slice(change.to);
    }

    this.mapping = new WindowPositionMapping(nextStorageText, nextWindowStart);
    this.byteLength += documentByteDelta;
    this.currentWindow = {
      ...this.currentWindow,
      startByte: nextWindowStart,
      text: nextStorageText,
      endByte: this.mapping.endByte,
      startLine: nextWindowStart === 0 ? 0 : this.currentWindow.startLine,
      leadingPartialLine: nextWindowStart > 0,
      trailingPartialLine: this.mapping.endByte < this.byteLength,
    };
    this.editBatcher.enqueue(edits);
    this.pendingEditSnapshots.push({
      window: { ...this.currentWindow },
      byteLength: this.byteLength,
    });
  }

  private captureSelection(state: EditorState) {
    const main = state.selection.main;
    this.selection = {
      anchorByte: this.mapping.localToGlobalByte(main.anchor, 'left'),
      headByte: this.mapping.localToGlobalByte(main.head, 'left'),
    };
    this.scrollAnchor = {
      byteOffset: Math.min(this.selection.anchorByte, this.selection.headByte),
      line: this.currentWindow.startLine + state.doc.lineAt(main.head).number - 1,
    };
    this.viewport.setSelectionPins([this.selection.anchorByte, this.selection.headByte]);
  }

  private createLocalSelection(mapping: WindowPositionMapping) {
    if (!this.selection) return EditorSelection.single(0);
    const { anchorByte, headByte } = this.selection;
    return EditorSelection.single(
      globalByteToVisibleLocal(mapping, anchorByte),
      globalByteToVisibleLocal(mapping, headByte),
    );
  }

  private handleAppliedEdits(result: ApplySegmentedEditsResult) {
    const acknowledged = this.pendingEditSnapshots.shift();
    if (acknowledged) {
      this.acknowledgedWindow = { ...acknowledged.window, revision: result.revision };
      this.acknowledgedByteLength = acknowledged.byteLength;
    }
    this.revision = result.revision;
    // edit ack 可能晚于 save result，持久化水位只能单调推进。
    this.persistedRevision = Math.max(this.persistedRevision, result.persistedRevision);
    // 后端会增量合并或重建该 revision 的行索引；先降为 pending，再由事件/轮询恢复真实进度。
    this.indexProgress = 0;
    this.canUndo = true;
    this.canRedo = false;
    this.currentWindow = { ...this.currentWindow, revision: result.revision };
    this.viewport.setRevision(this.revision, this.byteLength, this.currentWindow);
    this.emitMetadata();
  }

  /**
   * 后端拒绝过大事务或报告 revision-conflict 后，原批次坐标无法靠原地重试变合法。
   * 丢弃该 batcher 并回到最后一次 ack 的窗口，避免 retryRequired 永久卡住后续 flush。
   */
  private recoverFromRejectedEdit(failedBatcher: SegmentedEditBatcher) {
    if (this.destroyed || failedBatcher !== this.editBatcher) return;

    failedBatcher.destroy();
    this.pendingEditSnapshots.length = 0;
    this.editBatcher = this.createEditBatcher(this.revision);
    this.byteLength = this.acknowledgedByteLength;
    this.selection = clampSelection(this.selection, this.byteLength);
    if (this.scrollAnchor) {
      this.scrollAnchor = {
        ...this.scrollAnchor,
        byteOffset: Math.min(this.scrollAnchor.byteOffset, this.byteLength),
      };
    }

    const rollbackWindow = { ...this.acknowledgedWindow, revision: this.revision };
    this.viewport.setRevision(this.revision, this.byteLength);
    this.applyWindow(rollbackWindow, false);
    this.viewport.seedWindow(rollbackWindow);
  }

  private async refreshSessionStatus() {
    const status = await this.port.getStatus(this.options.session.sessionId);
    if (status.sessionId !== this.options.session.sessionId) {
      throw new Error(`session status 返回了其他会话：${status.sessionId}`);
    }
    if (status.revision < this.revision) {
      return;
    }
    this.reportBaselineError(status.baselineError);

    this.persistedRevision = Math.max(this.persistedRevision, status.persistedRevision);
    this.updateSessionMetadata(status.encoding, status.lineEnding, status.readonly);
    if (this.editBatcher.hasPendingEdits) {
      // status 可能早于或晚于在途 edit ack；pending 期间只接受会话级安全元数据，
      // byteLength、revision、历史能力和索引均等待 ack 后的同 revision 事件更新。
      this.emitMetadata();
      return;
    }

    this.canUndo = status.canUndo;
    this.canRedo = status.canRedo;
    this.indexProgress = status.completed
      ? 1
      : status.totalBytes > 0
        ? status.indexedBytes / status.totalBytes
        : 0;
    if (status.revision > this.revision) {
      await this.reloadRevision(status.revision, status.byteLength, this.indexProgress);
      return;
    }
    this.byteLength = status.byteLength;
    this.emitMetadata();
  }

  private async applyHistoryResult(result: SegmentedHistoryResult) {
    if (result.revision < this.revision) {
      throw new Error(`历史命令返回倒退 revision：${result.revision}/${this.revision}`);
    }
    this.persistedRevision = result.persistedRevision;
    this.canUndo = result.canUndo;
    this.canRedo = result.canRedo;
    if (!result.changed) {
      if (result.revision !== this.revision) {
        throw new Error('未变化的历史结果不能推进 revision');
      }
      this.byteLength = result.byteLength;
      this.emitMetadata();
      return false;
    }
    await this.reloadRevision(result.revision, result.byteLength);
    return true;
  }

  /** revision 变化后旧窗口与缓存全部失效，只保留全局选区端点并按新 revision 重读。 */
  private async reloadRevision(revision: number, byteLength: number, indexProgress = 0) {
    if (!Number.isSafeInteger(revision) || revision <= this.revision) {
      throw new RangeError('重载 revision 必须单调递增');
    }
    if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
      throw new RangeError('byteLength 必须是非负安全整数');
    }
    const reloadStart = Math.min(this.currentWindow.startByte, byteLength);
    this.revision = revision;
    this.byteLength = byteLength;
    this.indexProgress = indexProgress;
    this.editBatcher.setBaseRevision(revision);
    this.viewport.setRevision(revision, byteLength);

    const placeholder: SegmentedWindow = {
      revision,
      startByte: reloadStart,
      endByte: reloadStart,
      startLine: this.currentWindow.startLine,
      text: '',
      leadingPartialLine: reloadStart > 0,
      trailingPartialLine: reloadStart < byteLength,
      indexProgress,
    };
    this.applyWindow(placeholder);
    return this.loadWindow(reloadStart);
  }

  private updateSessionMetadata(
    encoding: SegmentedEncoding,
    lineEnding: SegmentedLineEnding,
    readonly: boolean,
  ) {
    const nextReadonly = readonly || encoding === 'unsupported';
    const changed =
      encoding !== this.encoding ||
      lineEnding !== this.lineEnding ||
      nextReadonly !== this.backendReadonlyDocument;
    this.encoding = encoding;
    this.lineEnding = lineEnding;
    this.backendReadonlyDocument = nextReadonly;
    if (!nextReadonly && this.currentWindow.utf16ByteOffsets !== undefined) {
      // 校验成功只改变了后端读取语义；当前窗口仍是 lossy 映射，必须保持只读直到精确重读完成。
      this.validationUnlockPending = true;
      this.readonlyDocument = true;
      this.startExactWindowRefreshBeforeValidationUnlock();
      return;
    }

    this.validationUnlockPending = false;
    this.readonlyDocument = nextReadonly;
    if (!changed || !this.view) return;
    if (this.compositionActive || this.view.composing) {
      this.metadataReconfigurePending = true;
      return;
    }
    this.view.setState(this.createEditorState(this.mapping, this.currentWindow));
  }

  private applyPendingMetadataReconfigure() {
    if (!this.metadataReconfigurePending || this.destroyed) return;
    this.metadataReconfigurePending = false;
    this.view.setState(this.createEditorState(this.mapping, this.currentWindow));
  }

  private queueHistoryAction(action: 'undo' | 'redo') {
    const operation = this.enqueueHistoryAction(action);
    void operation.catch((error) => this.options.onError?.(error));
    return true;
  }

  private enqueueHistoryAction(action: 'undo' | 'redo') {
    if (this.exclusiveTaskLocked) {
      return Promise.resolve(false);
    }
    this.historyQueueDepth += 1;
    this.setHistoryLocked(true);
    const operation = this.historyTail.then(() => this.runHistoryAction(action));
    // 失败只结束当前命令，后续已排队命令仍按届时的真实 revision 决定结果。
    this.historyTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation.finally(() => {
      this.historyQueueDepth -= 1;
      if (this.historyQueueDepth === 0) {
        this.setHistoryLocked(false);
      }
    });
  }

  private async runHistoryAction(action: 'undo' | 'redo') {
    this.assertAlive();
    await this.editBatcher.flush();
    const result =
      action === 'undo'
        ? await this.port.undoRevision(this.options.session.sessionId, this.revision)
        : await this.port.redoRevision(this.options.session.sessionId, this.revision);
    return this.applyHistoryResult(result);
  }

  private setHistoryLocked(locked: boolean) {
    if (this.historyLocked === locked) return;
    this.historyLocked = locked;
    this.reconfigureEditability();
  }

  private isInteractionLocked() {
    return this.historyLocked || this.exclusiveTaskLocked;
  }

  private reconfigureEditability() {
    if (this.destroyed || !this.view) return;
    // Compartment reconfigure 保留 doc、selection 与 scroll DOM，不为短暂只读重建整个窗口。
    this.view.dispatch({
      effects: this.editabilityCompartment.reconfigure(this.createEditabilityExtensions()),
    });
  }

  private receiveWindow(window: SegmentedWindow) {
    if (this.compositionActive || this.view?.composing) {
      this.deferredWindow = window;
      return;
    }
    this.applyWindow(window);
    this.finishValidationUnlockWithExactWindow(window);
  }

  private applyWindow(window: SegmentedWindow, captureCurrentSelection = true) {
    if (window.revision !== this.revision) return;
    const sameWindow = hasSameVisibleContent(this.currentWindow, window);
    if (sameWindow) {
      const progressChanged = this.indexProgress !== window.indexProgress;
      this.currentWindow = window;
      this.indexProgress = window.indexProgress;
      this.rememberAcknowledgedWindow();
      if (progressChanged) this.emitMetadata();
      return;
    }
    if (captureCurrentSelection && !this.selectionExtendsOutsideCurrentWindow()) {
      this.captureSelection(this.view.state);
    }
    this.currentWindow = window;
    this.mapping = createWindowPositionMapping(window);
    this.indexProgress = window.indexProgress;
    this.view.setState(this.createEditorState(this.mapping, window));
    this.rememberAcknowledgedWindow();
    this.emitMetadata();
  }

  private rememberAcknowledgedWindow() {
    if (this.pendingEditSnapshots.length > 0 || this.editBatcher.hasPendingEdits) return;
    this.acknowledgedWindow = { ...this.currentWindow };
    this.acknowledgedByteLength = this.byteLength;
  }

  private applyDeferredWindowAfterComposition() {
    const deferred = this.deferredWindow;
    this.deferredWindow = undefined;
    if (!deferred || this.destroyed) return;

    void this.editBatcher
      .flush()
      .then(() => {
        if (this.destroyed) return;
        if (deferred.revision === this.revision) {
          this.applyWindow(deferred);
          this.finishValidationUnlockWithExactWindow(deferred);
        } else {
          void this.loadWindow(deferred.startByte).catch((error) => this.options.onError?.(error));
        }
      })
      .catch((error) => this.options.onError?.(error));
  }

  /**
   * 初始编码校验完成后，同 revision 的缓存仍可能保存按字节 lossy 解码的窗口。
   * 先按当前全局锚点精确重读；读取失败或销毁时继续只读，绝不拿旧映射开放编辑。
   */
  private startExactWindowRefreshBeforeValidationUnlock() {
    if (
      this.destroyed ||
      !this.validationUnlockPending ||
      this.validationRefreshPromise ||
      this.compositionActive ||
      this.view?.composing
    ) {
      return;
    }

    const anchor = Math.min(
      this.scrollAnchor?.byteOffset ?? this.currentWindow.startByte,
      this.byteLength,
    );
    this.viewport.invalidateCurrentRevisionCache();
    let retryAfterStale = false;
    const refresh = this.viewport
      .loadWindow(anchor)
      .then((result) => {
        if (this.destroyed || !this.validationUnlockPending) return;
        if (result.status === 'stale') {
          // 另一主读取抢占时，由其精确窗口完成解锁；没有窗口时下一轮再主动重读。
          if (!this.viewport.getCurrentWindow()) {
            retryAfterStale = true;
          }
          return;
        }
        if (result.window?.utf16ByteOffsets !== undefined) {
          throw new Error('UTF-8 校验完成后仍返回 lossy 窗口，编辑保持只读');
        }
      })
      .catch((error) => {
        if (!this.destroyed) this.options.onError?.(error);
      })
      .finally(() => {
        if (this.validationRefreshPromise === refresh) {
          this.validationRefreshPromise = null;
        }
        if (retryAfterStale && !this.destroyed && this.validationUnlockPending) {
          queueMicrotask(() => this.startExactWindowRefreshBeforeValidationUnlock());
        }
      });
    this.validationRefreshPromise = refresh;
  }

  private finishValidationUnlockWithExactWindow(window: SegmentedWindow) {
    if (
      this.destroyed ||
      !this.validationUnlockPending ||
      window.revision !== this.revision ||
      window.utf16ByteOffsets !== undefined
    ) {
      return;
    }
    this.validationUnlockPending = false;
    this.readonlyDocument = false;
    // applyWindow 已用精确窗口重建 mapping；此处只切换编辑权限，避免再重建正文。
    this.reconfigureEditability();
    this.emitMetadata();
  }

  private async registerProgressListeners() {
    try {
      const [indexUnlisten, taskUnlisten] = await Promise.all([
        this.port.listenIndexProgress(this.options.session.sessionId, (progress) => {
          if (progress.revision !== this.revision) return;
          this.reportBaselineError(progress.baselineError);
          this.indexProgress = progress.completed
            ? 1
            : progress.totalBytes > 0
              ? progress.indexedBytes / progress.totalBytes
              : 0;
          this.updateSessionMetadata(
            progress.encoding ?? this.encoding,
            progress.lineEnding ?? this.lineEnding,
            // 缺字段表示后端只报告索引进度；不能把 exact-reread 的临时只读门禁回灌成后端状态。
            progress.readonly ?? this.backendReadonlyDocument,
          );
          this.options.onIndexProgress?.(progress);
          this.emitMetadata();
        }),
        this.port.listenTaskProgress(this.options.session.sessionId, (progress) => {
          this.options.onTaskProgress?.(progress);
        }),
      ]);
      if (this.destroyed) {
        indexUnlisten();
        taskUnlisten();
      } else {
        this.unlisteners.push(indexUnlisten, taskUnlisten);
      }
    } catch (error) {
      this.options.onError?.(error);
    }
  }

  private reportBaselineError(message?: string) {
    const normalized = message?.trim() || null;
    if (!normalized) {
      this.reportedBaselineError = null;
      return;
    }
    if (normalized === this.reportedBaselineError) return;
    this.reportedBaselineError = normalized;
    this.options.onError?.(new Error(normalized));
  }

  private emitMetadata() {
    if (!this.destroyed) {
      this.options.onMetadataChange?.(this.getMetadata());
    }
  }

  private dispatchVisibleGlobalSelection() {
    this.applyingGlobalSelection = true;
    try {
      this.view.dispatch({ selection: this.createLocalSelection(this.mapping) });
    } finally {
      this.applyingGlobalSelection = false;
    }
  }

  private isEntireDocumentSelected() {
    if (!this.selection) return false;
    const start = Math.min(this.selection.anchorByte, this.selection.headByte);
    const end = Math.max(this.selection.anchorByte, this.selection.headByte);
    return start === 0 && end === this.byteLength;
  }

  private selectionExtendsOutsideCurrentWindow() {
    if (!this.selection) return false;
    return selectionExtendsOutsideMapping(this.selection, this.mapping);
  }

  private assertAlive() {
    if (this.destroyed) {
      throw new Error('SegmentedTextEditorCore 已销毁');
    }
  }
}

function selectionExtendsOutsideMapping(
  selection: GlobalSelection,
  mapping: WindowPositionMapping,
) {
  return (
    selection.anchorByte < mapping.startByte ||
    selection.anchorByte > mapping.endByte ||
    selection.headByte < mapping.startByte ||
    selection.headByte > mapping.endByte
  );
}

function clampSelection(selection: GlobalSelection | null, byteLength: number) {
  if (!selection) return null;
  return {
    anchorByte: Math.min(selection.anchorByte, byteLength),
    headByte: Math.min(selection.headByte, byteLength),
  };
}

function hasSameVisibleContent(left: SegmentedWindow, right: SegmentedWindow) {
  return (
    left.revision === right.revision &&
    left.startByte === right.startByte &&
    left.endByte === right.endByte &&
    left.startLine === right.startLine &&
    left.text === right.text &&
    left.leadingPartialLine === right.leadingPartialLine &&
    left.trailingPartialLine === right.trailingPartialLine &&
    left.longLine === right.longLine &&
    (left.utf16ByteOffsets === undefined) === (right.utf16ByteOffsets === undefined) &&
    left.jsonLexicalState === right.jsonLexicalState
  );
}

function utf8ByteLength(text: string) {
  return new TextEncoder().encode(text).byteLength;
}

function isRecoverableEditRejection(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === 'edit-transaction-too-large' || code === 'revision-conflict') return true;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.includes('edit-transaction-too-large') || message.includes('revision-conflict');
}

function globalByteToVisibleLocal(mapping: WindowPositionMapping, globalByte: number) {
  if (globalByte <= mapping.startByte) return 0;
  if (globalByte >= mapping.endByte) return mapping.editorText.length;
  return mapping.globalByteToLocal(globalByte, 'left');
}

function createJsonHighlightExtension(
  initialState: OpenSegmentedDocumentResult['firstWindow']['jsonLexicalState'],
  maxLineLength: number,
): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildJsonDecorations(view, initialState, maxLineLength);
        }

        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            this.decorations = buildJsonDecorations(update.view, initialState, maxLineLength);
          }
        }
      },
      { decorations: (plugin) => plugin.decorations },
    ),
    jsonHighlightTheme,
  ];
}

function buildJsonDecorations(
  view: EditorView,
  initialState: OpenSegmentedDocumentResult['firstWindow']['jsonLexicalState'],
  maxLineLength: number,
) {
  const result = lexJsonWindow(view.state.doc.toString(), initialState, { maxLineLength });
  return Decoration.set(
    result.tokens.map((token) =>
      Decoration.mark({ class: `cm-segmented-json-${token.type}` }).range(token.from, token.to),
    ),
    true,
  );
}

const tokenColors: Record<JsonTokenType, string> = {
  string: 'var(--md-editor-code-string, #22863a)',
  number: 'var(--md-editor-code-number, #005cc5)',
  boolean: 'var(--md-editor-code-keyword, #d73a49)',
  null: 'var(--md-editor-code-keyword, #d73a49)',
  punctuation: 'var(--md-editor-muted-fg, #6a737d)',
};

const jsonHighlightTheme = EditorView.baseTheme({
  '.cm-segmented-json-string': { color: tokenColors.string },
  '.cm-segmented-json-number': { color: tokenColors.number },
  '.cm-segmented-json-boolean': { color: tokenColors.boolean },
  '.cm-segmented-json-null': { color: tokenColors.null },
  '.cm-segmented-json-punctuation': { color: tokenColors.punctuation },
});

const segmentedEditorTheme = EditorView.baseTheme({
  '&': { height: '100%' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--md-editor-monospace-font, monospace)' },
  '.cm-content': { minHeight: '100%' },
});
