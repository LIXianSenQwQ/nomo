use super::{
    chunk_reader::{DocumentSnapshot, SnapshotReader},
    encoding,
    session::DocumentSessionManager,
    EventSink, LineEnding, SegmentedDocumentKind, SegmentedEvent, SegmentedSearchDirection,
    SegmentedTask, SegmentedTaskKind, SegmentedTaskMatch, SegmentedTaskState,
    StartSegmentedTaskRequest, StartSegmentedTaskResult, TaskProgressEvent, TextDocumentError,
    TextDocumentResult,
};
use serde::Deserialize;
use std::{
    collections::VecDeque,
    fs::{File, OpenOptions},
    io::{BufReader, Read, Write},
    path::Path,
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
};

const TASK_CHUNK_BYTES: usize = 64 * 1024;
const NEARBY_MATCH_LIMIT: usize = 16;
static NEXT_TASK_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone)]
pub(super) struct TaskControl {
    pub(super) session_id: String,
    pub(super) cancel: Arc<AtomicBool>,
}

struct TaskContext {
    manager: DocumentSessionManager,
    session_id: String,
    task_id: String,
    base_revision: u64,
    kind: SegmentedTaskKind,
    snapshot: DocumentSnapshot,
    document_kind: SegmentedDocumentKind,
    line_ending: LineEnding,
    cancel: Arc<AtomicBool>,
    sink: Option<EventSink>,
}

#[derive(Default)]
struct TaskOutcome {
    processed_bytes: u64,
    match_count: u64,
    result_revision: Option<u64>,
    result_byte_length: Option<u64>,
    persisted_revision: Option<u64>,
    dirty: Option<bool>,
    output_path: Option<String>,
    nearby_matches: Vec<SegmentedTaskMatch>,
    current_match: Option<SegmentedTaskMatch>,
    message: Option<String>,
}

struct CancellableSnapshotReader<'a> {
    inner: SnapshotReader,
    context: &'a TaskContext,
    processed_bytes: u64,
    progress_start: u64,
    progress_span: u64,
}

impl Read for CancellableSnapshotReader<'_> {
    fn read(&mut self, output: &mut [u8]) -> std::io::Result<usize> {
        if self.context.cancel.load(Ordering::Acquire) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Interrupted,
                "segmented task cancelled",
            ));
        }
        let count = self.inner.read(output)?;
        self.processed_bytes = self.processed_bytes.saturating_add(count as u64);
        let source_len = self.context.snapshot.len();
        let mapped = if source_len == 0 {
            self.progress_start.saturating_add(self.progress_span)
        } else {
            self.progress_start.saturating_add(
                self.processed_bytes
                    .saturating_mul(self.progress_span)
                    .checked_div(source_len)
                    .unwrap_or_default(),
            )
        };
        emit(
            self.context,
            SegmentedTaskState::Running,
            &TaskOutcome {
                processed_bytes: mapped,
                ..TaskOutcome::default()
            },
            None,
        );
        Ok(count)
    }
}

pub(super) fn start(
    manager: DocumentSessionManager,
    request: StartSegmentedTaskRequest,
    sink: Option<EventSink>,
) -> TextDocumentResult<StartSegmentedTaskResult> {
    let write_task = matches!(
        &request.task,
        SegmentedTask::ReplaceAll { .. } | SegmentedTask::JsonFormat
    );
    let (document_kind, line_ending, readonly, snapshot) =
        manager.task_snapshot(&request.session_id, request.base_revision)?;
    if write_task && readonly {
        return Err(TextDocumentError::new(
            "document-readonly",
            "当前编码或磁盘权限只允许只读打开",
        ));
    }
    let task_id = next_task_id();
    let cancel = Arc::new(AtomicBool::new(false));
    manager.register_task(
        task_id.clone(),
        TaskControl {
            session_id: request.session_id.clone(),
            cancel: cancel.clone(),
        },
    )?;
    let context = TaskContext {
        manager: manager.clone(),
        session_id: request.session_id,
        task_id: task_id.clone(),
        base_revision: request.base_revision,
        kind: request.task.kind(),
        snapshot,
        document_kind,
        line_ending,
        cancel,
        sink,
    };

    emit(
        &context,
        SegmentedTaskState::Running,
        &TaskOutcome::default(),
        None,
    );
    std::thread::spawn(move || {
        let result = run_task(&context, request.task);
        match result {
            Ok(outcome) => emit(
                &context,
                SegmentedTaskState::Completed,
                &outcome,
                outcome.message.clone(),
            ),
            Err(error) if error.code == "task-cancelled" => emit(
                &context,
                SegmentedTaskState::Cancelled,
                &TaskOutcome::default(),
                Some(error.message),
            ),
            Err(error) if error.code == "revision-conflict" => emit(
                &context,
                SegmentedTaskState::Conflict,
                &TaskOutcome::default(),
                Some(error.message),
            ),
            Err(error) => emit(
                &context,
                SegmentedTaskState::Failed,
                &TaskOutcome::default(),
                Some(error.message),
            ),
        }
        context.manager.finish_task(&context.task_id);
    });

    Ok(StartSegmentedTaskResult { task_id })
}

fn run_task(context: &TaskContext, task: SegmentedTask) -> TextDocumentResult<TaskOutcome> {
    match task {
        SegmentedTask::Search {
            query,
            anchor_byte,
            direction,
        } => run_search(context, &query, anchor_byte, direction),
        SegmentedTask::ReplaceAll { query, replacement } => {
            run_replace_all(context, &query, &replacement)
        }
        SegmentedTask::SelectAllCopy => run_select_all_copy(context),
        SegmentedTask::JsonValidate => run_json_validate(context),
        SegmentedTask::JsonFormat => run_json_format(context),
    }
}

fn run_search(
    context: &TaskContext,
    query: &str,
    anchor_byte: Option<u64>,
    direction: Option<SegmentedSearchDirection>,
) -> TextDocumentResult<TaskOutcome> {
    if query.is_empty() {
        return Err(TextDocumentError::new(
            "task-invalid-query",
            "搜索文本不能为空",
        ));
    }
    validate_search_page(anchor_byte, direction, context.snapshot.len())?;
    let mut outcome = TaskOutcome::default();
    let mut page = VecDeque::with_capacity(NEARBY_MATCH_LIMIT);
    let mut offset = 0_u64;
    let mut matcher = KmpMatcher::new(query.as_bytes());
    while offset < context.snapshot.len() {
        check_cancel(context)?;
        let chunk = context.snapshot.read_range(offset, TASK_CHUNK_BYTES)?;
        if chunk.is_empty() {
            break;
        }
        for byte in &chunk {
            if let Some(from) = matcher.push(*byte) {
                let found = SegmentedTaskMatch {
                    start_byte: from,
                    end_byte: from + query.len() as u64,
                };
                outcome.match_count += 1;
                let eligible = match (anchor_byte, direction) {
                    (Some(anchor), Some(SegmentedSearchDirection::Forward)) => from > anchor,
                    (Some(anchor), Some(SegmentedSearchDirection::Backward)) => from < anchor,
                    (None, None) => true,
                    _ => false,
                };
                if eligible {
                    match direction {
                        Some(SegmentedSearchDirection::Backward) => {
                            // 反向页只保留锚点前最近的 16 条，避免随文件大小增长占用内存。
                            if page.len() == NEARBY_MATCH_LIMIT {
                                page.pop_front();
                            }
                            page.push_back(found);
                        }
                        _ if page.len() < NEARBY_MATCH_LIMIT => page.push_back(found),
                        _ => {}
                    }
                }
            }
        }
        offset += chunk.len() as u64;
        outcome.processed_bytes = offset;
        emit(context, SegmentedTaskState::Running, &outcome, None);
    }
    outcome.nearby_matches = page.into_iter().collect();
    outcome.current_match = match direction {
        Some(SegmentedSearchDirection::Backward) => outcome.nearby_matches.last().cloned(),
        _ => outcome.nearby_matches.first().cloned(),
    };
    Ok(outcome)
}

fn validate_search_page(
    anchor_byte: Option<u64>,
    direction: Option<SegmentedSearchDirection>,
    snapshot_len: u64,
) -> TextDocumentResult<()> {
    if anchor_byte.is_some() != direction.is_some()
        || anchor_byte.is_some_and(|anchor| anchor > snapshot_len)
    {
        return Err(TextDocumentError::new(
            "task-invalid-anchor",
            "搜索分页必须同时提供有效的 anchorByte 和 direction",
        ));
    }
    Ok(())
}

fn run_replace_all(
    context: &TaskContext,
    query: &str,
    replacement: &str,
) -> TextDocumentResult<TaskOutcome> {
    if query.is_empty() {
        return Err(TextDocumentError::new(
            "task-invalid-query",
            "替换文本不能为空",
        ));
    }
    let output_path = context
        .manager
        .task_output_path(&context.task_id, "replace");
    let undo_path = context.manager.task_output_path(&context.task_id, "undo");
    let mut output = create_output(&output_path)?;
    let mut undo = create_output(&undo_path)?;
    let replacement = encoding::normalize_inserted_text(replacement, context.line_ending);
    let mut replacer = StreamingReplacer::new(query.as_bytes());
    let mut offset = 0_u64;
    let mut match_count = 0_u64;
    let mut line_breaks = 0_u64;
    let mut undo_line_breaks = 0_u64;
    while offset < context.snapshot.len() {
        check_cancel(context).inspect_err(|_| {
            cleanup_task_output(&output_path);
            cleanup_task_output(&undo_path);
        })?;
        let chunk = context.snapshot.read_range(offset, TASK_CHUNK_BYTES)?;
        if chunk.is_empty() {
            break;
        }
        write_counted(&mut undo, &chunk, &mut undo_line_breaks)?;
        for byte in &chunk {
            if replacer.push(*byte, &replacement, &mut output, &mut line_breaks)? {
                match_count += 1;
            }
        }
        offset += chunk.len() as u64;
        emit(
            context,
            SegmentedTaskState::Running,
            &TaskOutcome {
                processed_bytes: offset,
                match_count,
                ..TaskOutcome::default()
            },
            None,
        );
    }
    replacer.finish(&mut output, &mut line_breaks)?;
    output.sync_all()?;
    undo.sync_all()?;
    drop(output);
    drop(undo);
    check_cancel(context).inspect_err(|_| {
        cleanup_task_output(&output_path);
        cleanup_task_output(&undo_path);
    })?;
    let commit = match context.manager.commit_task_output(
        &context.session_id,
        context.base_revision,
        &output_path,
        line_breaks,
        &undo_path,
        undo_line_breaks,
        &context.cancel,
    ) {
        Ok(commit) => commit,
        Err(error) => {
            cleanup_task_output(&output_path);
            cleanup_task_output(&undo_path);
            return Err(error);
        }
    };
    Ok(TaskOutcome {
        processed_bytes: context.snapshot.len(),
        match_count,
        result_revision: Some(commit.revision),
        result_byte_length: Some(commit.byte_length),
        persisted_revision: Some(commit.persisted_revision),
        dirty: Some(commit.dirty),
        ..TaskOutcome::default()
    })
}

fn run_select_all_copy(context: &TaskContext) -> TextDocumentResult<TaskOutcome> {
    if !context.manager.copy_fallback_forced() && stream_to_platform_clipboard(context)? {
        return Ok(TaskOutcome {
            processed_bytes: context.snapshot.len(),
            message: Some("已流式写入系统剪贴板".into()),
            ..TaskOutcome::default()
        });
    }

    let output_path = context.manager.task_output_path(&context.task_id, "txt");
    let temporary_path = context
        .manager
        .task_output_path(&context.task_id, "copy.tmp");
    let copy_result = (|| -> TextDocumentResult<u64> {
        let mut output = create_output(&temporary_path)?;
        let mut offset = 0_u64;
        while offset < context.snapshot.len() {
            check_cancel(context)?;
            let chunk = context.snapshot.read_range(offset, TASK_CHUNK_BYTES)?;
            if chunk.is_empty() {
                break;
            }
            output.write_all(&chunk)?;
            offset += chunk.len() as u64;
            emit(
                context,
                SegmentedTaskState::Running,
                &TaskOutcome {
                    processed_bytes: offset,
                    ..TaskOutcome::default()
                },
                None,
            );
        }
        output.sync_all()?;
        drop(output);
        check_cancel(context)?;
        Ok(offset)
    })();
    let offset = match copy_result {
        Ok(offset) => offset,
        Err(error) => {
            cleanup_task_output(&temporary_path);
            return Err(error);
        }
    };
    // `.copy.tmp` 不参与旧兜底扫描；完整同步后再在锁内发布，避免并发任务暴露半文件或失效路径。
    if let Err(error) = context
        .manager
        .publish_copy_fallback(&temporary_path, &output_path)
    {
        cleanup_task_output(&temporary_path);
        return Err(error);
    }
    let output_path_text = output_path.to_string_lossy().into_owned();
    Ok(TaskOutcome {
        processed_bytes: offset,
        output_path: Some(output_path_text.clone()),
        message: Some(format!(
            "系统剪贴板不可用，已回退为临时文件：{output_path_text}"
        )),
        ..TaskOutcome::default()
    })
}

fn run_json_validate(context: &TaskContext) -> TextDocumentResult<TaskOutcome> {
    require_json(context)?;
    validate_json(context, 0, context.snapshot.len())?;
    Ok(TaskOutcome {
        processed_bytes: context.snapshot.len(),
        ..TaskOutcome::default()
    })
}

fn validate_json(
    context: &TaskContext,
    progress_start: u64,
    progress_span: u64,
) -> TextDocumentResult<()> {
    check_cancel(context)?;
    let reader = CancellableSnapshotReader {
        inner: context.snapshot.reader(),
        context,
        processed_bytes: 0,
        progress_start,
        progress_span,
    };
    // serde_json 默认逐字节读取；BufReader 将底层进度事件约束为有界分块频率。
    let mut deserializer =
        serde_json::Deserializer::from_reader(BufReader::with_capacity(TASK_CHUNK_BYTES, reader));
    if let Err(error) = serde::de::IgnoredAny::deserialize(&mut deserializer) {
        check_cancel(context)?;
        return Err(TextDocumentError::new(
            "json-invalid",
            format!("JSON 校验失败：{error}"),
        ));
    }
    if let Err(error) = deserializer.end() {
        check_cancel(context)?;
        return Err(TextDocumentError::new(
            "json-invalid",
            format!("JSON 尾部数据无效：{error}"),
        ));
    }
    check_cancel(context)?;
    emit(
        context,
        SegmentedTaskState::Running,
        &TaskOutcome {
            processed_bytes: progress_start.saturating_add(progress_span),
            ..TaskOutcome::default()
        },
        None,
    );
    Ok(())
}

fn run_json_format(context: &TaskContext) -> TextDocumentResult<TaskOutcome> {
    require_json(context)?;
    let validation_span = context.snapshot.len() / 2;
    let format_span = context.snapshot.len().saturating_sub(validation_span);
    validate_json(context, 0, validation_span)?;
    let output_path = context.manager.task_output_path(&context.task_id, "json");
    let undo_path = context.manager.task_output_path(&context.task_id, "undo");
    let mut output = create_output(&output_path)?;
    let mut undo = create_output(&undo_path)?;
    let mut offset = 0_u64;
    let mut in_string = false;
    let mut escaped = false;
    let mut depth = 0_usize;
    let mut line_start = false;
    let mut line_breaks = 0_u64;
    let mut undo_line_breaks = 0_u64;
    let newline: &[u8] = if context.line_ending == LineEnding::Crlf {
        b"\r\n"
    } else {
        b"\n"
    };
    while offset < context.snapshot.len() {
        check_cancel(context).inspect_err(|_| {
            cleanup_task_output(&output_path);
            cleanup_task_output(&undo_path);
        })?;
        let chunk = context.snapshot.read_range(offset, TASK_CHUNK_BYTES)?;
        if chunk.is_empty() {
            break;
        }
        let chunk_len = chunk.len();
        write_counted(&mut undo, &chunk, &mut undo_line_breaks)?;
        // in_string/escaped 跨分块保留；仅字符串外的空白和结构标点可被格式化。
        for byte in chunk {
            if in_string {
                write_counted(&mut output, &[byte], &mut line_breaks)?;
                if escaped {
                    escaped = false;
                } else if byte == b'\\' {
                    escaped = true;
                } else if byte == b'"' {
                    in_string = false;
                }
                continue;
            }
            if byte.is_ascii_whitespace() {
                continue;
            }
            if line_start && byte != b'}' && byte != b']' {
                write_indent(&mut output, depth)?;
                line_start = false;
            }
            match byte {
                b'"' => {
                    output.write_all(&[byte])?;
                    in_string = true;
                }
                b'{' | b'[' => {
                    output.write_all(&[byte])?;
                    write_counted(&mut output, newline, &mut line_breaks)?;
                    depth += 1;
                    line_start = true;
                }
                b'}' | b']' => {
                    depth = depth.saturating_sub(1);
                    if !line_start {
                        write_counted(&mut output, newline, &mut line_breaks)?;
                    }
                    write_indent(&mut output, depth)?;
                    output.write_all(&[byte])?;
                    line_start = false;
                }
                b',' => {
                    output.write_all(b",")?;
                    write_counted(&mut output, newline, &mut line_breaks)?;
                    line_start = true;
                }
                b':' => output.write_all(b": ")?,
                _ => output.write_all(&[byte])?,
            }
        }
        offset += chunk_len as u64;
        emit(
            context,
            SegmentedTaskState::Running,
            &TaskOutcome {
                // 校验和格式化共享同一总量区间，第二阶段从中点继续而不会回退到零。
                processed_bytes: validation_span.saturating_add(if context.snapshot.len() == 0 {
                    format_span
                } else {
                    offset.saturating_mul(format_span) / context.snapshot.len()
                }),
                ..TaskOutcome::default()
            },
            None,
        );
    }
    output.sync_all()?;
    undo.sync_all()?;
    drop(output);
    drop(undo);
    check_cancel(context).inspect_err(|_| {
        cleanup_task_output(&output_path);
        cleanup_task_output(&undo_path);
    })?;
    let commit = match context.manager.commit_task_output(
        &context.session_id,
        context.base_revision,
        &output_path,
        line_breaks,
        &undo_path,
        undo_line_breaks,
        &context.cancel,
    ) {
        Ok(commit) => commit,
        Err(error) => {
            cleanup_task_output(&output_path);
            cleanup_task_output(&undo_path);
            return Err(error);
        }
    };
    Ok(TaskOutcome {
        processed_bytes: context.snapshot.len(),
        result_revision: Some(commit.revision),
        result_byte_length: Some(commit.byte_length),
        persisted_revision: Some(commit.persisted_revision),
        dirty: Some(commit.dirty),
        ..TaskOutcome::default()
    })
}

fn emit(
    context: &TaskContext,
    state: SegmentedTaskState,
    outcome: &TaskOutcome,
    message: Option<String>,
) {
    let Some(sink) = &context.sink else {
        return;
    };
    sink(SegmentedEvent::Task(TaskProgressEvent {
        session_id: context.session_id.clone(),
        task_id: context.task_id.clone(),
        base_revision: context.base_revision,
        revision: outcome.result_revision.unwrap_or(context.base_revision),
        request_id: context.task_id.clone(),
        kind: context.kind,
        state,
        processed_bytes: outcome.processed_bytes,
        total_bytes: context.snapshot.len(),
        match_count: outcome.match_count,
        current_match: outcome.current_match.clone(),
        nearby_matches: outcome.nearby_matches.clone(),
        result_revision: outcome.result_revision,
        result_byte_length: outcome.result_byte_length,
        persisted_revision: outcome.persisted_revision,
        dirty: outcome.dirty,
        output_path: outcome.output_path.clone(),
        message,
    }));
}

fn require_json(context: &TaskContext) -> TextDocumentResult<()> {
    if context.document_kind != SegmentedDocumentKind::Json {
        return Err(TextDocumentError::new(
            "task-invalid-kind",
            "JSON 任务只能用于 .json 文档",
        ));
    }
    Ok(())
}

fn check_cancel(context: &TaskContext) -> TextDocumentResult<()> {
    if context.cancel.load(Ordering::Acquire) {
        Err(TextDocumentError::new("task-cancelled", "后台任务已取消"))
    } else {
        Ok(())
    }
}

fn create_output(path: &Path) -> TextDocumentResult<File> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    Ok(OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(path)?)
}

fn cleanup_task_output(path: &Path) {
    match std::fs::remove_file(path) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => crate::app_logger::warn(
            "SegmentedDocument",
            &format!("清理后台任务临时文件失败：{error}"),
        ),
    }
}

fn stream_to_platform_clipboard(context: &TaskContext) -> TextDocumentResult<bool> {
    #[cfg(target_os = "macos")]
    let child = Command::new("pbcopy")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();

    #[cfg(target_os = "windows")]
    let child = Command::new("clip.exe")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let child: std::io::Result<std::process::Child> = Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "platform clipboard command unavailable",
    ));

    let mut child = match child {
        Ok(child) => child,
        Err(_) => return Ok(false),
    };
    let Some(mut stdin) = child.stdin.take() else {
        let _ = child.kill();
        return Ok(false);
    };
    let mut offset = 0_u64;
    while offset < context.snapshot.len() {
        if let Err(error) = check_cancel(context) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
        let chunk = context.snapshot.read_range(offset, TASK_CHUNK_BYTES)?;
        if chunk.is_empty() {
            break;
        }
        if stdin.write_all(&chunk).is_err() {
            drop(stdin);
            let _ = child.kill();
            let _ = child.wait();
            return Ok(false);
        }
        offset += chunk.len() as u64;
        emit(
            context,
            SegmentedTaskState::Running,
            &TaskOutcome {
                processed_bytes: offset,
                ..TaskOutcome::default()
            },
            None,
        );
    }
    drop(stdin);
    Ok(child.wait().map(|status| status.success()).unwrap_or(false))
}

struct KmpMatcher {
    pattern: Vec<u8>,
    failure: Vec<usize>,
    matched: usize,
    processed: u64,
}

impl KmpMatcher {
    fn new(pattern: &[u8]) -> Self {
        Self {
            pattern: pattern.to_vec(),
            failure: build_failure(pattern),
            matched: 0,
            processed: 0,
        }
    }

    fn push(&mut self, byte: u8) -> Option<u64> {
        while self.matched > 0 && self.pattern[self.matched] != byte {
            self.matched = self.failure[self.matched - 1];
        }
        if self.pattern[self.matched] == byte {
            self.matched += 1;
        }
        self.processed += 1;
        if self.matched != self.pattern.len() {
            return None;
        }
        let start = self.processed - self.pattern.len() as u64;
        self.matched = self.failure[self.matched - 1];
        Some(start)
    }
}

struct StreamingReplacer {
    pattern: Vec<u8>,
    failure: Vec<usize>,
    matched: usize,
    pending: VecDeque<u8>,
}

impl StreamingReplacer {
    fn new(pattern: &[u8]) -> Self {
        Self {
            pattern: pattern.to_vec(),
            failure: build_failure(pattern),
            matched: 0,
            pending: VecDeque::with_capacity(pattern.len()),
        }
    }

    fn push(
        &mut self,
        byte: u8,
        replacement: &[u8],
        output: &mut File,
        line_breaks: &mut u64,
    ) -> TextDocumentResult<bool> {
        // pending 始终等于 pattern 的当前前缀；KMP 回退时只有前导部分已不可能参与后续匹配。
        while self.matched > 0 && self.pattern[self.matched] != byte {
            let fallback = self.failure[self.matched - 1];
            for _ in 0..self.matched - fallback {
                let flushed = self.pending.pop_front().ok_or_else(|| {
                    TextDocumentError::new("task-state-invalid", "替换任务前缀状态异常")
                })?;
                write_counted(output, &[flushed], line_breaks)?;
            }
            self.matched = fallback;
        }
        if self.pattern[self.matched] == byte {
            self.pending.push_back(byte);
            self.matched += 1;
        } else {
            write_counted(output, &[byte], line_breaks)?;
        }
        if self.matched != self.pattern.len() {
            return Ok(false);
        }
        self.pending.clear();
        self.matched = 0;
        write_counted(output, replacement, line_breaks)?;
        Ok(true)
    }

    fn finish(&mut self, output: &mut File, line_breaks: &mut u64) -> TextDocumentResult<()> {
        while let Some(byte) = self.pending.pop_front() {
            write_counted(output, &[byte], line_breaks)?;
        }
        self.matched = 0;
        Ok(())
    }
}

fn build_failure(pattern: &[u8]) -> Vec<usize> {
    let mut failure = vec![0; pattern.len()];
    let mut matched = 0_usize;
    for index in 1..pattern.len() {
        while matched > 0 && pattern[index] != pattern[matched] {
            matched = failure[matched - 1];
        }
        if pattern[index] == pattern[matched] {
            matched += 1;
            failure[index] = matched;
        }
    }
    failure
}

fn write_counted(file: &mut File, bytes: &[u8], line_breaks: &mut u64) -> TextDocumentResult<()> {
    file.write_all(bytes)?;
    *line_breaks += bytes.iter().filter(|byte| **byte == b'\n').count() as u64;
    Ok(())
}

fn write_indent(file: &mut File, depth: usize) -> TextDocumentResult<()> {
    const SPACES: &[u8] = b"                                ";
    let mut remaining = depth.saturating_mul(2);
    while remaining > 0 {
        let count = remaining.min(SPACES.len());
        file.write_all(&SPACES[..count])?;
        remaining -= count;
    }
    Ok(())
}

fn next_task_id() -> String {
    let sequence = NEXT_TASK_ID.fetch_add(1, Ordering::Relaxed);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("task-{nanos:x}-{sequence:x}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kmp_matcher_preserves_overlapping_matches_across_stream() {
        let mut matcher = KmpMatcher::new(b"aba");
        let matches: Vec<_> = b"ababa"
            .iter()
            .filter_map(|byte| matcher.push(*byte))
            .collect();
        assert_eq!(matches, vec![0, 2]);
    }

    #[test]
    fn streaming_replacer_handles_prefix_fallback_without_rescanning() {
        let path = std::env::temp_dir().join(format!(
            "nomo-replacer-{}-{}",
            std::process::id(),
            NEXT_TASK_ID.fetch_add(1, Ordering::Relaxed)
        ));
        let mut output = File::create(&path).expect("create output");
        let mut replacer = StreamingReplacer::new(b"aab");
        let mut line_breaks = 0;
        let mut matches = 0;
        for byte in b"aaab aab" {
            if replacer
                .push(*byte, b"X", &mut output, &mut line_breaks)
                .expect("replace")
            {
                matches += 1;
            }
        }
        replacer
            .finish(&mut output, &mut line_breaks)
            .expect("finish");
        drop(output);

        assert_eq!(matches, 2);
        assert_eq!(std::fs::read(&path).expect("read output"), b"aX X");
        std::fs::remove_file(path).expect("cleanup");
    }

    #[test]
    fn search_page_rejects_partial_or_out_of_range_anchor() {
        for (anchor, direction) in [
            (Some(1), None),
            (None, Some(SegmentedSearchDirection::Forward)),
            (Some(11), Some(SegmentedSearchDirection::Backward)),
        ] {
            let error = validate_search_page(anchor, direction, 10).expect_err("invalid anchor");
            assert_eq!(error.code, "task-invalid-anchor");
        }
        validate_search_page(Some(10), Some(SegmentedSearchDirection::Forward), 10)
            .expect("EOF anchor is valid");
    }
}
