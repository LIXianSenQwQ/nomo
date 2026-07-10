use super::{
    chunk_reader::DocumentSnapshot, EventSink, IndexProgressEvent, JsonLexicalMode,
    JsonLexicalState, LineEnding, SegmentedEvent,
};
use serde::{Deserialize, Serialize};
use std::path::Path;

const INDEX_CHUNK_BYTES: usize = 256 * 1024;
const CHECKPOINT_STRIDE_BYTES: u64 = 1024 * 1024;

#[derive(Debug, Clone)]
pub(super) struct LineIndexEdit {
    pub(super) from_byte: u64,
    pub(super) to_byte: u64,
    pub(super) inserted_bytes: u64,
    pub(super) inserted_lines: u64,
    pub(super) deleted_lines: u64,
}

#[derive(Debug, Clone)]
pub(super) struct LineIndexDelta {
    pub(super) base_revision: u64,
    pub(super) revision: u64,
    pub(super) edits: Vec<LineIndexEdit>,
}

#[derive(Debug, Clone, Copy)]
pub(super) struct LineIndexBuildCheckpoint {
    byte_offset: u64,
    line: u64,
    json_lexical_state: JsonLexicalState,
    previous_cr: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LineCheckpoint {
    byte_offset: u64,
    line: u64,
    json_lexical_state: JsonLexicalState,
    #[serde(default = "default_true")]
    json_state_valid: bool,
    // 块尾 CR 尚不能判定是 CRLF 还是 lone CR；后续补扫从此状态继续。
    #[serde(default)]
    previous_cr: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(super) struct LineIndex {
    #[serde(default)]
    revision: u64,
    indexed_bytes: u64,
    total_bytes: u64,
    estimated_lines: u64,
    completed: bool,
    checkpoints: Vec<LineCheckpoint>,
    utf8_valid: bool,
    line_ending: LineEnding,
    #[serde(default)]
    json_valid_through: u64,
    #[serde(default)]
    line_ending_exact: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LineIndexCache {
    version: u32,
    baseline_key: String,
    index: LineIndex,
}

impl LineIndex {
    pub(super) fn load_cache(
        path: &Path,
        baseline_key: &str,
    ) -> super::TextDocumentResult<Option<Self>> {
        let bytes = match std::fs::read(path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error.into()),
        };
        let cache: LineIndexCache = serde_json::from_slice(&bytes).map_err(|error| {
            super::TextDocumentError::new(
                "line-index-cache-corrupt",
                format!("行索引缓存无法解析：{error}"),
            )
        })?;
        if cache.version != 3 || cache.baseline_key != baseline_key || !cache.index.completed {
            return Ok(None);
        }
        Ok(Some(cache.index))
    }

    pub(super) fn save_cache(
        &self,
        path: &Path,
        baseline_key: &str,
    ) -> super::TextDocumentResult<()> {
        if !self.completed {
            return Ok(());
        }
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let temp = path.with_extension("index.tmp");
        let bytes = serde_json::to_vec(&LineIndexCache {
            version: 3,
            baseline_key: baseline_key.to_string(),
            index: self.clone(),
        })
        .map_err(|error| {
            super::TextDocumentError::new(
                "line-index-cache-write-failed",
                format!("行索引缓存无法序列化：{error}"),
            )
        })?;
        std::fs::write(&temp, bytes)?;
        std::fs::rename(temp, path)?;
        Ok(())
    }

    pub(super) fn is_completed(&self) -> bool {
        self.completed
    }

    pub(super) fn utf8_valid(&self) -> bool {
        self.utf8_valid
    }

    pub(super) fn line_ending(&self) -> LineEnding {
        self.line_ending
    }

    pub(super) fn estimated_lines(&self) -> u64 {
        self.estimated_lines
    }

    pub(super) fn indexed_bytes(&self) -> u64 {
        self.indexed_bytes
    }

    pub(super) fn total_bytes(&self) -> u64 {
        self.total_bytes
    }

    pub(super) fn revision(&self) -> u64 {
        self.revision
    }

    pub(super) fn line_ending_exact(&self) -> bool {
        self.line_ending_exact
    }

    pub(super) fn pending(total_bytes: u64, revision: u64) -> Self {
        Self {
            revision,
            total_bytes,
            checkpoints: vec![LineCheckpoint {
                byte_offset: 0,
                line: 0,
                json_lexical_state: JsonLexicalState::default(),
                json_state_valid: true,
                previous_cr: false,
            }],
            utf8_valid: false,
            line_ending: LineEnding::Lf,
            json_valid_through: 0,
            line_ending_exact: false,
            ..Self::default()
        }
    }

    /// 将 revisioned 编辑映射到已完成检查点；只调整有界元数据，不扫描正文。
    pub(super) fn apply_delta(&self, delta: &LineIndexDelta) -> super::TextDocumentResult<Self> {
        if !self.completed || self.revision != delta.base_revision {
            return Err(super::TextDocumentError::new(
                "line-index-delta-base-mismatch",
                format!(
                    "行索引 delta 基线不匹配：index={}, delta={}",
                    self.revision, delta.base_revision
                ),
            ));
        }
        let mut next = self.clone();
        for edit in delta.edits.iter().rev() {
            next.apply_edit(edit)?;
        }
        next.revision = delta.revision;
        next.indexed_bytes = next.total_bytes;
        next.completed = true;
        next.line_ending_exact = delta.edits.is_empty() && next.line_ending_exact;
        Ok(next)
    }

    fn apply_edit(&mut self, edit: &LineIndexEdit) -> super::TextDocumentResult<()> {
        let removed_bytes = edit.to_byte.saturating_sub(edit.from_byte);
        let byte_delta = edit.inserted_bytes as i128 - removed_bytes as i128;
        let line_delta = edit.inserted_lines as i128 - edit.deleted_lines as i128;
        let mut checkpoints = Vec::with_capacity(self.checkpoints.len());
        for mut checkpoint in self.checkpoints.drain(..) {
            if checkpoint.byte_offset <= edit.from_byte {
                checkpoints.push(checkpoint);
                continue;
            }
            if checkpoint.byte_offset < edit.to_byte {
                continue;
            }
            checkpoint.byte_offset = checked_add_signed(checkpoint.byte_offset, byte_delta)?;
            checkpoint.line = checked_add_signed(checkpoint.line, line_delta)?;
            // 纯删除时优先保留 from 处原有检查点，避免 JSON 状态被删除区尾状态覆盖。
            if checkpoint.byte_offset == edit.from_byte
                && checkpoints
                    .last()
                    .is_some_and(|previous| previous.byte_offset == edit.from_byte)
            {
                continue;
            }
            checkpoints.push(checkpoint);
        }
        self.checkpoints = checkpoints;
        self.total_bytes = checked_add_signed(self.total_bytes, byte_delta)?;
        self.estimated_lines = checked_add_signed(self.estimated_lines, line_delta)?;
        self.json_valid_through = self.json_valid_through.min(edit.from_byte);
        self.line_ending_exact = false;
        Ok(())
    }

    pub(super) fn progress(&self) -> f64 {
        if self.total_bytes == 0 || self.completed {
            1.0
        } else {
            self.indexed_bytes as f64 / self.total_bytes as f64
        }
    }

    #[cfg(test)]
    pub(super) fn nearest_checkpoint(&self, byte: u64) -> (u64, u64) {
        let (offset, line, _) = self.nearest_line_checkpoint(byte);
        (offset, line)
    }

    pub(super) fn nearest_line_checkpoint(&self, byte: u64) -> (u64, u64, bool) {
        self.checkpoints
            .get(
                self.checkpoints
                    .partition_point(|checkpoint| checkpoint.byte_offset <= byte)
                    .saturating_sub(1),
            )
            .map(|checkpoint| {
                (
                    checkpoint.byte_offset,
                    checkpoint.line,
                    checkpoint.previous_cr,
                )
            })
            .unwrap_or((0, 0, false))
    }

    /// 合并前台补扫得到的行检查点，不提升 indexed_bytes，也不伪造 JSON/UTF-8 扫描进度。
    pub(super) fn apply_line_checkpoints(&mut self, checkpoints: &[(u64, u64, bool)]) {
        for &(byte_offset, line, previous_cr) in checkpoints {
            if byte_offset > self.total_bytes {
                continue;
            }
            match self
                .checkpoints
                .binary_search_by_key(&byte_offset, |checkpoint| checkpoint.byte_offset)
            {
                Ok(index) => {
                    self.checkpoints[index].line = line;
                    self.checkpoints[index].previous_cr = previous_cr;
                }
                Err(index) => self.checkpoints.insert(
                    index,
                    LineCheckpoint {
                        byte_offset,
                        line,
                        json_lexical_state: JsonLexicalState::default(),
                        json_state_valid: false,
                        previous_cr,
                    },
                ),
            }
        }
    }

    /// 后台构建每跨过一个稀疏检查点才增量发布；Arc::make_mut 常态下原地更新，避免复制整棵索引。
    pub(super) fn apply_build_progress(
        &mut self,
        indexed_bytes: u64,
        estimated_lines: u64,
        checkpoint: LineIndexBuildCheckpoint,
    ) {
        self.indexed_bytes = self.indexed_bytes.max(indexed_bytes);
        self.estimated_lines = estimated_lines;
        self.json_valid_through = self.json_valid_through.max(indexed_bytes);
        match self
            .checkpoints
            .binary_search_by_key(&checkpoint.byte_offset, |entry| entry.byte_offset)
        {
            Ok(index) => {
                let entry = &mut self.checkpoints[index];
                entry.line = checkpoint.line;
                entry.json_lexical_state = checkpoint.json_lexical_state;
                entry.json_state_valid = true;
                entry.previous_cr = checkpoint.previous_cr;
            }
            Err(index) => self.checkpoints.insert(
                index,
                LineCheckpoint {
                    byte_offset: checkpoint.byte_offset,
                    line: checkpoint.line,
                    json_lexical_state: checkpoint.json_lexical_state,
                    json_state_valid: true,
                    previous_cr: checkpoint.previous_cr,
                },
            ),
        }
    }

    pub(super) fn json_checkpoint(&self, byte: u64) -> Option<(u64, JsonLexicalState)> {
        if byte > self.indexed_bytes || byte > self.json_valid_through {
            return None;
        }
        self.checkpoints[..self
            .checkpoints
            .partition_point(|checkpoint| checkpoint.byte_offset <= byte)]
            .iter()
            .rev()
            .find(|checkpoint| checkpoint.json_state_valid)
            .map(|checkpoint| (checkpoint.byte_offset, checkpoint.json_lexical_state))
    }

    pub(super) fn build(
        session_id: &str,
        snapshot: &DocumentSnapshot,
        sink: Option<&EventSink>,
        on_progress: Option<&dyn Fn(u64, u64, LineIndexBuildCheckpoint)>,
        should_cancel: &dyn Fn() -> bool,
    ) -> super::TextDocumentResult<Option<Self>> {
        let mut index = Self::pending(snapshot.len(), snapshot.revision);
        let mut offset = 0_u64;
        let mut lines = 0_u64;
        let mut next_checkpoint = CHECKPOINT_STRIDE_BYTES;
        let mut json_state = JsonLexicalState::default();
        let mut utf8_tail = Vec::with_capacity(4);
        let mut utf8_valid = true;
        let mut previous_cr = false;
        let mut lf = 0_u64;
        let mut crlf = 0_u64;
        let mut lone_cr = 0_u64;
        while offset < snapshot.len() {
            if should_cancel() {
                return Ok(None);
            }
            let bytes = snapshot.read_range(offset, INDEX_CHUNK_BYTES)?;
            if bytes.is_empty() {
                break;
            }
            update_utf8_validation(&mut utf8_tail, &bytes, &mut utf8_valid);
            update_line_endings(
                &bytes,
                &mut previous_cr,
                &mut lf,
                &mut crlf,
                &mut lone_cr,
                &mut lines,
            );
            advance_json_state(&mut json_state, &bytes);
            offset += bytes.len() as u64;
            let mut published_checkpoint = None;
            if offset >= next_checkpoint {
                index.checkpoints.push(LineCheckpoint {
                    // 检查点必须和已统计的真实块尾对齐，不能把块尾行数冒充为块内偏移。
                    byte_offset: offset,
                    line: lines,
                    json_lexical_state: json_state,
                    json_state_valid: true,
                    previous_cr,
                });
                published_checkpoint = Some(LineIndexBuildCheckpoint {
                    byte_offset: offset,
                    line: lines,
                    json_lexical_state: json_state,
                    previous_cr,
                });
                next_checkpoint = offset + CHECKPOINT_STRIDE_BYTES;
            }
            index.indexed_bytes = offset;
            index.estimated_lines = lines;
            index.json_valid_through = offset;
            if let (Some(on_progress), Some(checkpoint)) = (on_progress, published_checkpoint) {
                on_progress(index.indexed_bytes, index.estimated_lines, checkpoint);
            }
            emit_progress(session_id, snapshot.revision, &index, false, sink);
        }
        index.indexed_bytes = snapshot.len();
        index.estimated_lines = lines;
        if previous_cr {
            lone_cr += 1;
            lines += 1;
        }
        index.estimated_lines = lines;
        if index
            .checkpoints
            .last()
            .is_none_or(|checkpoint| checkpoint.byte_offset != snapshot.len())
        {
            index.checkpoints.push(LineCheckpoint {
                byte_offset: snapshot.len(),
                line: lines,
                json_lexical_state: json_state,
                json_state_valid: true,
                previous_cr: false,
            });
        } else if let Some(last) = index.checkpoints.last_mut() {
            last.line = lines;
            last.previous_cr = false;
        }
        index.utf8_valid = utf8_valid && utf8_tail.is_empty();
        index.line_ending = classify_line_ending(lf, crlf, lone_cr);
        index.json_valid_through = snapshot.len();
        index.line_ending_exact = true;
        index.completed = true;
        if should_cancel() {
            return Ok(None);
        }
        Ok(Some(index))
    }
}

fn default_true() -> bool {
    true
}

fn checked_add_signed(value: u64, delta: i128) -> super::TextDocumentResult<u64> {
    let next = value as i128 + delta;
    u64::try_from(next).map_err(|_| {
        super::TextDocumentError::new(
            "line-index-delta-overflow",
            "行索引 delta 导致字节或行号越界",
        )
    })
}

pub(super) fn advance_json_state(state: &mut JsonLexicalState, bytes: &[u8]) {
    for byte in bytes {
        match state.mode {
            JsonLexicalMode::Default if *byte == b'"' => {
                state.mode = JsonLexicalMode::String;
                state.escaped = false;
            }
            JsonLexicalMode::Default => {}
            JsonLexicalMode::String if state.escaped => state.escaped = false,
            JsonLexicalMode::String if *byte == b'\\' => state.escaped = true,
            JsonLexicalMode::String if *byte == b'"' => {
                state.mode = JsonLexicalMode::Default;
                state.escaped = false;
            }
            JsonLexicalMode::String => {}
        }
    }
}

fn update_utf8_validation(tail: &mut Vec<u8>, bytes: &[u8], valid: &mut bool) {
    if !*valid {
        return;
    }
    let mut combined = Vec::with_capacity(tail.len() + bytes.len());
    combined.extend_from_slice(tail);
    combined.extend_from_slice(bytes);
    tail.clear();
    if let Err(error) = std::str::from_utf8(&combined) {
        if error.error_len().is_some() {
            *valid = false;
        } else {
            tail.extend_from_slice(&combined[error.valid_up_to()..]);
        }
    }
}

fn update_line_endings(
    bytes: &[u8],
    previous_cr: &mut bool,
    lf: &mut u64,
    crlf: &mut u64,
    lone_cr: &mut u64,
    lines: &mut u64,
) {
    for byte in bytes {
        if *byte == b'\n' {
            if *previous_cr {
                *crlf += 1;
            } else {
                *lf += 1;
            }
            *lines += 1;
            *previous_cr = false;
            continue;
        }
        if *previous_cr {
            *lone_cr += 1;
            *lines += 1;
        }
        *previous_cr = *byte == b'\r';
    }
}

fn classify_line_ending(lf: u64, crlf: u64, lone_cr: u64) -> LineEnding {
    if crlf > 0 && lf == 0 && lone_cr == 0 {
        LineEnding::Crlf
    } else if crlf == 0 && lone_cr == 0 {
        LineEnding::Lf
    } else {
        LineEnding::Mixed
    }
}

fn emit_progress(
    session_id: &str,
    revision: u64,
    index: &LineIndex,
    completed: bool,
    sink: Option<&EventSink>,
) {
    if let Some(sink) = sink {
        sink(SegmentedEvent::Index(IndexProgressEvent {
            session_id: session_id.to_string(),
            task_id: format!("index-{session_id}-{revision}"),
            request_id: format!("index-{session_id}-{revision}"),
            revision,
            indexed_bytes: index.indexed_bytes,
            total_bytes: index.total_bytes,
            estimated_lines: index.estimated_lines,
            completed,
            encoding: None,
            line_ending: None,
            readonly: None,
            baseline_error: None,
        }));
    }
}

#[cfg(test)]
mod tests {
    use super::{LineCheckpoint, LineIndex};
    use crate::text_document::JsonLexicalState;

    #[test]
    fn checkpoint_lookup_returns_the_nearest_preceding_entry() {
        let mut index = LineIndex::pending(3_000_000, 0);
        index.indexed_bytes = 3_000_000;
        index.json_valid_through = 3_000_000;
        index.checkpoints.extend([
            LineCheckpoint {
                byte_offset: 1_000_000,
                line: 10,
                json_lexical_state: JsonLexicalState::default(),
                json_state_valid: true,
                previous_cr: false,
            },
            LineCheckpoint {
                byte_offset: 2_000_000,
                line: 20,
                json_lexical_state: JsonLexicalState::default(),
                json_state_valid: true,
                previous_cr: false,
            },
        ]);

        assert_eq!(index.nearest_checkpoint(1_500_000), (1_000_000, 10));
        assert_eq!(index.nearest_checkpoint(2_000_000), (2_000_000, 20));
        assert_eq!(
            index.json_checkpoint(2_500_000).map(|value| value.0),
            Some(2_000_000)
        );
    }
}
