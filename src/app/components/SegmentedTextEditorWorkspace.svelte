<script lang="ts">
  import { LoaderCircle, Square } from '@lucide/svelte';
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
  import {
    SEGMENTED_FULL_WINDOW_BYTES,
    SEGMENTED_PREVIEW_THROTTLE_MS,
    SEGMENTED_SCROLL_SETTLE_MS,
    createSegmentedVirtualScrollMetrics,
    estimateSegmentedPixelsPerByte,
    resolveByteOffsetFromVirtualScroll,
    resolveCenteredSegmentWindowStart,
    resolveSegmentedPreviewBytes,
    resolveVirtualScrollTopForByteOffset,
    type SegmentedVirtualScrollMetrics,
  } from '../../lib/text-editor/virtualScroll';
  import type { SegmentedTextTabState } from '../types';
  import { t } from '../i18n';
  import SearchReplacePanel from './SearchReplacePanel.svelte';
  import {
    classifySegmentedTaskProgress,
    getAdjacentSegmentStart,
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

  interface ActiveTask extends SegmentedTaskIdentity {
    terminal: Promise<void>;
    resolveTerminal: () => void;
    request: SegmentedTaskSpec;
  }

  interface PendingTaskLaunch {
    baseRevision: number;
    kind: SegmentedTaskType;
    earlyProgressByTaskId: Map<string, SegmentedTaskProgress>;
  }

  let host: HTMLDivElement;
  let scroller: HTMLDivElement;
  let core: SegmentedTextEditorCore | null = null;
  let metadata: SegmentedEditorMetadata | null = null;
  let viewportHeight = 0;
  let virtualMetrics: SegmentedVirtualScrollMetrics | null = null;
  let virtualRunwayHeight = 0;
  let frozenPixelsPerByte = 0.25;
  let loading = true;
  let errorMessage = '';
  let statusMessage = '';
  let searchOpen = false;
  let replaceVisible = false;
  let query = '';
  let replacement = '';
  let caseSensitive = false;
  let wholeWord = false;
  let backwards = false;
  let wrapAround = true;
  let searchMatchCount = 0;
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
  let previewThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollSettleTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollFrame: number | null = null;
  let destroyed = false;
  let readRequestId = 1;
  let segmentNavigationLoading = false;
  let latestSeekByte = 0;
  let lastScrollByte = 0;
  let lastScrollAt = 0;
  let lastPreviewAt = Number.NEGATIVE_INFINITY;
  let pointerSeeking = false;
  let seeking = false;
  let suppressNextScroll = false;
  let loadGeneration = 0;

  $: indexPercent = Math.round((metadata?.indexProgress ?? tab.indexProgress) * 100);
  $: taskPercent = taskProgress?.totalBytes
    ? Math.round((taskProgress.processedBytes / taskProgress.totalBytes) * 100)
    : 0;
  $: searchBusy = Boolean(activeTask || taskLaunchPromise || queuedTaskRequest);
  $: sessionMetadata = segmentedSessionRegistry.get(tab.sessionId);
  $: readonly = metadata?.readonly ?? sessionMetadata?.readonly ?? tab.diskReadonly;
  $: unsupportedEncoding = (metadata?.encoding ?? sessionMetadata?.encoding) === 'unsupported';
  $: filesystemReadonly =
    metadata?.filesystemReadonly ?? sessionMetadata?.filesystemReadonly ?? tab.diskReadonly;
  $: if (!autoSaveEnabled || readonly || tab.externalFileChange.type !== 'none') {
    clearAutoSaveTimer();
  }
  $: if (
    virtualMetrics &&
    metadata &&
    viewportHeight > 0 &&
    virtualMetrics.viewportHeight !== viewportHeight
  ) {
    resizeVirtualGeometry(metadata.byteLength);
  }

  onMount(() => {
    void mountCore();
  });

  onDestroy(() => {
    destroyed = true;
    clearAutoSaveTimer();
    clearIndexPollTimer();
    clearSeekTimers();
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
        windowBytes: SEGMENTED_FULL_WINDOW_BYTES,
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
      await tick();
      initializeVirtualGeometry(session);
      restoreScrollAnchor(session.byteLength);
      loading = false;
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
    const anchorByte = Math.min(tab.scrollAnchor?.byteOffset ?? 0, session.byteLength);
    const startByte = resolveCenteredSegmentWindowStart(
      anchorByte,
      session.byteLength,
      SEGMENTED_FULL_WINDOW_BYTES,
    );
    const registeredWindow = segmentedSessionRegistry.consumeFirstWindow(tab.sessionId);
    const expectedBytes = Math.min(SEGMENTED_FULL_WINDOW_BYTES, session.byteLength);
    const registeredBytes = registeredWindow
      ? registeredWindow.endByte - registeredWindow.startByte
      : 0;
    const canReuseRegisteredWindow =
      registeredWindow !== undefined &&
      registeredBytes >= expectedBytes &&
      registeredWindow.startByte <= anchorByte &&
      registeredWindow.endByte >= anchorByte;
    const firstWindow = canReuseRegisteredWindow
      ? registeredWindow
      : await port.readWindow({
          sessionId: tab.sessionId,
          revision: tab.revision,
          startByte,
          targetBytes: SEGMENTED_FULL_WINDOW_BYTES,
          requestId: readRequestId++,
        });
    return { ...session, firstWindow };
  }

  function handleMetadataChange(next: SegmentedEditorMetadata) {
    const preservedAnchor = resolveCurrentVirtualByte();
    const byteLengthChanged = virtualMetrics?.byteLength !== next.byteLength;
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
      filesystemReadonly: next.filesystemReadonly,
      readonly: next.readonly,
    });
    dispatch('stateChange', next);
    if (byteLengthChanged && virtualMetrics) {
      void tick().then(() => updateVirtualGeometry(next.byteLength, preservedAnchor));
    }
    scheduleAutoSave(next);
    ensureIndexPolling();
    maybeStartQueuedTask(next.indexProgress);
  }

  function handleIndexProgress(progress: SegmentedIndexProgress) {
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
      if (progress.kind === 'search') {
        searchMatchCount = progress.matchCount;
      }
      if (progress.nearbyMatches) {
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
          currentIndex >= 0
            ? currentIndex
            : Math.max(0, Math.min(activeNearbyIndex, nearbyMatches.length - 1));
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
        await finishCompletedTask(identity, progress);
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

  async function finishCompletedTask(identity: ActiveTask, progress: SegmentedTaskProgress) {
    if (
      (progress.kind === 'replace-all' || progress.kind === 'json-format') &&
      progress.resultRevision !== undefined
    ) {
      await core?.applyTaskResult(progress.resultRevision, progress.resultByteLength);
      if (progress.kind === 'replace-all') {
        nearbyMatches = [];
        nearbyMatchesRevision = null;
        activeNearbyIndex = 0;
        searchMatchCount = 0;
      }
    }
    if (
      progress.kind === 'search' &&
      progress.currentMatch &&
      identity.request.selectMatch !== false
    ) {
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

  function initializeVirtualGeometry(session: OpenSegmentedDocumentResult) {
    const visibleBytes = Math.max(1, session.firstWindow.endByte - session.firstWindow.startByte);
    frozenPixelsPerByte = estimateSegmentedPixelsPerByte(
      visibleBytes,
      measureCurrentWindowHeight(),
    );
    const initialAnchor = Math.min(
      tab.scrollAnchor?.byteOffset ?? session.firstWindow.startByte,
      session.byteLength,
    );
    updateVirtualGeometry(session.byteLength, initialAnchor);
  }

  /** 当前窗口重排和索引推进不能改变该轨道；这里只接受真实 byteLength 或视口尺寸变化。 */
  function updateVirtualGeometry(
    byteLength: number,
    preservedAnchor = resolveCurrentVirtualByte(),
  ) {
    if (!scroller) return;
    virtualMetrics = createSegmentedVirtualScrollMetrics(
      byteLength,
      Math.max(1, viewportHeight || scroller.clientHeight),
      frozenPixelsPerByte,
    );
    virtualRunwayHeight = Math.max(0, virtualMetrics.totalHeight - virtualMetrics.viewportHeight);
    setProgrammaticScrollTop(
      resolveVirtualScrollTopForByteOffset(Math.min(preservedAnchor, byteLength), virtualMetrics),
    );
  }

  function resizeVirtualGeometry(byteLength: number) {
    updateVirtualGeometry(byteLength, resolveCurrentVirtualByte());
  }

  function measureCurrentWindowHeight() {
    const content = host?.querySelector<HTMLElement>('.cm-content');
    const localScroller = host?.querySelector<HTMLElement>('.cm-scroller');
    return Math.max(
      1,
      content?.scrollHeight ?? 0,
      localScroller?.scrollHeight ?? 0,
      viewportHeight,
    );
  }

  function resolveCurrentVirtualByte() {
    if (virtualMetrics && scroller) {
      return resolveByteOffsetFromVirtualScroll(scroller.scrollTop, virtualMetrics);
    }
    return metadata?.scrollAnchor?.byteOffset ?? tab.scrollAnchor?.byteOffset ?? 0;
  }

  function restoreScrollAnchor(byteLength: number) {
    if (!scroller || !virtualMetrics) return;
    const anchor = Math.min(tab.scrollAnchor?.byteOffset ?? 0, byteLength);
    setProgrammaticScrollTop(resolveVirtualScrollTopForByteOffset(anchor, virtualMetrics));
    lastScrollByte = anchor;
    lastScrollAt = performance.now();
    core?.revealByteOffset(anchor);
  }

  function setProgrammaticScrollTop(scrollTop: number) {
    if (!scroller) return;
    suppressNextScroll = true;
    scroller.scrollTop = scrollTop;
    requestAnimationFrame(() => {
      suppressNextScroll = false;
    });
  }

  function syncVirtualScrollToByte(byteOffset: number) {
    if (!virtualMetrics) return;
    const safeByteOffset = Math.min(byteOffset, virtualMetrics.byteLength);
    setProgrammaticScrollTop(resolveVirtualScrollTopForByteOffset(safeByteOffset, virtualMetrics));
    lastScrollByte = safeByteOffset;
    lastScrollAt = performance.now();
  }

  function handleVirtualScroll() {
    if (suppressNextScroll) return;
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      const activeCore = core;
      const current = metadata;
      const metrics = virtualMetrics;
      if (!activeCore || !current || !metrics || current.byteLength <= 0) return;

      const now = performance.now();
      const targetByte = resolveByteOffsetFromVirtualScroll(scroller.scrollTop, metrics);
      const elapsed = Math.max(1, now - lastScrollAt);
      const byteDelta = Math.abs(targetByte - lastScrollByte);
      const visibleBytes = Math.max(1, current.visibleEndByte - current.visibleStartByte);
      const fastSeek =
        pointerSeeking ||
        byteDelta > Math.max(SEGMENTED_FULL_WINDOW_BYTES / 2, visibleBytes) ||
        byteDelta / elapsed > 4 * 1024;
      lastScrollByte = targetByte;
      lastScrollAt = now;

      if (fastSeek) {
        scheduleFastSeek(targetByte);
        return;
      }

      activeCore.setScrollAnchor(targetByte);
      const margin = Math.max(4096, Math.floor(visibleBytes / 5));
      const needsPreviousWindow =
        current.visibleStartByte > 0 && targetByte < current.visibleStartByte + margin;
      const needsNextWindow =
        current.visibleEndByte < current.byteLength && targetByte > current.visibleEndByte - margin;
      if (needsPreviousWindow || needsNextWindow || !activeCore.revealByteOffset(targetByte)) {
        void loadVisibleWindow(targetByte, SEGMENTED_FULL_WINDOW_BYTES, true);
      }
    });
  }

  function scheduleFastSeek(targetByte: number) {
    latestSeekByte = targetByte;
    if (!seeking) {
      seeking = true;
      core?.setSeekingLocked(true);
    }
    if (scrollSettleTimer) clearTimeout(scrollSettleTimer);
    scrollSettleTimer = setTimeout(() => void settleFastSeek(), SEGMENTED_SCROLL_SETTLE_MS);

    const remainingThrottle = SEGMENTED_PREVIEW_THROTTLE_MS - (performance.now() - lastPreviewAt);
    if (remainingThrottle <= 0) {
      void loadSeekPreview();
      return;
    }
    if (!previewThrottleTimer) {
      previewThrottleTimer = setTimeout(() => void loadSeekPreview(), remainingThrottle);
    }
  }

  async function loadSeekPreview() {
    if (previewThrottleTimer) clearTimeout(previewThrottleTimer);
    previewThrottleTimer = null;
    if (!seeking || destroyed || !metadata) return;
    lastPreviewAt = performance.now();
    const previewBytes = resolveSegmentedPreviewBytes(
      viewportHeight,
      Math.max(1, metadata.visibleEndByte - metadata.visibleStartByte),
      measureCurrentWindowHeight(),
    );
    await loadVisibleWindow(latestSeekByte, previewBytes, false);
  }

  async function settleFastSeek() {
    scrollSettleTimer = null;
    if (previewThrottleTimer) clearTimeout(previewThrottleTimer);
    previewThrottleTimer = null;
    const targetByte = latestSeekByte;
    seeking = false;
    core?.setSeekingLocked(false);
    await loadVisibleWindow(targetByte, SEGMENTED_FULL_WINDOW_BYTES, true);
  }

  async function loadVisibleWindow(targetByte: number, targetBytes: number, prefetch: boolean) {
    const activeCore = core;
    const current = metadata;
    if (!activeCore || !current) return;
    const startByte = resolveCenteredSegmentWindowStart(
      targetByte,
      current.byteLength,
      targetBytes,
    );
    const generation = ++loadGeneration;
    loading = true;
    try {
      const result = await activeCore.loadWindow(startByte, { targetBytes, prefetch });
      if (result.status === 'stale' || destroyed || core !== activeCore) return;
      activeCore.revealByteOffset(targetByte);
      activeCore.setScrollAnchor(targetByte);
    } catch (error) {
      showError(error);
    } finally {
      if (generation === loadGeneration) loading = false;
    }
  }

  function handleViewportWheel(event: WheelEvent) {
    if (!scroller || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 18
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? viewportHeight
          : 1;
    scroller.scrollTop += event.deltaY * unit;
  }

  function handleScrollPointerDown(event: PointerEvent) {
    const bounds = scroller.getBoundingClientRect();
    if (event.clientX < bounds.right - 20) return;
    pointerSeeking = true;
    scroller.setPointerCapture?.(event.pointerId);
  }

  function handleScrollPointerUp(event: PointerEvent) {
    if (!pointerSeeking) return;
    pointerSeeking = false;
    if (scroller.hasPointerCapture?.(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId);
    }
    if (seeking) {
      if (scrollSettleTimer) clearTimeout(scrollSettleTimer);
      scrollSettleTimer = setTimeout(() => void settleFastSeek(), SEGMENTED_SCROLL_SETTLE_MS);
    }
  }

  function clearSeekTimers() {
    if (previewThrottleTimer) clearTimeout(previewThrottleTimer);
    if (scrollSettleTimer) clearTimeout(scrollSettleTimer);
    previewThrottleTimer = null;
    scrollSettleTimer = null;
    if (seeking) core?.setSeekingLocked(false);
    seeking = false;
    pointerSeeking = false;
  }

  function handleWorkspaceKeydown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (event.shiftKey && event.altKey && key === 'f' && tab.documentKind === 'json') {
      event.preventDefault();
      if (!readonly) void startTask('json-format');
      return;
    }
    if (event.altKey && (event.key === 'PageUp' || event.key === 'PageDown')) {
      event.preventDefault();
      void loadAdjacentSegment(event.key === 'PageUp' ? 'previous' : 'next');
      return;
    }
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier) return;
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
    if (type === 'search') {
      request.caseSensitive = caseSensitive;
      request.wholeWord = wholeWord;
      request.wrapAround = wrapAround;
      if (backwards) {
        request.anchorByte = core?.getMetadata().byteLength ?? metadata?.byteLength ?? 0;
        request.direction = 'backward';
      }
    }
    if (type === 'replace-all') {
      // 空字符串是“删除全部命中”的有效 replacement，不能按缺省参数丢弃。
      request.replacement = replacement;
      request.caseSensitive = caseSensitive;
      request.wholeWord = wholeWord;
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
        request,
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
    const target = getAdjacentSegmentStart(direction, current, SEGMENTED_FULL_WINDOW_BYTES);
    if (target === null) return;
    segmentNavigationLoading = true;
    loading = true;
    try {
      const result = await core.loadWindow(target);
      if (result.status !== 'stale') {
        core.revealByteOffset(target);
        core.setScrollAnchor(target);
        syncVirtualScrollToByte(target);
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
    void launchTask(createSearchRequest(direction, anchor.startByte));
  }

  function createSearchRequest(
    direction: -1 | 1,
    anchorByte?: number,
    selectMatch = true,
  ): SegmentedTaskSpec {
    const resolvedAnchor =
      anchorByte ??
      (direction < 0 ? (core?.getMetadata().byteLength ?? metadata?.byteLength ?? 0) : undefined);
    return {
      type: 'search',
      query,
      anchorByte: resolvedAnchor,
      direction: resolvedAnchor === undefined ? undefined : direction > 0 ? 'forward' : 'backward',
      caseSensitive,
      wholeWord,
      wrapAround,
      selectMatch,
    };
  }

  function runFind(direction: -1 | 1) {
    if (!query || searchBusy) return;
    if (nearbyMatches.length > 0 && nearbyMatchesRevision === core?.getMetadata().revision) {
      navigateNearby(direction);
      return;
    }
    void launchTask(createSearchRequest(direction));
  }

  function countSearchMatches() {
    if (!query || searchBusy) return;
    void launchTask(createSearchRequest(backwards ? -1 : 1, undefined, false));
  }

  function updateSearchQuery(event: Event) {
    query = (event.currentTarget as HTMLInputElement).value;
    invalidateSearchResults();
  }

  function updateSearchReplacement(event: Event) {
    replacement = (event.currentTarget as HTMLInputElement).value;
  }

  function toggleCaseSensitive() {
    caseSensitive = !caseSensitive;
    invalidateSearchResults();
  }

  function toggleWholeWord() {
    wholeWord = !wholeWord;
    invalidateSearchResults();
  }

  function toggleBackwards() {
    backwards = !backwards;
    invalidateSearchResults();
  }

  function toggleWrapAround() {
    wrapAround = !wrapAround;
  }

  function toggleReplaceVisible() {
    replaceVisible = !replaceVisible;
  }

  function invalidateSearchResults() {
    if (activeTask?.kind === 'search' && taskProgress?.state === 'running') {
      void cancelTask();
    }
    if (queuedTaskRequest?.type === 'search') {
      queuedTaskRequest = null;
    }
    nearbyMatches = [];
    nearbyMatchesRevision = null;
    activeNearbyIndex = 0;
    searchMatchCount = 0;
    if (taskProgress?.kind === 'search') {
      taskProgress = null;
    }
  }

  async function replaceCurrentMatch() {
    const match = nearbyMatches[activeNearbyIndex];
    if (!core || !match || readonly || searchBusy) return;
    try {
      await revealSearchMatch(match);
      if (!core.replaceRange(match.startByte, match.endByte, replacement)) return;
      await core.flush();
      statusMessage = t.replacedOneMatch();
      dispatch('status', { message: statusMessage });
      invalidateSearchResults();
      await launchTask(createSearchRequest(backwards ? -1 : 1));
    } catch (error) {
      showError(error);
    }
  }

  async function revealSearchMatch(match: SegmentedMatchRange) {
    const activeCore = core;
    if (!activeCore) return;
    const result = await activeCore.loadWindow(match.startByte);
    if (result.status === 'stale' || core !== activeCore) return;
    activeCore.setSelection({ anchorByte: match.startByte, headByte: match.endByte });
    activeCore.revealByteOffset(match.startByte);
    activeCore.setScrollAnchor(match.startByte);
    syncVirtualScrollToByte(match.startByte);
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
  }

  export function closeSearch() {
    searchOpen = false;
    const match = nearbyMatches[activeNearbyIndex];
    const selection = core?.getMetadata().selection;
    if (
      core &&
      match &&
      selection &&
      ((selection.anchorByte === match.startByte && selection.headByte === match.endByte) ||
        (selection.anchorByte === match.endByte && selection.headByte === match.startByte))
    ) {
      core.setSelection({ anchorByte: match.endByte, headByte: match.endByte });
    }
    core?.focus();
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
  {#if searchOpen}
    <div class="segmented-search-layer">
      <SearchReplacePanel
        {interfaceLocale}
        open={searchOpen}
        {replaceVisible}
        {query}
        {replacement}
        {caseSensitive}
        {wholeWord}
        {backwards}
        {wrapAround}
        activeIndex={activeNearbyIndex}
        matchCount={searchMatchCount}
        showActivePosition={false}
        {readonly}
        busy={searchBusy}
        updateQuery={updateSearchQuery}
        updateReplacement={updateSearchReplacement}
        {toggleCaseSensitive}
        {toggleWholeWord}
        {toggleBackwards}
        {toggleWrapAround}
        {toggleReplaceVisible}
        findPrevious={() => runFind(-1)}
        findNext={() => runFind(1)}
        countMatches={countSearchMatches}
        replaceCurrent={replaceCurrentMatch}
        replaceAll={() => startTask('replace-all')}
        close={closeSearch}
      />
    </div>
  {/if}

  {#if unsupportedEncoding || filesystemReadonly}
    <div class="readonly-notice" role="status">
      {unsupportedEncoding ? t.segmentedReadonlyUnsupportedEncoding() : t.segmentedReadonlySource()}
    </div>
  {/if}

  <div
    class="segmented-scroll"
    role="group"
    aria-label={tab.fileName}
    bind:this={scroller}
    bind:clientHeight={viewportHeight}
    on:scroll={handleVirtualScroll}
    on:pointerdown={handleScrollPointerDown}
    on:pointerup={handleScrollPointerUp}
    on:pointercancel={handleScrollPointerUp}
  >
    <div
      class="segmented-editor-viewport"
      style={`height:${Math.max(1, viewportHeight)}px`}
      on:wheel|nonpassive={handleViewportWheel}
    >
      <div class="segmented-editor-host" bind:this={host}></div>
      {#if loading}
        <div class="loading-overlay" role="status" aria-live="polite">
          <LoaderCircle size={16} />
        </div>
      {/if}
    </div>
    <div
      class="segmented-scroll-runway"
      data-testid="segmented-scroll-runway"
      style={`height:${virtualRunwayHeight}px`}
    ></div>
  </div>

  {#if indexPercent < 100 || queuedTaskRequest || taskProgress?.state === 'running' || errorMessage || statusMessage}
    <footer class="segmented-status" aria-live="polite">
      {#if indexPercent < 100}
        <span>{t.indexingProgress({ percent: indexPercent })}</span>
        <progress
          max="100"
          value={indexPercent}
          aria-label={t.indexingProgress({ percent: indexPercent })}
        ></progress>
        <span class="status-spacer"></span>
      {/if}
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
  {/if}
</section>
