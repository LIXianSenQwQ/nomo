<script lang="ts">
  import {
    Braces,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    LoaderCircle,
    Search,
    Square,
    WandSparkles,
    X,
  } from '@lucide/svelte';
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';
  import {
    SegmentedTextEditorCore,
    type SegmentedEditorMetadata,
  } from '../../lib/text-editor/SegmentedTextEditorCore';
  import type {
    OpenSegmentedDocumentResult,
    SegmentedIndexProgress,
    SegmentedMatchRange,
    SegmentedTaskProgress,
    SegmentedTaskSpec,
    SegmentedTaskType,
  } from '../../lib/text-editor/protocol';
  import { segmentedSessionRegistry } from '../../lib/text-editor/sessionRegistry';
  import { createTauriSegmentedDocumentPort } from '../../lib/text-editor/tauriPort';
  import type { SegmentedTextTabState } from '../types';
  import { t } from '../i18n';
  import {
    classifySegmentedTaskProgress,
    estimateTotalLinesFromProgress,
    getAdjacentSegmentStart,
    resolveSegmentWindowStart,
    type SegmentDirection,
    type SegmentedTaskIdentity,
  } from './segmentedWorkspaceState';

  export let interfaceLocale: string;
  export let tab: SegmentedTextTabState;
  export let autoSaveEnabled: boolean;
  export let autoSaveDelayMs: number;

  const dispatch = createEventDispatcher<{
    stateChange: SegmentedEditorMetadata;
    externalChange: void;
    status: { message: string };
  }>();
  const port = createTauriSegmentedDocumentPort();
  const WINDOW_BYTES = 256 * 1024;
  const LINE_HEIGHT = 22;
  const MAX_VIRTUAL_HEIGHT = 16_000_000;

  interface ActiveTask extends SegmentedTaskIdentity {
    terminal: Promise<void>;
    resolveTerminal: () => void;
  }

  interface PendingTaskLaunch {
    baseRevision: number;
    kind: SegmentedTaskType;
    earlyProgressByTaskId: Map<string, SegmentedTaskProgress>;
  }

  let host: HTMLDivElement;
  let scroller: HTMLDivElement;
  let searchInput: HTMLInputElement;
  let core: SegmentedTextEditorCore | null = null;
  let metadata: SegmentedEditorMetadata | null = null;
  let viewportHeight = 0;
  let windowVisualHeight = 0;
  let estimatedLines = 1;
  let topSpacerHeight = 0;
  let bottomSpacerHeight = 0;
  let loading = true;
  let errorMessage = '';
  let statusMessage = '';
  let searchOpen = false;
  let replaceVisible = false;
  let query = '';
  let replacement = '';
  let nearbyMatches: SegmentedMatchRange[] = [];
  let nearbyMatchesRevision: number | null = null;
  let activeNearbyIndex = 0;
  let taskProgress: SegmentedTaskProgress | null = null;
  let activeTask: ActiveTask | null = null;
  let pendingTaskLaunch: PendingTaskLaunch | null = null;
  let queuedTaskRequest: SegmentedTaskSpec | null = null;
  let taskLaunchPromise: Promise<void> | null = null;
  let taskLaunchSequence = 0;
  const terminalTaskIds = new Set<string>();
  let exclusiveTaskLockHeld = false;
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let indexPollTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollFrame: number | null = null;
  let destroyed = false;
  let readRequestId = 1;
  let segmentNavigationLoading = false;

  $: indexPercent = Math.round((metadata?.indexProgress ?? tab.indexProgress) * 100);
  $: taskPercent = taskProgress?.totalBytes
    ? Math.round((taskProgress.processedBytes / taskProgress.totalBytes) * 100)
    : 0;
  $: sessionMetadata = segmentedSessionRegistry.get(tab.sessionId);
  $: readonly = metadata?.readonly ?? sessionMetadata?.readonly ?? tab.diskReadonly;
  $: unsupportedEncoding = (metadata?.encoding ?? sessionMetadata?.encoding) === 'unsupported';
  $: segmentNavigationVisible =
    (metadata?.byteLength ?? sessionMetadata?.byteLength ?? 0) > WINDOW_BYTES;
  $: previousSegmentDisabled =
    segmentNavigationLoading || !metadata || metadata.visibleStartByte <= 0;
  $: nextSegmentDisabled =
    segmentNavigationLoading || !metadata || metadata.visibleEndByte >= metadata.byteLength;
  $: segmentRangeText = metadata ? formatSegmentRange(metadata) : '';
  $: segmentCopy = getSegmentNavigationCopy(interfaceLocale);
  $: if (!autoSaveEnabled || readonly || tab.externalFileChange.type !== 'none') {
    clearAutoSaveTimer();
  }

  onMount(() => {
    void mountCore();
  });

  onDestroy(() => {
    destroyed = true;
    clearAutoSaveTimer();
    clearIndexPollTimer();
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    if (activeTask && taskProgress?.state === 'running') {
      void port.cancelTask(activeTask.taskId).catch(() => undefined);
    }
    releaseExclusiveTaskLock();
    activeTask?.resolveTerminal();
    activeTask = null;
    pendingTaskLaunch = null;
    queuedTaskRequest = null;
    const activeCore = core;
    core = null;
    if (activeCore) {
      // App 的切换/关闭路径会先 await flush；这里仍补一次非阻塞刷新以覆盖宿主直接销毁。
      void activeCore
        .flush()
        .catch(() => undefined)
        .finally(() => activeCore.destroy());
    }
  });

  async function mountCore() {
    try {
      const session = await resolveSession();
      if (destroyed) return;
      core = new SegmentedTextEditorCore({
        host,
        session,
        port,
        selection: tab.selection,
        scrollAnchor: tab.scrollAnchor,
        onMetadataChange: handleMetadataChange,
        onIndexProgress: handleIndexProgress,
        onTaskProgress: handleTaskProgress,
        onCopyAllRequested: () => void startTask('select-all-copy'),
        onError: showError,
      });
      await core.ready();
      if (destroyed) return;
      ensureIndexPolling();
      loading = false;
      estimatedLines = estimateInitialLines(session);
      await tick();
      updateVirtualGeometry();
      restoreScrollAnchor(session.byteLength);
      core.focus();
    } catch (error) {
      showError(error);
      loading = false;
    }
  }

  async function resolveSession(): Promise<OpenSegmentedDocumentResult> {
    const session = segmentedSessionRegistry.get(tab.sessionId);
    if (!session) {
      throw new Error(`Segmented session metadata missing: ${tab.sessionId}`);
    }
    const startByte = resolveSegmentWindowStart(
      tab.scrollAnchor?.byteOffset ?? 0,
      session.byteLength,
      WINDOW_BYTES,
    );
    const firstWindow =
      segmentedSessionRegistry.consumeFirstWindow(tab.sessionId) ??
      (await port.readWindow({
        sessionId: tab.sessionId,
        revision: tab.revision,
        startByte,
        targetBytes: WINDOW_BYTES,
        requestId: readRequestId++,
      }));
    return { ...session, firstWindow };
  }

  function handleMetadataChange(next: SegmentedEditorMetadata) {
    metadata = next;
    if (nearbyMatchesRevision !== null && nearbyMatchesRevision !== next.revision) {
      nearbyMatches = [];
      nearbyMatchesRevision = null;
      activeNearbyIndex = 0;
    }
    segmentedSessionRegistry.update(tab.sessionId, {
      revision: next.revision,
      persistedRevision: next.persistedRevision,
      byteLength: next.byteLength,
      encoding: next.encoding,
      lineEnding: next.lineEnding,
      readonly: next.readonly,
    });
    dispatch('stateChange', next);
    void tick().then(updateVirtualGeometry);
    scheduleAutoSave(next);
    ensureIndexPolling();
    maybeStartQueuedTask(next.indexProgress);
  }

  function handleIndexProgress(progress: SegmentedIndexProgress) {
    estimatedLines = estimateTotalLinesFromProgress(progress, estimatedLines);
    if (progress.completed) {
      statusMessage = t.indexReady();
    }
    updateVirtualGeometry();
    maybeStartQueuedTask(progress.completed ? 1 : (metadata?.indexProgress ?? 0));
  }

  function handleTaskProgress(progress: SegmentedTaskProgress) {
    const currentTask = activeTask;
    if (currentTask) {
      void consumeTaskProgress(currentTask, progress);
      return;
    }

    const pending = pendingTaskLaunch;
    if (
      pending &&
      progress.sessionId === tab.sessionId &&
      progress.baseRevision === pending.baseRevision &&
      progress.kind === pending.kind
    ) {
      // 极短任务可能先发 completed、后让 start invoke 返回；按 taskId 只保留该任务最新事件。
      pending.earlyProgressByTaskId.set(progress.taskId, progress);
    }
  }

  async function consumeTaskProgress(identity: ActiveTask, progress: SegmentedTaskProgress) {
    const currentRevision = core?.getMetadata().revision ?? -1;
    const decision = classifySegmentedTaskProgress(identity, progress, currentRevision);
    if (!decision.accepted || terminalTaskIds.has(progress.taskId)) return;

    if (decision.resultCurrent) {
      taskProgress = progress;
      if (progress.nearbyMatches?.length) {
        nearbyMatches = progress.nearbyMatches;
        nearbyMatchesRevision = identity.baseRevision;
        const currentIndex = progress.currentMatch
          ? nearbyMatches.findIndex(
              (match) =>
                match.startByte === progress.currentMatch?.startByte &&
                match.endByte === progress.currentMatch.endByte,
            )
          : -1;
        activeNearbyIndex =
          currentIndex >= 0 ? currentIndex : Math.min(activeNearbyIndex, nearbyMatches.length - 1);
      }
    } else {
      // revision 已变化时仍接收终态以解除等待，但旧命中、计数和结果不得污染当前文档。
      taskProgress = {
        ...progress,
        matchCount: 0,
        currentMatch: undefined,
        nearbyMatches: [],
      };
      nearbyMatches = [];
      nearbyMatchesRevision = null;
      activeNearbyIndex = 0;
    }

    if (!decision.terminal) return;
    terminalTaskIds.add(progress.taskId);
    try {
      if (progress.state === 'completed' && decision.resultCurrent) {
        await finishCompletedTask(progress);
      } else if (progress.state === 'failed' || progress.state === 'conflict') {
        statusMessage = t.segmentedTaskFailed({ error: progress.message ?? progress.state });
      }
    } catch (error) {
      showError(error);
    } finally {
      terminalTaskIds.delete(progress.taskId);
      if (activeTask === identity) activeTask = null;
      if (isExclusiveWriteTask(identity.kind)) releaseExclusiveTaskLock();
      identity.resolveTerminal();
    }
  }

  async function finishCompletedTask(progress: SegmentedTaskProgress) {
    if (
      (progress.kind === 'replace-all' || progress.kind === 'json-format') &&
      progress.resultRevision !== undefined
    ) {
      await core?.applyTaskResult(progress.resultRevision, progress.resultByteLength);
    }
    if (progress.kind === 'search' && progress.currentMatch) {
      // 搜索只在冻结 revision 仍为当前状态时跳转；consumeTaskProgress 已完成该校验。
      await revealSearchMatch(progress.currentMatch);
    }
    if (progress.kind === 'json-validate') {
      statusMessage = progress.message || t.jsonValid();
    } else if (progress.kind === 'select-all-copy') {
      const message = progress.message || t.fullDocumentCopied();
      // 剪贴板不可用时 Rust 返回有界生命周期的临时文件；路径必须可见，否则 fallback 无法使用。
      statusMessage =
        progress.outputPath && !message.includes(progress.outputPath)
          ? `${message}: ${progress.outputPath}`
          : message;
    } else if (progress.kind === 'replace-all') {
      statusMessage = t.replacedMatchCount({ count: progress.matchCount });
    } else if (progress.kind === 'json-format') {
      statusMessage = progress.message || t.jsonFormatted();
    }
    if (statusMessage) dispatch('status', { message: statusMessage });
  }

  function estimateInitialLines(session: OpenSegmentedDocumentResult) {
    const visibleLines = Math.max(1, session.firstWindow.text.split(/\r?\n/).length);
    const visibleBytes = Math.max(1, session.firstWindow.endByte - session.firstWindow.startByte);
    return Math.max(visibleLines, Math.ceil((visibleLines / visibleBytes) * session.byteLength));
  }

  function updateVirtualGeometry() {
    if (!metadata || !scroller) return;
    windowVisualHeight = Math.max(
      viewportHeight,
      host?.scrollHeight || viewportHeight,
      LINE_HEIGHT,
    );
    const totalHeight = Math.max(
      viewportHeight,
      Math.min(MAX_VIRTUAL_HEIGHT, Math.max(estimatedLines * LINE_HEIGHT, windowVisualHeight)),
    );
    const availableHeight = Math.max(0, totalHeight - windowVisualHeight);
    const ratio = metadata.byteLength > 0 ? metadata.visibleStartByte / metadata.byteLength : 0;
    topSpacerHeight = Math.round(availableHeight * Math.min(1, Math.max(0, ratio)));
    bottomSpacerHeight = Math.max(0, availableHeight - topSpacerHeight);
  }

  function restoreScrollAnchor(byteLength: number) {
    if (!scroller || !tab.scrollAnchor || byteLength <= 0) return;
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    scroller.scrollTop = (tab.scrollAnchor.byteOffset / byteLength) * maxScroll;
  }

  function handleVirtualScroll() {
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      const current = metadata;
      if (!core || !current || current.byteLength <= 0) return;
      const maxScroll = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
      const targetByte = resolveSegmentWindowStart(
        Math.round((scroller.scrollTop / maxScroll) * current.byteLength),
        current.byteLength,
        WINDOW_BYTES,
      );
      const margin = Math.max(
        4096,
        Math.floor((current.visibleEndByte - current.visibleStartByte) / 5),
      );
      if (
        targetByte < current.visibleStartByte + margin ||
        targetByte > current.visibleEndByte - margin
      ) {
        const activeCore = core;
        const targetLine = estimateLineForByte(targetByte, current.byteLength, estimatedLines);
        loading = true;
        void activeCore
          .loadWindow(targetByte)
          .then((result) => {
            if (result.status !== 'stale' && !destroyed && core === activeCore) {
              activeCore.setScrollAnchor(result.startByte ?? targetByte, targetLine);
            }
          })
          .catch(showError)
          .finally(() => {
            loading = false;
          });
      }
    });
  }

  function handleWorkspaceKeydown(event: KeyboardEvent) {
    if (event.altKey && (event.key === 'PageUp' || event.key === 'PageDown')) {
      event.preventDefault();
      void loadAdjacentSegment(event.key === 'PageUp' ? 'previous' : 'next');
      return;
    }
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier) return;
    const key = event.key.toLowerCase();
    if (key === 'f') {
      event.preventDefault();
      openSearch(false);
    } else if (key === 'h') {
      event.preventDefault();
      openSearch(true);
    } else if (key === 'a') {
      event.preventDefault();
      core?.selectAll();
    } else if (key === 'c' && isEntireDocumentSelected()) {
      event.preventDefault();
      void startTask('select-all-copy');
    }
  }

  function isEntireDocumentSelected() {
    const current = core?.getMetadata();
    if (!current?.selection) return false;
    const { anchorByte, headByte } = current.selection;
    return (
      Math.min(anchorByte, headByte) === 0 && Math.max(anchorByte, headByte) === current.byteLength
    );
  }

  function startTask(type: SegmentedTaskType) {
    if ((type === 'search' || type === 'replace-all') && !query) return Promise.resolve();
    const request: SegmentedTaskSpec = {
      type,
      query: query || undefined,
    };
    if (type === 'replace-all') {
      // 空字符串是“删除全部命中”的有效 replacement，不能按缺省参数丢弃。
      request.replacement = replacement;
    }
    if ((metadata?.indexProgress ?? 0) < 1) {
      // 后发请求替换旧等待项；只保存参数，不保存正文或旧 revision。
      queuedTaskRequest = request;
      statusMessage = t.indexRequired();
      return Promise.resolve();
    }
    return launchTask(request);
  }

  function launchTask(request: SegmentedTaskSpec) {
    if (taskLaunchPromise) return taskLaunchPromise;
    const launchSequence = ++taskLaunchSequence;
    taskLaunchPromise = runStartTask(request).finally(() => {
      if (taskLaunchSequence === launchSequence) taskLaunchPromise = null;
    });
    return taskLaunchPromise;
  }

  async function runStartTask(request: SegmentedTaskSpec) {
    const type = request.type;
    const exclusiveWrite = isExclusiveWriteTask(type);
    let acquiredExclusiveLock = false;
    try {
      if (!core) return;
      await cancelActiveTaskAndWait();
      if (exclusiveWrite) {
        // 先冻结编辑和历史，再 flush 启动基线；否则 flush 后到 start invoke 之间仍会漏入新 revision。
        acquireExclusiveTaskLock();
        acquiredExclusiveLock = true;
      }
      const current = await core.flush();
      if (current.indexProgress < 1) {
        if (acquiredExclusiveLock) releaseExclusiveTaskLock();
        queuedTaskRequest = request;
        statusMessage = t.indexRequired();
        return;
      }
      const pending: PendingTaskLaunch = {
        baseRevision: current.revision,
        kind: type,
        earlyProgressByTaskId: new Map(),
      };
      pendingTaskLaunch = pending;
      const result = await port.startTask({
        sessionId: tab.sessionId,
        baseRevision: current.revision,
        task: request,
      });
      if (destroyed) {
        pendingTaskLaunch = null;
        if (acquiredExclusiveLock) releaseExclusiveTaskLock();
        await port.cancelTask(result.taskId).catch(() => undefined);
        return;
      }
      let resolveTerminal: () => void = () => {};
      const terminal = new Promise<void>((resolve) => {
        resolveTerminal = resolve;
      });
      const identity: ActiveTask = {
        sessionId: tab.sessionId,
        taskId: result.taskId,
        baseRevision: current.revision,
        kind: type,
        terminal,
        resolveTerminal,
      };
      activeTask = identity;
      if (request.type !== 'search' || request.anchorByte === undefined) {
        nearbyMatches = [];
        nearbyMatchesRevision = null;
        activeNearbyIndex = 0;
      }
      taskProgress = {
        sessionId: tab.sessionId,
        taskId: result.taskId,
        baseRevision: current.revision,
        kind: type,
        state: 'running',
        processedBytes: 0,
        totalBytes: current.byteLength,
        matchCount: 0,
      };
      const earlyProgress = pending.earlyProgressByTaskId.get(result.taskId);
      if (pendingTaskLaunch === pending) pendingTaskLaunch = null;
      if (earlyProgress) await consumeTaskProgress(identity, earlyProgress);
    } catch (error) {
      pendingTaskLaunch = null;
      if (acquiredExclusiveLock) releaseExclusiveTaskLock();
      showError(error);
    }
  }

  function isExclusiveWriteTask(type: SegmentedTaskType) {
    return type === 'replace-all' || type === 'json-format';
  }

  function acquireExclusiveTaskLock() {
    if (exclusiveTaskLockHeld || !core) return;
    core.setExclusiveTaskLocked(true);
    exclusiveTaskLockHeld = true;
  }

  function releaseExclusiveTaskLock() {
    if (!exclusiveTaskLockHeld) return;
    exclusiveTaskLockHeld = false;
    core?.setExclusiveTaskLocked(false);
  }

  async function cancelTask() {
    if (queuedTaskRequest) {
      queuedTaskRequest = null;
      statusMessage = '';
      return;
    }
    const identity = activeTask;
    if (!identity || taskProgress?.state !== 'running') return;
    try {
      await port.cancelTask(identity.taskId);
    } catch (error) {
      showError(error);
    }
  }

  async function cancelActiveTaskAndWait() {
    const identity = activeTask;
    if (!identity) return;
    if (taskProgress?.taskId === identity.taskId && taskProgress.state === 'running') {
      await port.cancelTask(identity.taskId);
    }
    // 新任务必须等待旧任务的 terminal event 被消费完，避免旧结果与新状态交叉。
    await identity.terminal;
  }

  function maybeStartQueuedTask(indexProgress: number) {
    if (destroyed || indexProgress < 1 || !queuedTaskRequest || taskLaunchPromise) return;
    const request = queuedTaskRequest;
    queuedTaskRequest = null;
    void launchTask(request);
  }

  async function loadAdjacentSegment(direction: SegmentDirection) {
    const current = metadata;
    if (!core || !current || segmentNavigationLoading) return;
    const target = getAdjacentSegmentStart(direction, current, WINDOW_BYTES);
    if (target === null) return;
    segmentNavigationLoading = true;
    loading = true;
    try {
      const result = await core.loadWindow(target);
      if (result.status !== 'stale') {
        core.setScrollAnchor(
          result.startByte ?? target,
          estimateLineForByte(target, current.byteLength, estimatedLines),
        );
      }
      core.focus();
    } catch (error) {
      showError(error);
    } finally {
      segmentNavigationLoading = false;
      loading = false;
    }
  }

  function navigateNearby(direction: -1 | 1) {
    if (
      nearbyMatches.length === 0 ||
      nearbyMatchesRevision === null ||
      core?.getMetadata().revision !== nearbyMatchesRevision ||
      activeTask ||
      taskLaunchPromise
    )
      return;
    const nextIndex = activeNearbyIndex + direction;
    if (nextIndex >= 0 && nextIndex < nearbyMatches.length) {
      activeNearbyIndex = nextIndex;
      void revealSearchMatch(nearbyMatches[activeNearbyIndex]).catch(showError);
      return;
    }
    const anchor = nearbyMatches[activeNearbyIndex];
    if (!anchor || !query) return;
    // 页边界才重新流式扫描；每一页仍只把至多 16 个附近命中送进 WebView。
    void launchTask({
      type: 'search',
      query,
      anchorByte: anchor.startByte,
      direction: direction > 0 ? 'forward' : 'backward',
    });
  }

  async function revealSearchMatch(match: SegmentedMatchRange) {
    const activeCore = core;
    if (!activeCore) return;
    const result = await activeCore.loadWindow(match.startByte);
    if (result.status === 'stale' || core !== activeCore) return;
    activeCore.setSelection({ anchorByte: match.startByte, headByte: match.endByte });
    activeCore.setScrollAnchor(
      result.startByte ?? match.startByte,
      estimateLineForByte(match.startByte, activeCore.getMetadata().byteLength, estimatedLines),
    );
    activeCore.focus();
  }

  function scheduleAutoSave(next: SegmentedEditorMetadata) {
    clearAutoSaveTimer();
    if (!autoSaveEnabled || !next.dirty || next.readonly || tab.externalFileChange.type !== 'none')
      return;
    autoSaveTimer = setTimeout(() => void runAutoSave(), autoSaveDelayMs);
  }

  async function runAutoSave() {
    // timer 建立后设置或外部冲突仍可能变化；真正写盘前必须再次验证全部门禁。
    autoSaveTimer = null;
    if (!core || !autoSaveEnabled || readonly || tab.externalFileChange.type !== 'none') return;
    try {
      // 保存只冻结已 ack revision；恢复日志快照由切换/关闭路径独立负责。
      const current = await core.flushEdits();
      const result = await port.saveRevision({
        sessionId: tab.sessionId,
        revision: current.revision,
      });
      await core.applySaveResult(result);
      statusMessage = t.saved();
    } catch (error) {
      showError(error);
    }
  }

  function clearAutoSaveTimer() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }

  function ensureIndexPolling() {
    if (destroyed || indexPollTimer || !core || (metadata?.indexProgress ?? 0) >= 1) return;
    indexPollTimer = setTimeout(() => {
      indexPollTimer = null;
      void core?.refreshIndexProgress().catch(showError).finally(ensureIndexPolling);
    }, 250);
  }

  function clearIndexPollTimer() {
    if (indexPollTimer) clearTimeout(indexPollTimer);
    indexPollTimer = null;
  }

  function formatSegmentRange(current: SegmentedEditorMetadata) {
    const formatter = new Intl.NumberFormat(interfaceLocale || undefined);
    return `${formatter.format(current.visibleStartByte)}–${formatter.format(
      current.visibleEndByte,
    )} / ${formatter.format(current.byteLength)} B`;
  }

  function estimateLineForByte(byteOffset: number, byteLength: number, totalLines: number) {
    if (byteLength <= 0 || totalLines <= 1) return 0;
    return Math.round((byteOffset / byteLength) * (totalLines - 1));
  }

  function getSegmentNavigationCopy(locale: string) {
    const normalized = locale.toLowerCase();
    if (normalized.startsWith('ja')) {
      return {
        group: 'バイト区間ナビゲーション',
        previous: '前のバイト区間（Alt+PageUp）',
        next: '次のバイト区間（Alt+PageDown）',
      };
    }
    if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk')) {
      return {
        group: '位元組分段導覽',
        previous: '上一個位元組分段（Alt+PageUp）',
        next: '下一個位元組分段（Alt+PageDown）',
      };
    }
    if (normalized.startsWith('zh')) {
      return {
        group: '字节分段导航',
        previous: '上一字节段（Alt+PageUp）',
        next: '下一字节段（Alt+PageDown）',
      };
    }
    return {
      group: 'Byte segment navigation',
      previous: 'Previous byte segment (Alt+PageUp)',
      next: 'Next byte segment (Alt+PageDown)',
    };
  }

  function showError(error: unknown) {
    errorMessage = error instanceof Error ? error.message : String(error);
    statusMessage = errorMessage;
    dispatch('status', { message: errorMessage });
  }

  export async function flushPendingEdits() {
    clearAutoSaveTimer();
    queuedTaskRequest = null;
    if (activeTask && taskProgress?.state === 'running') {
      // 后台写任务可能在取消命令返回后才到达终态；留在当前标签可保证结果 revision 被接收。
      await cancelTask();
      const error = new Error(t.segmentedTaskCancelling());
      showError(error);
      throw error;
    }
    await core?.flush();
  }

  /** 保存前只等待 edit ack，不触发独立 journal 全文快照。 */
  export async function prepareSave() {
    clearAutoSaveTimer();
    return (await core?.flushEdits()) ?? null;
  }

  /** 外部变化协调器用它识别 revision 尚未 ack 的乐观窗口。 */
  export function hasPendingEdits() {
    return core?.hasPendingEdits ?? false;
  }

  export function focus() {
    core?.focus();
  }

  export async function undo() {
    try {
      return (await core?.undo()) ?? false;
    } catch (error) {
      showError(error);
      return false;
    }
  }

  export async function redo() {
    try {
      return (await core?.redo()) ?? false;
    } catch (error) {
      showError(error);
      return false;
    }
  }

  export function openSearch(showReplace = false) {
    searchOpen = true;
    replaceVisible = showReplace;
    void tick().then(() => searchInput?.focus());
  }

  export function closeSearch() {
    searchOpen = false;
  }

  export function getSearchState() {
    return { open: searchOpen, replaceVisible };
  }

  export function applySaveResult(
    sessionId: string,
    result: import('../../lib/text-editor/protocol').SaveSegmentedRevisionResult,
  ) {
    if (tab.sessionId !== sessionId || core?.getMetadata().sessionId !== sessionId) return null;
    return core?.applySaveResult(result) ?? null;
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class="segmented-workspace"
  role="application"
  tabindex="-1"
  aria-label={t.segmentedEditor()}
  data-interface-locale={interfaceLocale}
  on:keydown|capture={handleWorkspaceKeydown}
>
  <header class="segmented-toolbar">
    <div class="document-badge">
      {#if tab.documentKind === 'json'}<Braces size={14} />{:else}<span>TXT</span>{/if}
      <strong>{tab.documentKind.toUpperCase()}</strong>
    </div>
    <button
      type="button"
      title={t.search()}
      aria-label={t.search()}
      on:click={() => openSearch(false)}
    >
      <Search size={14} />
    </button>
    {#if tab.documentKind === 'json'}
      <button type="button" on:click={() => startTask('json-validate')}>
        <Braces size={14} />{t.jsonValidate()}
      </button>
      <button type="button" disabled={readonly} on:click={() => startTask('json-format')}>
        <WandSparkles size={14} />{t.jsonFormat()}
      </button>
    {/if}
    {#if segmentNavigationVisible}
      <div
        class="segment-navigation"
        role="group"
        aria-label={segmentCopy.group}
        style="display:inline-flex;align-items:center;min-width:0;border:1px solid var(--md-editor-border);border-radius:var(--md-editor-radius-sm);overflow:hidden"
      >
        <button
          type="button"
          class="segment-navigation-button"
          title={segmentCopy.previous}
          aria-label={segmentCopy.previous}
          disabled={previousSegmentDisabled}
          on:click={() => loadAdjacentSegment('previous')}
        >
          <ChevronLeft size={14} />
        </button>
        <output
          class="revision-label"
          aria-live="polite"
          aria-atomic="true"
          style="min-width:10.5rem;padding:0 7px;text-align:center;white-space:nowrap;font-variant-numeric:tabular-nums"
        >
          {segmentRangeText}
        </output>
        <button
          type="button"
          class="segment-navigation-button"
          title={segmentCopy.next}
          aria-label={segmentCopy.next}
          disabled={nextSegmentDisabled}
          on:click={() => loadAdjacentSegment('next')}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    {/if}
    <span class="toolbar-spacer"></span>
    <span class="revision-label">r{metadata?.revision ?? tab.revision}</span>
  </header>

  {#if searchOpen}
    <form class="segmented-search" on:submit|preventDefault={() => startTask('search')}>
      <label>
        <span class="sr-only">{t.searchInDocument()}</span>
        <input bind:this={searchInput} bind:value={query} placeholder={t.searchReady()} />
      </label>
      {#if replaceVisible}
        <label>
          <span class="sr-only">{t.replaceWith()}</span>
          <input bind:value={replacement} placeholder={t.replaceWith()} />
        </label>
      {/if}
      <button type="submit" title={t.search()}><Search size={13} /></button>
      <button type="button" title={t.previousMatch()} on:click={() => navigateNearby(-1)}>
        <ChevronUp size={13} />
      </button>
      <button type="button" title={t.nextMatch()} on:click={() => navigateNearby(1)}>
        <ChevronDown size={13} />
      </button>
      {#if replaceVisible}
        <button type="button" disabled={readonly} on:click={() => startTask('replace-all')}>
          {t.replaceAll()}
        </button>
      {/if}
      <span class="match-count">{taskProgress?.matchCount ?? 0}</span>
      <button type="button" title={t.closeSearch()} on:click={closeSearch}><X size={13} /></button>
    </form>
  {/if}

  {#if readonly}
    <div class="readonly-notice" role="status">
      {unsupportedEncoding ? t.segmentedReadonlyUnsupportedEncoding() : t.segmentedReadonlySource()}
    </div>
  {/if}

  <div
    class="segmented-scroll"
    bind:this={scroller}
    bind:clientHeight={viewportHeight}
    on:scroll={handleVirtualScroll}
  >
    <div class="virtual-spacer" style={`height:${topSpacerHeight}px`}></div>
    <div class="segmented-editor-host" bind:this={host}></div>
    <div class="virtual-spacer" style={`height:${bottomSpacerHeight}px`}></div>
    {#if loading}
      <div class="loading-overlay" role="status" aria-live="polite">
        <LoaderCircle size={16} />
      </div>
    {/if}
  </div>

  <footer class="segmented-status" aria-live="polite">
    <span>{t.indexingProgress({ percent: indexPercent })}</span>
    <progress
      max="100"
      value={indexPercent}
      aria-label={t.indexingProgress({ percent: indexPercent })}
    ></progress>
    <span class="status-spacer"></span>
    {#if queuedTaskRequest}
      <span>{t.indexRequired()}</span>
      <button type="button" class="cancel-task" on:click={cancelTask}>
        <Square size={11} />{t.cancelTask()}
      </button>
    {:else if taskProgress?.state === 'running'}
      <span>{t.taskRunning({ percent: taskPercent })}</span>
      <button type="button" class="cancel-task" on:click={cancelTask}>
        <Square size={11} />{t.cancelTask()}
      </button>
    {:else if errorMessage}
      <span class="error-text">{errorMessage}</span>
    {:else if statusMessage}
      <span>{statusMessage}</span>
    {/if}
  </footer>
</section>
