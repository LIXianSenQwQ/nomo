use crate::models::{DesktopActionPayload, MarkdownAssociationStatus, WindowsContextMenuStatus};

#[cfg(target_os = "windows")]
const NOMO_MARKDOWN_PROG_ID: &str = "Nomo.Markdown";

#[cfg(target_os = "windows")]
const APP_NAME: &str = "Nomo";

#[cfg(target_os = "windows")]
const APP_CAPABILITIES_KEY: &str = "HKCU\\Software\\Nomo\\Capabilities";

#[cfg(target_os = "windows")]
const REGISTERED_APPLICATIONS_KEY: &str = "HKCU\\Software\\RegisteredApplications";

#[cfg(target_os = "windows")]
const CONTEXT_MENU_COMMAND_NAME: &str = "Nomo.Open";

#[cfg(target_os = "windows")]
const FOLDER_CONTEXT_MENU_COMMAND_NAME: &str = "Nomo.OpenFolder";

#[cfg(target_os = "windows")]
pub(crate) fn get_markdown_file_association_status() -> Result<MarkdownAssociationStatus, String> {
    let exe_path = std::env::current_exe()
        .map_err(|error| format!("读取 Nomo 可执行文件路径失败：{error}"))?;
    let exe_file_name = exe_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("nomo.exe")
        .to_ascii_lowercase();

    let user_choice_prog_id = query_reg_value(
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.md\\UserChoice",
        "ProgId",
    )?;
    let fallback_prog_id = query_reg_value("HKCU\\Software\\Classes\\.md", "")?;
    let default_prog_id = user_choice_prog_id.or(fallback_prog_id);
    let registered = is_nomo_registered(&exe_path.to_string_lossy())?;
    let is_default = default_prog_id
        .as_deref()
        .map(|prog_id| prog_id_matches_nomo(prog_id, &exe_file_name))
        .unwrap_or(false);

    let message = if is_default {
        ".md 默认打开方式已绑定到 Nomo。".to_string()
    } else if registered {
        "Nomo 已注册为可选 Markdown 应用，请在 Windows 默认应用中选择 Nomo。".to_string()
    } else {
        "尚未注册 Nomo 的 .md 打开方式。".to_string()
    };

    Ok(MarkdownAssociationStatus {
        supported: true,
        registered,
        is_default,
        default_prog_id,
        message,
    })
}

#[cfg(target_os = "windows")]
pub(crate) fn register_markdown_file_association() -> Result<DesktopActionPayload, String> {
    let exe_path = std::env::current_exe()
        .map_err(|error| format!("读取 Nomo 可执行文件路径失败：{error}"))?;
    let exe = exe_path.to_string_lossy().to_string();
    let exe_file_name = exe_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("nomo.exe")
        .to_string();
    let open_command = format!("\"{exe}\" \"%1\"");
    let icon_value = format!("\"{exe}\",0");

    write_prog_id(&open_command, &icon_value)?;
    write_extension_registration(".md")?;
    write_extension_registration(".markdown")?;
    write_application_registration(&exe_file_name, &open_command)?;
    write_default_apps_capabilities()?;

    // Windows 10/11 会保护 UserChoice 哈希，桌面应用不能可靠静默改默认应用。
    // 注册完成后打开系统默认应用页，让用户完成一次系统级确认。
    open_windows_default_apps_settings()?;

    Ok(DesktopActionPayload {
        ok: true,
        message: "已注册 Nomo，并打开 Windows 默认应用设置；请选择 Nomo 后这里会显示已绑定。"
            .to_string(),
    })
}

#[cfg(target_os = "windows")]
pub(crate) fn get_windows_context_menu_status() -> Result<WindowsContextMenuStatus, String> {
    let exe_path = std::env::current_exe()
        .map_err(|error| format!("读取 Nomo 可执行文件路径失败：{error}"))?;
    let exe = exe_path.to_string_lossy().to_string();
    let registered = is_windows_context_menu_registered(&exe)?;
    let message = if registered {
        "已注册 .md 文件和文件夹的右键菜单。".to_string()
    } else {
        "尚未注册 .md 文件和文件夹右键菜单。".to_string()
    };

    Ok(WindowsContextMenuStatus {
        supported: true,
        registered,
        message,
    })
}

#[cfg(target_os = "windows")]
pub(crate) fn register_windows_context_menu() -> Result<DesktopActionPayload, String> {
    let exe_path = std::env::current_exe()
        .map_err(|error| format!("读取 Nomo 可执行文件路径失败：{error}"))?;
    let exe = exe_path.to_string_lossy().to_string();
    let open_command = format!("\"{exe}\" \"%1\"");
    let background_open_command = format!("\"{exe}\" \"%V\"");
    let icon_value = format!("\"{exe}\",0");

    write_file_context_menu(".md", &open_command, &icon_value)?;
    write_file_context_menu(".markdown", &open_command, &icon_value)?;
    write_folder_context_menu(&open_command, &background_open_command, &icon_value)?;

    Ok(DesktopActionPayload {
        ok: true,
        message: "已注册 .md 文件和文件夹右键菜单。".to_string(),
    })
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn get_markdown_file_association_status() -> Result<MarkdownAssociationStatus, String> {
    Ok(MarkdownAssociationStatus {
        supported: false,
        registered: false,
        is_default: false,
        default_prog_id: None,
        message: "当前默认打开方式绑定仅支持 Windows。".to_string(),
    })
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn register_markdown_file_association() -> Result<DesktopActionPayload, String> {
    Err("当前默认打开方式绑定仅支持 Windows".to_string())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn get_windows_context_menu_status() -> Result<WindowsContextMenuStatus, String> {
    Ok(WindowsContextMenuStatus {
        supported: false,
        registered: false,
        message: "当前右键菜单注册仅支持 Windows。".to_string(),
    })
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn register_windows_context_menu() -> Result<DesktopActionPayload, String> {
    Err("当前右键菜单注册仅支持 Windows".to_string())
}

#[cfg(target_os = "windows")]
fn write_prog_id(open_command: &str, icon_value: &str) -> Result<(), String> {
    run_reg_add(&[
        "HKCU\\Software\\Classes\\Nomo.Markdown",
        "/ve",
        "/t",
        "REG_SZ",
        "/d",
        "Markdown Document",
        "/f",
    ])?;
    run_reg_add(&[
        "HKCU\\Software\\Classes\\Nomo.Markdown",
        "/v",
        "FriendlyTypeName",
        "/t",
        "REG_SZ",
        "/d",
        "Markdown Document",
        "/f",
    ])?;
    run_reg_add(&[
        "HKCU\\Software\\Classes\\Nomo.Markdown\\DefaultIcon",
        "/ve",
        "/t",
        "REG_SZ",
        "/d",
        icon_value,
        "/f",
    ])?;
    run_reg_add(&[
        "HKCU\\Software\\Classes\\Nomo.Markdown\\shell\\open\\command",
        "/ve",
        "/t",
        "REG_SZ",
        "/d",
        open_command,
        "/f",
    ])
}

#[cfg(target_os = "windows")]
fn write_extension_registration(extension: &str) -> Result<(), String> {
    let extension_key = format!("HKCU\\Software\\Classes\\{extension}");
    let open_with_key = format!("{extension_key}\\OpenWithProgids");

    run_reg_add(&[
        &extension_key,
        "/ve",
        "/t",
        "REG_SZ",
        "/d",
        NOMO_MARKDOWN_PROG_ID,
        "/f",
    ])?;
    run_reg_add(&[
        &extension_key,
        "/v",
        "PerceivedType",
        "/t",
        "REG_SZ",
        "/d",
        "text",
        "/f",
    ])?;
    run_reg_add(&[
        &open_with_key,
        "/v",
        NOMO_MARKDOWN_PROG_ID,
        "/t",
        "REG_SZ",
        "/d",
        "",
        "/f",
    ])
}

#[cfg(target_os = "windows")]
fn write_application_registration(exe_file_name: &str, open_command: &str) -> Result<(), String> {
    let command_key =
        format!("HKCU\\Software\\Classes\\Applications\\{exe_file_name}\\shell\\open\\command");

    run_reg_add(&[
        &command_key,
        "/ve",
        "/t",
        "REG_SZ",
        "/d",
        open_command,
        "/f",
    ])
}

#[cfg(target_os = "windows")]
fn write_default_apps_capabilities() -> Result<(), String> {
    run_reg_add(&[
        APP_CAPABILITIES_KEY,
        "/v",
        "ApplicationName",
        "/t",
        "REG_SZ",
        "/d",
        APP_NAME,
        "/f",
    ])?;
    run_reg_add(&[
        APP_CAPABILITIES_KEY,
        "/v",
        "ApplicationDescription",
        "/t",
        "REG_SZ",
        "/d",
        "轻量 Markdown-first 编辑器",
        "/f",
    ])?;
    run_reg_add(&[
        "HKCU\\Software\\Nomo\\Capabilities\\FileAssociations",
        "/v",
        ".md",
        "/t",
        "REG_SZ",
        "/d",
        NOMO_MARKDOWN_PROG_ID,
        "/f",
    ])?;
    run_reg_add(&[
        "HKCU\\Software\\Nomo\\Capabilities\\FileAssociations",
        "/v",
        ".markdown",
        "/t",
        "REG_SZ",
        "/d",
        NOMO_MARKDOWN_PROG_ID,
        "/f",
    ])?;
    run_reg_add(&[
        REGISTERED_APPLICATIONS_KEY,
        "/v",
        APP_NAME,
        "/t",
        "REG_SZ",
        "/d",
        "Software\\Nomo\\Capabilities",
        "/f",
    ])
}

#[cfg(target_os = "windows")]
fn write_file_context_menu(
    extension: &str,
    open_command: &str,
    icon_value: &str,
) -> Result<(), String> {
    let menu_key =
        format!("HKCU\\Software\\Classes\\SystemFileAssociations\\{extension}\\shell\\{CONTEXT_MENU_COMMAND_NAME}");
    let command_key = format!("{menu_key}\\command");

    run_reg_add(&[
        &menu_key,
        "/v",
        "MUIVerb",
        "/t",
        "REG_SZ",
        "/d",
        "用 Nomo 打开",
        "/f",
    ])?;
    run_reg_add(&[
        &menu_key, "/v", "Icon", "/t", "REG_SZ", "/d", icon_value, "/f",
    ])?;
    run_reg_add(&[
        &command_key,
        "/ve",
        "/t",
        "REG_SZ",
        "/d",
        open_command,
        "/f",
    ])
}

#[cfg(target_os = "windows")]
fn write_folder_context_menu(
    open_command: &str,
    background_open_command: &str,
    icon_value: &str,
) -> Result<(), String> {
    write_single_folder_context_menu(
        &format!("HKCU\\Software\\Classes\\Directory\\shell\\{FOLDER_CONTEXT_MENU_COMMAND_NAME}"),
        open_command,
        icon_value,
    )?;
    write_single_folder_context_menu(
        &format!(
            "HKCU\\Software\\Classes\\Directory\\Background\\shell\\{FOLDER_CONTEXT_MENU_COMMAND_NAME}"
        ),
        background_open_command,
        icon_value,
    )
}

#[cfg(target_os = "windows")]
fn write_single_folder_context_menu(
    menu_key: &str,
    open_command: &str,
    icon_value: &str,
) -> Result<(), String> {
    let command_key = format!("{menu_key}\\command");

    run_reg_add(&[
        menu_key,
        "/v",
        "MUIVerb",
        "/t",
        "REG_SZ",
        "/d",
        "用 Nomo 打开文件夹",
        "/f",
    ])?;
    run_reg_add(&[
        menu_key, "/v", "Icon", "/t", "REG_SZ", "/d", icon_value, "/f",
    ])?;
    run_reg_add(&[
        &command_key,
        "/ve",
        "/t",
        "REG_SZ",
        "/d",
        open_command,
        "/f",
    ])
}

#[cfg(target_os = "windows")]
fn open_windows_default_apps_settings() -> Result<(), String> {
    std::process::Command::new("explorer.exe")
        .arg("ms-settings:defaultapps")
        .spawn()
        .map_err(|error| format!("打开 Windows 默认应用设置失败：{error}"))?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn is_nomo_registered(exe: &str) -> Result<bool, String> {
    let registered_app = query_reg_value(REGISTERED_APPLICATIONS_KEY, APP_NAME)?
        .map(|value| value.eq_ignore_ascii_case("Software\\Nomo\\Capabilities"))
        .unwrap_or(false);
    let prog_id_command = query_reg_value(
        "HKCU\\Software\\Classes\\Nomo.Markdown\\shell\\open\\command",
        "",
    )?
    .map(|value| {
        value
            .to_ascii_lowercase()
            .contains(&exe.to_ascii_lowercase())
    })
    .unwrap_or(false);

    Ok(registered_app && prog_id_command)
}

#[cfg(target_os = "windows")]
fn is_windows_context_menu_registered(exe: &str) -> Result<bool, String> {
    let expected = exe.to_ascii_lowercase();
    let keys = [
        "HKCU\\Software\\Classes\\SystemFileAssociations\\.md\\shell\\Nomo.Open\\command",
        "HKCU\\Software\\Classes\\SystemFileAssociations\\.markdown\\shell\\Nomo.Open\\command",
        "HKCU\\Software\\Classes\\Directory\\shell\\Nomo.OpenFolder\\command",
        "HKCU\\Software\\Classes\\Directory\\Background\\shell\\Nomo.OpenFolder\\command",
    ];

    for key in keys {
        let command = query_reg_value(key, "")?;
        let registered = command
            .map(|value| value.to_ascii_lowercase().contains(&expected))
            .unwrap_or(false);
        if !registered {
            return Ok(false);
        }
    }

    Ok(true)
}

#[cfg(target_os = "windows")]
fn prog_id_matches_nomo(prog_id: &str, exe_file_name: &str) -> bool {
    let normalized = prog_id.trim().to_ascii_lowercase();
    normalized == "nomo.markdown"
        || normalized == format!("applications\\{exe_file_name}")
        || normalized == exe_file_name
}

#[cfg(target_os = "windows")]
fn run_reg_add(args: &[&str]) -> Result<(), String> {
    let output = std::process::Command::new("reg")
        .arg("add")
        .args(args)
        .output()
        .map_err(|error| format!("调用 reg.exe 失败：{error}"))?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        format!("写入 Windows 文件关联失败，退出码：{}", output.status)
    } else {
        format!("写入 Windows 文件关联失败：{stderr}")
    })
}

#[cfg(target_os = "windows")]
fn query_reg_value(key: &str, value_name: &str) -> Result<Option<String>, String> {
    let mut command = std::process::Command::new("reg");
    command.arg("query").arg(key);
    if value_name.is_empty() {
        command.arg("/ve");
    } else {
        command.arg("/v").arg(value_name);
    }

    let output = command
        .output()
        .map_err(|error| format!("调用 reg.exe 失败：{error}"))?;
    if !output.status.success() {
        return Ok(None);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_reg_query_value(&stdout))
}

#[cfg(target_os = "windows")]
fn parse_reg_query_value(output: &str) -> Option<String> {
    for line in output.lines().rev() {
        let columns = line.split_whitespace().collect::<Vec<_>>();
        if columns.len() >= 3 && columns[1].starts_with("REG_") {
            return Some(columns[2..].join(" "));
        }
    }

    None
}

#[cfg(all(target_os = "windows", test))]
mod tests {
    use super::*;

    #[test]
    fn matches_registered_nomo_prog_ids() {
        assert!(prog_id_matches_nomo("Nomo.Markdown", "nomo.exe"));
        assert!(prog_id_matches_nomo("Applications\\nomo.exe", "nomo.exe"));
        assert!(prog_id_matches_nomo("nomo.exe", "nomo.exe"));
        assert!(!prog_id_matches_nomo("VSCode.md", "nomo.exe"));
    }

    #[test]
    fn parses_reg_query_value_data() {
        let output = r#"
HKEY_CURRENT_USER\Software\Classes\Nomo.Markdown\shell\open\command
    (Default)    REG_SZ    "C:\Program Files\Nomo\nomo.exe" "%1"
"#;

        assert_eq!(
            parse_reg_query_value(output),
            Some(r#""C:\Program Files\Nomo\nomo.exe" "%1""#.to_string())
        );
    }
}
