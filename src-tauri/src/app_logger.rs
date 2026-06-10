use chrono::Local;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    sync::{Mutex, OnceLock},
};

const MAX_LOG_FILE_BYTES: u64 = 5 * 1024 * 1024;

struct LoggerState {
    enabled: bool,
}

static LOGGER_STATE: OnceLock<Mutex<LoggerState>> = OnceLock::new();

pub(crate) fn init() {
    info("App", "日志系统初始化");
}

#[tauri::command]
pub(crate) fn set_logger_enabled(enabled: bool) {
    set_enabled(enabled);
}

#[tauri::command]
pub(crate) fn get_logger_enabled() -> bool {
    is_enabled()
}

#[tauri::command]
pub(crate) fn log_message(level: String, tag: String, message: String) {
    write(&level, &tag, &message);
}

pub(crate) fn set_enabled(enabled: bool) {
    if let Ok(mut state) = logger_state().lock() {
        state.enabled = enabled;
    }
    if enabled {
        write_force("INFO", "Logger", "日志输出已开启");
    } else {
        write_force("INFO", "Logger", "日志输出已关闭");
    }
}

pub(crate) fn is_enabled() -> bool {
    logger_state()
        .lock()
        .map(|state| state.enabled)
        .unwrap_or(true)
}

pub(crate) fn debug(tag: &str, message: &str) {
    write("DEBUG", tag, message);
}

pub(crate) fn info(tag: &str, message: &str) {
    write("INFO", tag, message);
}

pub(crate) fn warn(tag: &str, message: &str) {
    write("WARN", tag, message);
}

pub(crate) fn error(tag: &str, message: &str) {
    write("ERROR", tag, message);
}

pub(crate) fn perf(tag: &str, operation: &str, elapsed: std::time::Duration) {
    write(
        "PERF",
        tag,
        &format!("{operation} 耗时 {:.2}ms", elapsed.as_secs_f64() * 1000.0),
    );
}

fn write(level: &str, tag: &str, message: &str) {
    if !is_enabled() {
        return;
    }
    write_force(level, tag, message);
}

fn write_force(level: &str, tag: &str, message: &str) {
    let line = format_log_line(level, tag, message);
    eprintln!("{line}");
    if let Err(error) = append_to_log_file(&line) {
        eprintln!(
            "{}",
            format_log_line("WARN", "Logger", &format!("写入日志文件失败：{error}"))
        );
    }
}

fn logger_state() -> &'static Mutex<LoggerState> {
    LOGGER_STATE.get_or_init(|| Mutex::new(LoggerState { enabled: true }))
}

fn format_log_line(level: &str, tag: &str, message: &str) -> String {
    format!(
        "[{}][{}][{}] {}",
        Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
        level.to_uppercase(),
        tag,
        message
    )
}

fn append_to_log_file(line: &str) -> Result<(), String> {
    let log_path = current_log_path()?;
    rotate_log_file_if_needed(&log_path)?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|error| format!("打开日志文件失败：{error}"))?;
    writeln!(file, "{line}").map_err(|error| format!("追加日志失败：{error}"))
}

fn current_log_path() -> Result<PathBuf, String> {
    let current_dir = std::env::current_dir()
        .map_err(|error| format!("定位当前目录失败：{error}"))?;

    // dev 模式下当前目录为 src-tauri/，日志放到项目根目录避免触发 Cargo 重建
    let logs_dir = if current_dir.file_name() == Some(std::ffi::OsStr::new("src-tauri")) {
        current_dir.join("../logs")
    } else {
        current_dir.join("logs")
    };

    fs::create_dir_all(&logs_dir).map_err(|error| format!("创建日志目录失败：{error}"))?;
    Ok(logs_dir.join(format!("{}.log", Local::now().format("%Y-%m-%d"))))
}

fn rotate_log_file_if_needed(log_path: &PathBuf) -> Result<(), String> {
    let Ok(metadata) = fs::metadata(log_path) else {
        return Ok(());
    };
    if metadata.len() < MAX_LOG_FILE_BYTES {
        return Ok(());
    }

    let rotated_path = log_path.with_file_name(format!(
        "{}-{}.log",
        Local::now().format("%Y-%m-%d"),
        Local::now().format("%H%M%S")
    ));
    fs::rename(log_path, rotated_path).map_err(|error| format!("轮转日志文件失败：{error}"))
}
