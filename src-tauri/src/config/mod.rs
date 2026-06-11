use crate::models::{RecentEntry, SettingRecord, SnapshotRecord};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, RwLock},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, Runtime};

pub(crate) mod commands;

const CONFIG_FILE_NAME: &str = "config.json";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub(crate) struct AppConfig {
    pub(crate) app: AppSection,
    pub(crate) editor: EditorSection,
    pub(crate) window: WindowSection,
    pub(crate) recent: RecentSection,
    pub(crate) workspace: WorkspaceSection,
    pub(crate) snapshots: SnapshotSection,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub(crate) struct AppSection {
    pub(crate) settings: BTreeMap<String, SettingRecord>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub(crate) struct EditorSection {
    pub(crate) settings: BTreeMap<String, serde_json::Value>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub(crate) struct WindowSection {
    pub(crate) settings: BTreeMap<String, serde_json::Value>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub(crate) struct RecentSection {
    pub(crate) entries: Vec<RecentEntry>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub(crate) struct WorkspaceSection {
    pub(crate) settings: BTreeMap<String, serde_json::Value>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub(crate) struct SnapshotSection {
    pub(crate) documents: BTreeMap<String, Vec<SnapshotRecord>>,
}

#[derive(Clone)]
pub(crate) struct ConfigManager {
    config_path: PathBuf,
    config: Arc<RwLock<AppConfig>>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            app: AppSection::default(),
            editor: EditorSection::default(),
            window: WindowSection::default(),
            recent: RecentSection::default(),
            workspace: WorkspaceSection::default(),
            snapshots: SnapshotSection::default(),
        }
    }
}

impl ConfigManager {
    pub(crate) fn load_or_default<R: Runtime>(app: &AppHandle<R>) -> Result<Self, String> {
        let config_path = config_path(app)?;
        Self::load_or_default_from_path(config_path)
    }

    fn load_or_default_from_path(config_path: PathBuf) -> Result<Self, String> {
        let config = match fs::read_to_string(&config_path) {
            Ok(content) => match serde_json::from_str::<AppConfig>(&content) {
                Ok(config) => config,
                Err(error) => {
                    backup_broken_config(&config_path)?;
                    crate::app_logger::error(
                        "Config",
                        &format!("配置文件损坏，已备份并使用默认配置：{error}"),
                    );
                    AppConfig::default()
                }
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => AppConfig::default(),
            Err(error) => return Err(format!("读取配置文件失败：{error}")),
        };

        let manager = Self {
            config_path,
            config: Arc::new(RwLock::new(config)),
        };
        manager.save()?;
        Ok(manager)
    }

    pub(crate) fn get_config(&self) -> Result<AppConfig, String> {
        self.config
            .read()
            .map(|config| config.clone())
            .map_err(|error| format!("读取配置状态失败：{error}"))
    }

    pub(crate) fn update<F>(&self, updater: F) -> Result<(), String>
    where
        F: FnOnce(&mut AppConfig),
    {
        let next_config = {
            let mut config = self
                .config
                .write()
                .map_err(|error| format!("更新配置状态失败：{error}"))?;
            updater(&mut config);
            config.clone()
        };
        self.save_config(&next_config)
    }

    pub(crate) fn save(&self) -> Result<(), String> {
        let config = self.get_config()?;
        self.save_config(&config)
    }

    #[allow(dead_code)]
    pub(crate) fn reset_to_default(&self) -> Result<(), String> {
        self.update(|config| *config = AppConfig::default())
    }

    fn save_config(&self, config: &AppConfig) -> Result<(), String> {
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("创建配置目录失败：{error}"))?;
        }

        let temp_path = self.config_path.with_extension("json.tmp");
        let content = serde_json::to_string_pretty(config)
            .map_err(|error| format!("序列化配置失败：{error}"))?;
        {
            let mut file =
                File::create(&temp_path).map_err(|error| format!("创建临时配置失败：{error}"))?;
            file.write_all(content.as_bytes())
                .map_err(|error| format!("写入临时配置失败：{error}"))?;
            file.sync_all()
                .map_err(|error| format!("同步临时配置失败：{error}"))?;
        }

        if cfg!(windows) && self.config_path.exists() {
            fs::remove_file(&self.config_path)
                .map_err(|error| format!("替换旧配置文件失败：{error}"))?;
        }
        fs::rename(&temp_path, &self.config_path)
            .map_err(|error| format!("替换配置文件失败：{error}"))?;
        Ok(())
    }
}

pub(crate) fn with_manager<R: Runtime, T>(
    app: &AppHandle<R>,
    operation: impl FnOnce(&ConfigManager) -> Result<T, String>,
) -> Result<T, String> {
    let manager = app
        .try_state::<ConfigManager>()
        .ok_or_else(|| "配置管理器尚未初始化".to_string())?;
    operation(&manager)
}

pub(crate) fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn config_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("定位应用数据目录失败：{error}"))?;
    fs::create_dir_all(&app_dir).map_err(|error| format!("创建应用数据目录失败：{error}"))?;
    Ok(app_dir.join(CONFIG_FILE_NAME))
}

fn backup_broken_config(config_path: &Path) -> Result<(), String> {
    if !config_path.exists() {
        return Ok(());
    }
    let backup_path = config_path.with_file_name(format!("config.broken.{}.json", now_ts()));
    fs::rename(config_path, backup_path).map_err(|error| format!("备份损坏配置失败：{error}"))
}

#[cfg(test)]
mod tests {
    use super::{AppConfig, ConfigManager};
    use std::{fs, path::PathBuf};

    #[test]
    fn fills_missing_sections_with_defaults() {
        let config = serde_json::from_str::<AppConfig>(r#"{"app":{}}"#).expect("config");

        assert!(config.app.settings.is_empty());
        assert!(config.recent.entries.is_empty());
        assert!(config.snapshots.documents.is_empty());
    }

    #[test]
    fn creates_default_config_file_when_missing() {
        let root = unique_test_dir("create-default");
        fs::create_dir_all(&root).expect("test dir");
        let config_path = root.join("config.json");

        let manager = ConfigManager::load_or_default_from_path(config_path.clone()).expect("load");

        assert!(config_path.exists());
        assert!(manager
            .get_config()
            .expect("config")
            .recent
            .entries
            .is_empty());
        cleanup(root);
    }

    #[test]
    fn backs_up_broken_config_and_uses_defaults() {
        let root = unique_test_dir("broken");
        fs::create_dir_all(&root).expect("test dir");
        let config_path = root.join("config.json");
        fs::write(&config_path, "{ broken").expect("broken config");

        let manager = ConfigManager::load_or_default_from_path(config_path.clone()).expect("load");

        assert!(config_path.exists());
        assert!(manager
            .get_config()
            .expect("config")
            .app
            .settings
            .is_empty());
        assert!(fs::read_dir(&root)
            .expect("read dir")
            .flatten()
            .any(|entry| entry
                .file_name()
                .to_string_lossy()
                .starts_with("config.broken.")));
        cleanup(root);
    }

    fn unique_test_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("nomo-config-{name}-{}", super::now_ts()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn cleanup(path: PathBuf) {
        let _ = fs::remove_dir_all(path);
    }
}
