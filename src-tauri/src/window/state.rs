use crate::models::WindowStateInput;
use crate::window::commands::update_window_state;
use std::collections::HashMap;
use std::sync::{mpsc, Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Manager, Runtime, WebviewWindow};

const MIN_WINDOW_WIDTH: u32 = 920;
const MIN_WINDOW_HEIGHT: u32 = 640;
const DEFAULT_WINDOW_WIDTH: u32 = 1180;
const DEFAULT_WINDOW_HEIGHT: u32 = 760;
const SETTINGS_MIN_WINDOW_WIDTH: u32 = 760;
const SETTINGS_MIN_WINDOW_HEIGHT: u32 = 520;
const SETTINGS_DEFAULT_WINDOW_WIDTH: u32 = 860;
const SETTINGS_DEFAULT_WINDOW_HEIGHT: u32 = 620;
const MARKDOWN_MINI_STATE_LABEL: &str = "window-markdown-mini";
const MARKDOWN_MINI_MIN_WINDOW_WIDTH: u32 = 320;
const MARKDOWN_MINI_MIN_WINDOW_HEIGHT: u32 = 240;
const MARKDOWN_MINI_DEFAULT_WINDOW_WIDTH: u32 = 460;
const MARKDOWN_MINI_DEFAULT_WINDOW_HEIGHT: u32 = 560;
const MIN_VISIBLE_SIZE: i32 = 80;
const WINDOW_STATE_PERSIST_DELAY: Duration = Duration::from_millis(250);

static MARKDOWN_MINI_RUNTIME_STATE: OnceLock<Mutex<Option<MarkdownMiniRuntimeState>>> =
    OnceLock::new();
static WINDOW_STATE_PERSIST_SENDER: OnceLock<mpsc::Sender<WindowStatePersistCommand>> =
    OnceLock::new();

#[derive(Clone)]
struct MarkdownMiniRuntimeState {
    window_label: String,
    normal_position: tauri::PhysicalPosition<i32>,
    normal_size: tauri::PhysicalSize<u32>,
    was_maximized: bool,
    was_fullscreen: bool,
}

#[derive(Clone)]
struct WindowStateSnapshot {
    app: AppHandle,
    label: String,
    position: tauri::PhysicalPosition<i32>,
    size: tauri::PhysicalSize<u32>,
    maximized: bool,
}

enum WindowStatePersistCommand {
    Schedule(WindowStateSnapshot),
    Flush(WindowStateSnapshot, mpsc::SyncSender<Result<(), String>>),
}

pub(crate) fn persist_window_state_after_geometry_change(window: &tauri::Window) {
    if is_markdown_mini_mode_window(window.label()) {
        // 小窗在返回或销毁时一次保存最终边界，拖动期间不触发配置磁盘写入。
        return;
    }

    let snapshot = match capture_current_window_state(window) {
        Ok(snapshot) => snapshot,
        Err(error) => {
            log_window_state_persist_error(window.label(), &error);
            return;
        }
    };

    // 窗口尺寸和 WebView 布局仍由系统实时更新；这里只合并高频配置写盘。
    if window_state_persist_sender()
        .send(WindowStatePersistCommand::Schedule(snapshot.clone()))
        .is_err()
    {
        persist_window_state_snapshot_and_log(snapshot);
    }
}

pub(crate) fn persist_window_state_before_destroy(window: &tauri::Window) {
    if is_markdown_mini_mode_window(window.label()) {
        persist_markdown_mini_window_state(window);
    } else {
        flush_current_window_state(window);
    }
}

fn capture_current_window_state(window: &tauri::Window) -> Result<WindowStateSnapshot, String> {
    let position = window
        .outer_position()
        .map_err(|error| format!("读取窗口位置失败：{error}"))?;
    let size = window
        .inner_size()
        .map_err(|error| format!("读取窗口尺寸失败：{error}"))?;

    Ok(WindowStateSnapshot {
        app: window.app_handle().clone(),
        label: window.label().to_string(),
        position,
        size,
        maximized: window.is_maximized().unwrap_or(false),
    })
}

fn flush_current_window_state(window: &tauri::Window) {
    let snapshot = match capture_current_window_state(window) {
        Ok(snapshot) => snapshot,
        Err(error) => {
            log_window_state_persist_error(window.label(), &error);
            return;
        }
    };
    let fallback_snapshot = snapshot.clone();
    let (result_sender, result_receiver) = mpsc::sync_channel(0);

    if window_state_persist_sender()
        .send(WindowStatePersistCommand::Flush(snapshot, result_sender))
        .is_err()
    {
        persist_window_state_snapshot_and_log(fallback_snapshot);
        return;
    }

    match result_receiver.recv() {
        Ok(Ok(())) => {}
        Ok(Err(error)) => {
            log_window_state_persist_error(&fallback_snapshot.label, &error);
        }
        Err(_) => persist_window_state_snapshot_and_log(fallback_snapshot),
    }
}

fn window_state_persist_sender() -> &'static mpsc::Sender<WindowStatePersistCommand> {
    WINDOW_STATE_PERSIST_SENDER.get_or_init(|| {
        let (sender, receiver) = mpsc::channel();
        std::thread::Builder::new()
            .name("nomo-window-state-persist".to_string())
            .spawn(move || run_window_state_persist_worker(receiver))
            .expect("failed to start window state persistence worker");
        sender
    })
}

fn run_window_state_persist_worker(receiver: mpsc::Receiver<WindowStatePersistCommand>) {
    let mut pending = HashMap::<String, WindowStateSnapshot>::new();

    loop {
        match receiver.recv_timeout(WINDOW_STATE_PERSIST_DELAY) {
            Ok(WindowStatePersistCommand::Schedule(snapshot)) => {
                pending.insert(snapshot.label.clone(), snapshot);
            }
            Ok(WindowStatePersistCommand::Flush(snapshot, result_sender)) => {
                pending.remove(&snapshot.label);
                let result = persist_window_state_snapshot(snapshot);
                let _ = result_sender.send(result);
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                for (_, snapshot) in pending.drain() {
                    persist_window_state_snapshot_and_log(snapshot);
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                for (_, snapshot) in pending.drain() {
                    persist_window_state_snapshot_and_log(snapshot);
                }
                return;
            }
        }
    }
}

fn persist_window_state_snapshot(snapshot: WindowStateSnapshot) -> Result<(), String> {
    let WindowStateSnapshot {
        app,
        label,
        position,
        size,
        maximized,
    } = snapshot;
    persist_window_geometry(app, &label, position, size, maximized)
}

fn persist_window_state_snapshot_and_log(snapshot: WindowStateSnapshot) {
    let label = snapshot.label.clone();
    if let Err(error) = persist_window_state_snapshot(snapshot) {
        log_window_state_persist_error(&label, &error);
    }
}

fn log_window_state_persist_error(label: &str, error: &str) {
    crate::app_logger::warn(
        "Window",
        &format!("持久化窗口状态失败：label={label} error={error}"),
    );
}

pub(crate) fn enter_markdown_mini_mode(window: &WebviewWindow, pinned: bool) -> Result<(), String> {
    if is_markdown_mini_mode_window(window.label()) {
        window
            .set_always_on_top(pinned)
            .map_err(|error| format!("更新 Markdown 小窗置顶状态失败：{error}"))?;
        return Ok(());
    }

    let mut runtime_state = MarkdownMiniRuntimeState {
        window_label: window.label().to_string(),
        normal_position: window
            .outer_position()
            .map_err(|error| format!("读取主窗口位置失败：{error}"))?,
        normal_size: window
            .inner_size()
            .map_err(|error| format!("读取主窗口尺寸失败：{error}"))?,
        was_maximized: window.is_maximized().unwrap_or(false),
        was_fullscreen: window.is_fullscreen().unwrap_or(false),
    };

    {
        let mut active = markdown_mini_runtime_state()
            .lock()
            .map_err(|error| format!("读取 Markdown 小窗模式状态失败：{error}"))?;
        if let Some(current) = active.as_ref() {
            return Err(format!(
                "窗口 {} 已处于 Markdown 小窗模式",
                current.window_label
            ));
        }
        *active = Some(runtime_state.clone());
    }

    let enter_result = (|| {
        if runtime_state.was_fullscreen {
            window
                .set_fullscreen(false)
                .map_err(|error| format!("退出全屏失败：{error}"))?;
        }
        if runtime_state.was_maximized {
            window
                .unmaximize()
                .map_err(|error| format!("还原最大化窗口失败：{error}"))?;
        }

        // 取消最大化后再记录正常窗口边界，返回时才能恢复真正的非最大化尺寸。
        runtime_state.normal_position = window
            .outer_position()
            .map_err(|error| format!("读取还原后的主窗口位置失败：{error}"))?;
        runtime_state.normal_size = window
            .inner_size()
            .map_err(|error| format!("读取还原后的主窗口尺寸失败：{error}"))?;
        replace_markdown_mini_runtime_state(runtime_state.clone())?;

        // 主窗口几何已由移动/缩放事件持久化；这里依赖内存快照恢复，避免把磁盘 fsync 放进打开热路径。

        window
            .set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize::new(
                MARKDOWN_MINI_MIN_WINDOW_WIDTH as f64,
                MARKDOWN_MINI_MIN_WINDOW_HEIGHT as f64,
            ))))
            .map_err(|error| format!("设置 Markdown 小窗最小尺寸失败：{error}"))?;
        restore_markdown_mini_geometry(window)?;
        window
            .set_maximizable(false)
            .map_err(|error| format!("禁用 Markdown 小窗最大化失败：{error}"))?;
        window
            .set_minimizable(false)
            .map_err(|error| format!("禁用 Markdown 小窗最小化失败：{error}"))?;
        window
            .set_always_on_top(pinned)
            .map_err(|error| format!("设置 Markdown 小窗置顶失败：{error}"))?;
        window
            .set_skip_taskbar(true)
            .map_err(|error| format!("从任务栏隐藏 Markdown 小窗失败：{error}"))?;
        window
            .set_focus()
            .map_err(|error| format!("聚焦 Markdown 小窗失败：{error}"))?;
        Ok(())
    })();

    if let Err(error) = enter_result {
        let _ = restore_normal_window_geometry(window, &runtime_state);
        clear_markdown_mini_runtime_state(window.label());
        return Err(error);
    }

    Ok(())
}

pub(crate) fn exit_markdown_mini_mode(window: &WebviewWindow) -> Result<(), String> {
    let Some(runtime_state) = current_markdown_mini_runtime_state()? else {
        return Ok(());
    };
    if runtime_state.window_label != window.label() {
        return Err("当前窗口不是正在使用的 Markdown 小窗".to_string());
    }

    if let Err(error) = persist_markdown_mini_webview_state(window) {
        crate::app_logger::warn(
            "Window",
            &format!("保存 Markdown 小窗最终状态失败：{error}"),
        );
    }
    restore_normal_window_geometry(window, &runtime_state)?;
    clear_markdown_mini_runtime_state(window.label());
    Ok(())
}

pub(crate) fn set_markdown_mini_mode_pinned(
    window: &WebviewWindow,
    pinned: bool,
) -> Result<(), String> {
    if !is_markdown_mini_mode_window(window.label()) {
        return Err("当前窗口未处于 Markdown 小窗模式".to_string());
    }
    window
        .set_always_on_top(pinned)
        .map_err(|error| format!("切换 Markdown 小窗置顶状态失败：{error}"))
}

pub(crate) fn is_markdown_mini_mode_window(label: &str) -> bool {
    markdown_mini_runtime_state()
        .lock()
        .ok()
        .and_then(|state| state.as_ref().map(|value| value.window_label == label))
        .unwrap_or(false)
}

pub(crate) fn forget_markdown_mini_mode_window(label: &str) {
    clear_markdown_mini_runtime_state(label);
}

pub(crate) fn restore_window_state<R: Runtime>(app: &AppHandle<R>, label: &str) {
    let Some(window) = app.get_webview_window(label) else {
        return;
    };
    let Some(state) = read_window_state(app, label) else {
        return;
    };

    let metrics = window_metrics(label);
    let width = state
        .width
        .unwrap_or(metrics.default_width)
        .max(metrics.min_width);
    let height = state
        .height
        .unwrap_or(metrics.default_height)
        .max(metrics.min_height);
    let monitors = window.available_monitors().unwrap_or_default();

    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }));

    // 多屏切换或分辨率变化后，旧坐标可能落到屏幕外，需要先确认窗口仍有可见区域。
    if let (Some(x), Some(y)) = (state.x, state.y) {
        if is_window_visible_on_any_monitor(x, y, width, height, &monitors) {
            let _ =
                window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
        } else if let Some(position) = centered_position_on_primary_monitor(&window, width, height)
        {
            let _ = window.set_position(tauri::Position::Physical(position));
        }
    } else if let Some(position) = centered_position_on_primary_monitor(&window, width, height) {
        let _ = window.set_position(tauri::Position::Physical(position));
    }

    if state.maximized == Some(true) {
        let _ = window.maximize();
    }
}

fn restore_markdown_mini_geometry(window: &WebviewWindow) -> Result<(), String> {
    let state = read_window_state(window.app_handle(), MARKDOWN_MINI_STATE_LABEL);
    let monitors = window.available_monitors().unwrap_or_default();
    let state_width = state.as_ref().and_then(|value| value.width);
    let state_height = state.as_ref().and_then(|value| value.height);
    let visibility_width = state_width.unwrap_or(MARKDOWN_MINI_DEFAULT_WINDOW_WIDTH);
    let visibility_height = state_height.unwrap_or(MARKDOWN_MINI_DEFAULT_WINDOW_HEIGHT);

    let mut saved_position = None;
    let mut target_monitor = None;
    if let Some(state) = state.as_ref() {
        if let (Some(x), Some(y)) = (state.x, state.y) {
            if let Some(monitor) =
                monitor_for_window(x, y, visibility_width, visibility_height, &monitors)
            {
                saved_position = Some(tauri::PhysicalPosition { x, y });
                target_monitor = Some(monitor.clone());
            }
        }
    }

    // 首次进入或历史屏幕已不存在时，使用主窗口当前所在屏幕。
    if target_monitor.is_none() {
        target_monitor = window
            .current_monitor()
            .ok()
            .flatten()
            .or_else(|| window.primary_monitor().ok().flatten());
    }

    let target_scale = target_monitor
        .as_ref()
        .map(tauri::Monitor::scale_factor)
        .unwrap_or_else(|| window.scale_factor().unwrap_or(1.0));
    let min_width = logical_to_physical(MARKDOWN_MINI_MIN_WINDOW_WIDTH, target_scale);
    let min_height = logical_to_physical(MARKDOWN_MINI_MIN_WINDOW_HEIGHT, target_scale);
    let max_width = target_monitor
        .as_ref()
        .map(|monitor| monitor.work_area().size.width.max(min_width));
    let max_height = target_monitor
        .as_ref()
        .map(|monitor| monitor.work_area().size.height.max(min_height));
    let mut width = state_width
        .unwrap_or_else(|| logical_to_physical(MARKDOWN_MINI_DEFAULT_WINDOW_WIDTH, target_scale))
        .max(min_width);
    let mut height = state_height
        .unwrap_or_else(|| logical_to_physical(MARKDOWN_MINI_DEFAULT_WINDOW_HEIGHT, target_scale))
        .max(min_height);
    if let Some(max_width) = max_width {
        width = width.min(max_width);
    }
    if let Some(max_height) = max_height {
        height = height.min(max_height);
    }

    if let Some(monitor) = target_monitor.as_ref() {
        // 先移动到目标屏幕完成 DPI 切换，再设置物理尺寸，避免 Windows 二次缩放。
        let staging_position = saved_position
            .map(|position| clamp_position_to_work_area(monitor, position, width, height))
            .unwrap_or_else(|| centered_position_in_work_area(monitor, width, height));
        window
            .set_position(tauri::Position::Physical(staging_position))
            .map_err(|error| format!("把 Markdown 小窗移动到目标屏幕失败：{error}"))?;
    }

    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }))
        .map_err(|error| format!("恢复 Markdown 小窗尺寸失败：{error}"))?;

    if let Some(monitor) = target_monitor.as_ref() {
        let restored_size = window
            .inner_size()
            .unwrap_or(tauri::PhysicalSize { width, height });
        let final_position = saved_position
            .map(|position| {
                clamp_position_to_work_area(
                    monitor,
                    position,
                    restored_size.width,
                    restored_size.height,
                )
            })
            .unwrap_or_else(|| {
                centered_position_in_work_area(monitor, restored_size.width, restored_size.height)
            });
        window
            .set_position(tauri::Position::Physical(final_position))
            .map_err(|error| format!("恢复 Markdown 小窗位置失败：{error}"))?;
    }

    Ok(())
}

fn restore_normal_window_geometry(
    window: &WebviewWindow,
    state: &MarkdownMiniRuntimeState,
) -> Result<(), String> {
    window
        .set_skip_taskbar(false)
        .map_err(|error| format!("恢复主窗口任务栏状态失败：{error}"))?;
    window
        .set_always_on_top(false)
        .map_err(|error| format!("取消主窗口置顶失败：{error}"))?;
    window
        .set_maximizable(true)
        .map_err(|error| format!("恢复主窗口最大化能力失败：{error}"))?;
    window
        .set_minimizable(true)
        .map_err(|error| format!("恢复主窗口最小化能力失败：{error}"))?;
    window
        .set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize::new(
            MIN_WINDOW_WIDTH as f64,
            MIN_WINDOW_HEIGHT as f64,
        ))))
        .map_err(|error| format!("恢复主窗口最小尺寸失败：{error}"))?;
    window
        .set_fullscreen(false)
        .map_err(|error| format!("退出 Markdown 小窗全屏状态失败：{error}"))?;
    window
        .unmaximize()
        .map_err(|error| format!("还原 Markdown 小窗最大化状态失败：{error}"))?;
    window
        .set_position(tauri::Position::Physical(state.normal_position))
        .map_err(|error| format!("恢复主窗口位置失败：{error}"))?;
    window
        .set_size(tauri::Size::Physical(state.normal_size))
        .map_err(|error| format!("恢复主窗口尺寸失败：{error}"))?;

    if state.was_maximized {
        window
            .maximize()
            .map_err(|error| format!("恢复主窗口最大化状态失败：{error}"))?;
    }
    if state.was_fullscreen {
        window
            .set_fullscreen(true)
            .map_err(|error| format!("恢复主窗口全屏状态失败：{error}"))?;
    }
    window
        .show()
        .map_err(|error| format!("显示主窗口失败：{error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("聚焦主窗口失败：{error}"))
}

fn persist_markdown_mini_window_state(window: &tauri::Window) {
    let result = (|| {
        let position = window
            .outer_position()
            .map_err(|error| format!("读取小窗位置失败：{error}"))?;
        let size = window
            .inner_size()
            .map_err(|error| format!("读取小窗尺寸失败：{error}"))?;
        persist_window_geometry(
            window.app_handle().clone(),
            MARKDOWN_MINI_STATE_LABEL,
            position,
            size,
            false,
        )
    })();
    if let Err(error) = result {
        crate::app_logger::warn("Window", &format!("持久化 Markdown 小窗状态失败：{error}"));
    }
}

fn persist_markdown_mini_webview_state(window: &WebviewWindow) -> Result<(), String> {
    let position = window
        .outer_position()
        .map_err(|error| format!("读取小窗位置失败：{error}"))?;
    let size = window
        .inner_size()
        .map_err(|error| format!("读取小窗尺寸失败：{error}"))?;
    persist_window_geometry(
        window.app_handle().clone(),
        MARKDOWN_MINI_STATE_LABEL,
        position,
        size,
        false,
    )
}

fn persist_window_geometry(
    app: AppHandle,
    label: &str,
    position: tauri::PhysicalPosition<i32>,
    size: tauri::PhysicalSize<u32>,
    maximized: bool,
) -> Result<(), String> {
    update_window_state(
        app,
        format!("windowState:{label}"),
        WindowStateInput {
            x: Some(position.x),
            y: Some(position.y),
            width: Some(size.width),
            height: Some(size.height),
            maximized: Some(maximized),
        },
    )
}

fn read_window_state<R: Runtime>(app: &AppHandle<R>, label: &str) -> Option<WindowStateInput> {
    let key = format!("windowState:{label}");
    let value_json = crate::config::commands::get_setting_value(app, &key)
        .ok()
        .flatten()?;
    serde_json::from_str(&value_json).ok()
}

fn markdown_mini_runtime_state() -> &'static Mutex<Option<MarkdownMiniRuntimeState>> {
    MARKDOWN_MINI_RUNTIME_STATE.get_or_init(|| Mutex::new(None))
}

fn current_markdown_mini_runtime_state() -> Result<Option<MarkdownMiniRuntimeState>, String> {
    markdown_mini_runtime_state()
        .lock()
        .map(|state| state.clone())
        .map_err(|error| format!("读取 Markdown 小窗模式状态失败：{error}"))
}

fn replace_markdown_mini_runtime_state(state: MarkdownMiniRuntimeState) -> Result<(), String> {
    markdown_mini_runtime_state()
        .lock()
        .map(|mut current| *current = Some(state))
        .map_err(|error| format!("更新 Markdown 小窗模式状态失败：{error}"))
}

fn clear_markdown_mini_runtime_state(label: &str) {
    let _ = markdown_mini_runtime_state().lock().map(|mut state| {
        if state.as_ref().map(|value| value.window_label.as_str()) == Some(label) {
            *state = None;
        }
    });
}

struct WindowMetrics {
    min_width: u32,
    min_height: u32,
    default_width: u32,
    default_height: u32,
}

fn window_metrics(label: &str) -> WindowMetrics {
    if label == "window-settings" {
        return WindowMetrics {
            min_width: SETTINGS_MIN_WINDOW_WIDTH,
            min_height: SETTINGS_MIN_WINDOW_HEIGHT,
            default_width: SETTINGS_DEFAULT_WINDOW_WIDTH,
            default_height: SETTINGS_DEFAULT_WINDOW_HEIGHT,
        };
    }

    WindowMetrics {
        min_width: MIN_WINDOW_WIDTH,
        min_height: MIN_WINDOW_HEIGHT,
        default_width: DEFAULT_WINDOW_WIDTH,
        default_height: DEFAULT_WINDOW_HEIGHT,
    }
}

fn is_window_visible_on_any_monitor(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    monitors: &[tauri::Monitor],
) -> bool {
    monitor_for_window(x, y, width, height, monitors).is_some()
}

fn monitor_for_window<'a>(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    monitors: &'a [tauri::Monitor],
) -> Option<&'a tauri::Monitor> {
    let window_right = x.saturating_add(width as i32);
    let window_bottom = y.saturating_add(height as i32);
    let required_width = (width as i32).min(MIN_VISIBLE_SIZE);
    let required_height = (height as i32).min(MIN_VISIBLE_SIZE);

    monitors.iter().find(|monitor| {
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();
        let monitor_right = monitor_position.x.saturating_add(monitor_size.width as i32);
        let monitor_bottom = monitor_position
            .y
            .saturating_add(monitor_size.height as i32);

        let visible_width = window_right.min(monitor_right) - x.max(monitor_position.x);
        let visible_height = window_bottom.min(monitor_bottom) - y.max(monitor_position.y);

        visible_width >= required_width && visible_height >= required_height
    })
}

fn centered_position_on_primary_monitor(
    window: &tauri::WebviewWindow<impl Runtime>,
    width: u32,
    height: u32,
) -> Option<tauri::PhysicalPosition<i32>> {
    let monitor = window
        .primary_monitor()
        .ok()
        .flatten()
        .or_else(|| window.current_monitor().ok().flatten())?;
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();

    Some(tauri::PhysicalPosition {
        x: monitor_position
            .x
            .saturating_add((monitor_size.width.saturating_sub(width) / 2) as i32),
        y: monitor_position
            .y
            .saturating_add((monitor_size.height.saturating_sub(height) / 2) as i32),
    })
}

fn centered_position_in_work_area(
    monitor: &tauri::Monitor,
    width: u32,
    height: u32,
) -> tauri::PhysicalPosition<i32> {
    let work_area = monitor.work_area();
    tauri::PhysicalPosition {
        x: work_area
            .position
            .x
            .saturating_add((work_area.size.width.saturating_sub(width) / 2) as i32),
        y: work_area
            .position
            .y
            .saturating_add((work_area.size.height.saturating_sub(height) / 2) as i32),
    }
}

fn clamp_position_to_work_area(
    monitor: &tauri::Monitor,
    position: tauri::PhysicalPosition<i32>,
    width: u32,
    height: u32,
) -> tauri::PhysicalPosition<i32> {
    let work_area = monitor.work_area();
    let max_x = work_area
        .position
        .x
        .saturating_add(work_area.size.width.saturating_sub(width) as i32);
    let max_y = work_area
        .position
        .y
        .saturating_add(work_area.size.height.saturating_sub(height) as i32);
    tauri::PhysicalPosition {
        x: position.x.clamp(work_area.position.x, max_x),
        y: position.y.clamp(work_area.position.y, max_y),
    }
}

fn logical_to_physical(value: u32, scale_factor: f64) -> u32 {
    ((value as f64) * scale_factor).round().max(1.0) as u32
}
