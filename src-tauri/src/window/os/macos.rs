pub(crate) fn window_decorations() -> bool {
    true
}

pub(crate) fn system_theme() -> &'static str {
    let output = std::process::Command::new("defaults")
        .args(["read", "-g", "AppleInterfaceStyle"])
        .output();

    match output {
        Ok(output) if String::from_utf8_lossy(&output.stdout).trim() == "Dark" => "dark",
        _ => "light",
    }
}

/// 完成 macOS 窗口创建后的安全外观设置。
///
/// `titleBarStyle`、红绿灯位置等会影响 AppKit 视图层级的选项必须由窗口构建配置一次性
/// 提供；本函数只设置不会替换 WebView 父视图的阴影属性，可在菜单刷新时重复调用。
///
/// # 参数
/// - `window`: 已由 Tauri 创建的窗口；调用方负责在构建阶段提供完整标题栏配置。
///
/// # 返回值
/// 当前 macOS 设置没有可传播的失败分支，成功时返回 `Ok(())`，以保持跨平台接口一致。
pub(crate) fn setup_window<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Result<(), String> {
    let _ = window.set_shadow(true);
    Ok(())
}

/// 将已完成初始化的 macOS 窗口置于前台。
///
/// # 参数
/// - `window`: 已显示且 WebView 已附着到 AppKit 窗口的 Tauri 窗口。
///
/// 本函数只请求系统聚焦，不直接访问或重绘原生 `NSView`，避免在窗口销毁或重挂载期间
/// 持有失效的 Objective-C 视图引用。
pub(crate) fn bring_window_to_front<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    let _ = window.set_focus();
}
