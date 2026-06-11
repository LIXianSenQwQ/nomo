use crate::config::{self, now_ts};
use crate::models::{
    RecentEntry, RecentEntryInput, RecentEntryType, SettingInput, SettingRecord, SnapshotInput,
    SnapshotRecord,
};
use std::{
    collections::hash_map::DefaultHasher,
    hash::{Hash, Hasher},
};
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub(crate) fn remember_recent_entry(app: AppHandle, input: RecentEntryInput) -> Result<(), String> {
    let now = now_ts();
    let modified_at = if input.entry_type == RecentEntryType::File {
        crate::file_system::file_modified_at(&input.path)
    } else {
        0
    };
    let entry = RecentEntry {
        path: input.path,
        entry_type: input.entry_type.as_str().to_string(),
        title: input.title,
        modified_at,
        word_count: input.word_count,
        opened_at: now,
    };

    config::with_manager(&app, |manager| {
        manager.update(|config| {
            config.recent.entries.retain(|item| item.path != entry.path);
            config.recent.entries.insert(0, entry);
        })
    })
}

#[tauri::command]
pub(crate) fn list_recent_entries(app: AppHandle) -> Result<Vec<RecentEntry>, String> {
    query_recent_entries_with_limit(&app, 20)
}

#[tauri::command]
pub(crate) fn clear_recent_entries(app: AppHandle) -> Result<(), String> {
    config::with_manager(&app, |manager| {
        manager.update(|config| config.recent.entries.clear())
    })
}

#[tauri::command]
pub(crate) fn create_document_snapshot(app: AppHandle, input: SnapshotInput) -> Result<(), String> {
    let now = now_ts();
    let content_hash = hash_text(&input.markdown);
    let snapshot = SnapshotRecord {
        id: format!("{now}-{content_hash}"),
        document_path: input.path,
        content_hash,
        markdown: input.markdown,
        created_at: now,
        reason: input.reason,
    };

    config::with_manager(&app, |manager| {
        manager.update(|config| {
            let snapshots = config
                .snapshots
                .documents
                .entry(snapshot.document_path.clone())
                .or_default();
            snapshots.insert(0, snapshot);
            snapshots.truncate(20);
        })
    })
}

#[tauri::command]
pub(crate) fn list_document_snapshots(
    app: AppHandle,
    path: String,
) -> Result<Vec<SnapshotRecord>, String> {
    config::with_manager(&app, |manager| {
        let config = manager.get_config()?;
        Ok(config
            .snapshots
            .documents
            .get(&path)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .take(20)
            .collect())
    })
}

#[tauri::command]
pub(crate) fn update_app_setting(app: AppHandle, input: SettingInput) -> Result<(), String> {
    update_settings(app, vec![input])
}

#[tauri::command]
pub(crate) fn update_app_settings(app: AppHandle, inputs: Vec<SettingInput>) -> Result<(), String> {
    update_settings(app, inputs)
}

#[tauri::command]
pub(crate) fn list_app_settings(app: AppHandle) -> Result<Vec<SettingRecord>, String> {
    config::with_manager(&app, |manager| {
        let config = manager.get_config()?;
        Ok(config.app.settings.values().cloned().collect())
    })
}

pub(crate) fn query_recent_entries<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Vec<RecentEntry>, String> {
    query_recent_entries_with_limit(app, 8)
}

pub(crate) fn get_setting_value<R: Runtime>(
    app: &AppHandle<R>,
    key: &str,
) -> Result<Option<String>, String> {
    config::with_manager(app, |manager| {
        let config = manager.get_config()?;
        Ok(config
            .app
            .settings
            .get(key)
            .map(|record| record.value_json.clone()))
    })
}

fn update_settings<R: Runtime>(app: AppHandle<R>, inputs: Vec<SettingInput>) -> Result<(), String> {
    if inputs.is_empty() {
        return Ok(());
    }

    let now = now_ts();
    config::with_manager(&app, |manager| {
        manager.update(|config| {
            for input in inputs {
                route_setting_to_section(config, &input.key, &input.value_json);
                config.app.settings.insert(
                    input.key.clone(),
                    SettingRecord {
                        key: input.key,
                        value_json: input.value_json,
                        updated_at: now,
                    },
                );
            }
        })
    })
}

fn route_setting_to_section(config: &mut super::AppConfig, key: &str, value_json: &str) {
    let value =
        serde_json::from_str::<serde_json::Value>(value_json).unwrap_or(serde_json::Value::Null);
    if let Some(label) = key.strip_prefix("windowState:") {
        config.window.settings.insert(label.to_string(), value);
    } else if let Some(label) = key.strip_prefix("workspaceTabs:") {
        config.workspace.settings.insert(label.to_string(), value);
    } else if let Some(label) = key.strip_prefix("pendingFolder:") {
        config
            .window
            .settings
            .insert(format!("pendingFolder:{label}"), value);
    } else if let Some(label) = key.strip_prefix("pendingExternalOpen:") {
        config
            .window
            .settings
            .insert(format!("pendingExternalOpen:{label}"), value);
    } else if is_editor_setting_key(key) {
        config.editor.settings.insert(key.to_string(), value);
    }
}

fn is_editor_setting_key(key: &str) -> bool {
    matches!(
        key,
        "fontSize"
            | "lineHeight"
            | "contentWidthPercent"
            | "blockStyle"
            | "editorMode"
            | "autoSave"
            | "sourceCodeFontSize"
            | "sourceCodeLineHeight"
    )
}

fn query_recent_entries_with_limit<R: Runtime>(
    app: &AppHandle<R>,
    limit: usize,
) -> Result<Vec<RecentEntry>, String> {
    config::with_manager(app, |manager| {
        let mut entries = manager.get_config()?.recent.entries;
        entries.sort_by(|left, right| right.opened_at.cmp(&left.opened_at));
        entries.truncate(limit);
        Ok(entries)
    })
}

fn hash_text(text: &str) -> String {
    let mut hasher = DefaultHasher::new();
    text.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

#[cfg(test)]
mod tests {
    use super::hash_text;

    #[test]
    fn hashes_equal_text_consistently() {
        assert_eq!(hash_text("hello"), hash_text("hello"));
        assert_ne!(hash_text("hello"), hash_text("world"));
    }
}
