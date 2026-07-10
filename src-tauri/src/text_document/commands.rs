use super::{
    ApplySegmentedEditsResult, CancelSegmentedTaskResult, CheckSegmentedExternalChangeResult,
    DocumentSessionManager, EventSink, FlushSegmentedJournalResult, OpenSegmentedDocumentResult,
    SaveSegmentedRevisionResult, SegmentedEditBatch, SegmentedEvent, SegmentedHistoryResult,
    SegmentedSessionStatus, SegmentedWindow, StartSegmentedTaskRequest, StartSegmentedTaskResult,
    TextDocumentError, TextDocumentResult,
};
use std::{path::PathBuf, sync::Arc};
use tauri::{Emitter, State, WebviewWindow};

pub(crate) const INDEX_PROGRESS_EVENT: &str = "nomo://segmented-index-progress";
pub(crate) const TASK_PROGRESS_EVENT: &str = "nomo://segmented-task-progress";

#[tauri::command]
pub(crate) async fn open_segmented_document(
    window: WebviewWindow,
    manager: State<'_, DocumentSessionManager>,
    path: String,
) -> TextDocumentResult<OpenSegmentedDocumentResult> {
    let manager = manager.inner().clone();
    let sink = event_sink(window);
    run_blocking(move || manager.open_document(PathBuf::from(path), Some(sink))).await
}

#[tauri::command]
pub(crate) async fn reload_segmented_session(
    window: WebviewWindow,
    manager: State<'_, DocumentSessionManager>,
    session_id: String,
) -> TextDocumentResult<OpenSegmentedDocumentResult> {
    let manager = manager.inner().clone();
    let sink = event_sink(window);
    run_blocking(move || manager.reload_session(&session_id, Some(sink))).await
}

#[tauri::command]
pub(crate) async fn read_segmented_window(
    manager: State<'_, DocumentSessionManager>,
    session_id: String,
    revision: u64,
    start_byte: u64,
    target_bytes: usize,
    request_id: u64,
) -> TextDocumentResult<SegmentedWindow> {
    let manager = manager.inner().clone();
    run_blocking(move || {
        manager.read_window_with_request(
            &session_id,
            revision,
            start_byte,
            target_bytes,
            request_id,
        )
    })
    .await
}

#[tauri::command]
pub(crate) async fn apply_segmented_edits(
    manager: State<'_, DocumentSessionManager>,
    batch: SegmentedEditBatch,
) -> TextDocumentResult<ApplySegmentedEditsResult> {
    let manager = manager.inner().clone();
    run_blocking(move || manager.apply_edits(batch)).await
}

#[tauri::command]
pub(crate) async fn undo_segmented_revision(
    manager: State<'_, DocumentSessionManager>,
    session_id: String,
    base_revision: u64,
) -> TextDocumentResult<SegmentedHistoryResult> {
    let manager = manager.inner().clone();
    run_blocking(move || manager.undo_revision(&session_id, base_revision)).await
}

#[tauri::command]
pub(crate) async fn redo_segmented_revision(
    manager: State<'_, DocumentSessionManager>,
    session_id: String,
    base_revision: u64,
) -> TextDocumentResult<SegmentedHistoryResult> {
    let manager = manager.inner().clone();
    run_blocking(move || manager.redo_revision(&session_id, base_revision)).await
}

#[tauri::command]
pub(crate) async fn flush_segmented_journal(
    manager: State<'_, DocumentSessionManager>,
    session_id: String,
    revision: u64,
) -> TextDocumentResult<FlushSegmentedJournalResult> {
    let manager = manager.inner().clone();
    run_blocking(move || manager.flush_journal(&session_id, revision)).await
}

#[tauri::command]
pub(crate) async fn save_segmented_revision(
    manager: State<'_, DocumentSessionManager>,
    session_id: String,
    revision: u64,
    target_path: Option<String>,
    overwrite_external: Option<bool>,
) -> TextDocumentResult<SaveSegmentedRevisionResult> {
    let manager = manager.inner().clone();
    run_blocking(move || {
        manager.save_revision(
            &session_id,
            revision,
            target_path.map(PathBuf::from),
            overwrite_external.unwrap_or(false),
        )
    })
    .await
}

#[tauri::command]
pub(crate) async fn start_segmented_task(
    window: WebviewWindow,
    manager: State<'_, DocumentSessionManager>,
    request: StartSegmentedTaskRequest,
) -> TextDocumentResult<StartSegmentedTaskResult> {
    let manager = manager.inner().clone();
    let sink = event_sink(window);
    run_blocking(move || manager.start_task(request, Some(sink))).await
}

#[tauri::command]
pub(crate) fn cancel_segmented_task(
    manager: State<'_, DocumentSessionManager>,
    task_id: String,
) -> TextDocumentResult<CancelSegmentedTaskResult> {
    manager.cancel_task(&task_id)
}

#[tauri::command]
pub(crate) async fn close_segmented_session(
    manager: State<'_, DocumentSessionManager>,
    session_id: String,
    discard_changes: Option<bool>,
) -> TextDocumentResult<()> {
    let manager = manager.inner().clone();
    run_blocking(move || manager.close_session(&session_id, discard_changes.unwrap_or(false))).await
}

#[tauri::command]
pub(crate) fn check_segmented_external_change(
    manager: State<'_, DocumentSessionManager>,
    session_id: String,
) -> TextDocumentResult<CheckSegmentedExternalChangeResult> {
    manager.check_external_change(&session_id)
}

#[tauri::command]
pub(crate) fn get_segmented_session_status(
    manager: State<'_, DocumentSessionManager>,
    session_id: String,
) -> TextDocumentResult<SegmentedSessionStatus> {
    manager.session_status(&session_id)
}

fn event_sink(window: WebviewWindow) -> EventSink {
    Arc::new(move |event| {
        let result = match event {
            SegmentedEvent::Index(payload) => window.emit(INDEX_PROGRESS_EVENT, payload),
            SegmentedEvent::Task(payload) => window.emit(TASK_PROGRESS_EVENT, payload),
        };
        if let Err(error) = result {
            crate::app_logger::warn(
                "SegmentedDocument",
                &format!("发送分段文档事件失败：{error}"),
            );
        }
    })
}

async fn run_blocking<T, F>(operation: F) -> TextDocumentResult<T>
where
    T: Send + 'static,
    F: FnOnce() -> TextDocumentResult<T> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(operation)
        .await
        .map_err(|error| {
            TextDocumentError::new(
                "background-join-failed",
                format!("后台操作异常结束：{error}"),
            )
        })?
}
