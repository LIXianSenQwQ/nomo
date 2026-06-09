use std::path::{Path, PathBuf};

#[tauri::command]
pub(crate) fn is_windows_installer_installation() -> Result<bool, String> {
    is_current_windows_installer_installation()
}

#[cfg(target_os = "windows")]
fn is_current_windows_installer_installation() -> Result<bool, String> {
    let exe_path = std::env::current_exe()
        .map_err(|error| format!("读取 Nomo 可执行文件路径失败：{error}"))?;
    is_windows_installer_installation_for_path(&exe_path)
}

#[cfg(not(target_os = "windows"))]
fn is_current_windows_installer_installation() -> Result<bool, String> {
    Ok(false)
}

#[cfg(target_os = "windows")]
fn is_windows_installer_installation_for_path(exe_path: &Path) -> Result<bool, String> {
    let install_locations = [
        query_install_location("HKCU")?,
        query_install_location("HKLM")?,
    ];

    for location in install_locations.into_iter().flatten() {
        if executable_belongs_to_install_location(exe_path, &location) {
            return Ok(true);
        }
    }

    Ok(false)
}

#[cfg(target_os = "windows")]
fn query_install_location(root: &str) -> Result<Option<String>, String> {
    query_reg_value(
        root,
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Nomo",
        "InstallLocation",
    )
}

#[cfg(target_os = "windows")]
fn executable_belongs_to_install_location(exe_path: &Path, location: &str) -> bool {
    let install_dir = PathBuf::from(location.trim().trim_matches('"'));
    if install_dir.as_os_str().is_empty() {
        return false;
    }

    let normalized_exe = normalize_path(exe_path);
    let normalized_install_dir = normalize_path(&install_dir);
    let uninstall_exe_exists = install_dir.join("uninstall.exe").exists();

    uninstall_exe_exists && normalized_exe.starts_with(&normalized_install_dir)
}

#[cfg(target_os = "windows")]
fn normalize_path(path: &Path) -> String {
    path.canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .trim_matches('"')
        .to_ascii_lowercase()
}

#[cfg(target_os = "windows")]
fn query_reg_value(root: &str, key: &str, value: &str) -> Result<Option<String>, String> {
    let output = std::process::Command::new("reg.exe")
        .args(["query", &format!("{root}\\{key}"), "/v", value])
        .output()
        .map_err(|error| format!("调用 reg.exe 失败：{error}"))?;

    if !output.status.success() {
        return Ok(None);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_reg_value(&stdout, value))
}

#[cfg(target_os = "windows")]
fn parse_reg_value(output: &str, value: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let trimmed = line.trim();
        if !trimmed.starts_with(value) {
            return None;
        }

        let mut parts = trimmed.split_whitespace();
        let _name = parts.next()?;
        let _kind = parts.next()?;
        let data = parts.collect::<Vec<_>>().join(" ");
        if data.is_empty() {
            None
        } else {
            Some(data)
        }
    })
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::parse_reg_value;

    #[test]
    fn parses_install_location_with_spaces() {
        let output = r#"
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall\Nomo
    InstallLocation    REG_SZ    "C:\Users\Qing Yu\AppData\Local\Programs\Nomo"
"#;

        assert_eq!(
            parse_reg_value(output, "InstallLocation"),
            Some(r#""C:\Users\Qing Yu\AppData\Local\Programs\Nomo""#.to_string())
        );
    }
}
