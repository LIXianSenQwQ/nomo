use crate::models::{DesktopActionPayload, LegacyInstallerNotice};
use serde::Deserialize;
use tauri::{AppHandle, Runtime};

const PACKAGE_IDENTITY_JSON: &str = include_str!("../msix/package-identity.json");
const CONTEXT_MENU_DISABLED_MARKER: &str = "shell-context-menu.disabled";
const LEGACY_INSTALLER_CHECK_MARKER: &str = "legacy-installer-check-complete";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct PackageIdentity {
    state: String,
    name: String,
    display_name: String,
    publisher: String,
    publisher_display_name: String,
    application_id: String,
    package_family_name: Option<String>,
    store_product_id: Option<String>,
}

fn package_identity() -> Result<PackageIdentity, String> {
    serde_json::from_str(PACKAGE_IDENTITY_JSON)
        .map_err(|error| format!("解析 MSIX 身份配置失败：{error}"))
}

pub(crate) fn store_product_id() -> Option<String> {
    package_identity()
        .ok()
        .and_then(|identity| identity.store_product_id)
        .filter(|value| !value.trim().is_empty())
}

#[cfg(target_os = "windows")]
pub(crate) fn current_package_family_name() -> Result<Option<String>, String> {
    use windows_sys::Win32::Storage::Packaging::Appx::GetCurrentPackageFamilyName;

    const ERROR_SUCCESS: u32 = 0;
    const ERROR_INSUFFICIENT_BUFFER: u32 = 122;
    const APPMODEL_ERROR_NO_PACKAGE: u32 = 15_700;

    let mut length = 0_u32;
    let first_result = unsafe { GetCurrentPackageFamilyName(&mut length, std::ptr::null_mut()) };
    if first_result == APPMODEL_ERROR_NO_PACKAGE {
        return Ok(None);
    }
    if first_result != ERROR_INSUFFICIENT_BUFFER || length == 0 {
        return Err(format!(
            "读取当前 MSIX 包系列名称长度失败，Windows 错误码：{first_result}"
        ));
    }

    let mut buffer = vec![0_u16; length as usize];
    let result = unsafe { GetCurrentPackageFamilyName(&mut length, buffer.as_mut_ptr()) };
    if result != ERROR_SUCCESS {
        return Err(format!(
            "读取当前 MSIX 包系列名称失败，Windows 错误码：{result}"
        ));
    }

    let value_length = buffer
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(buffer.len());
    Ok(Some(String::from_utf16_lossy(&buffer[..value_length])))
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn current_package_family_name() -> Result<Option<String>, String> {
    Ok(None)
}

pub(crate) fn is_packaged() -> bool {
    current_package_family_name()
        .map(|value| value.is_some())
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn package_local_state_file(file_name: &str) -> Result<std::path::PathBuf, String> {
    let package_family_name =
        current_package_family_name()?.ok_or_else(|| "当前进程没有 MSIX 包身份。".to_string())?;
    let local_app_data =
        std::env::var_os("LOCALAPPDATA").ok_or_else(|| "无法读取 LOCALAPPDATA。".to_string())?;
    Ok(std::path::PathBuf::from(local_app_data)
        .join("Packages")
        .join(package_family_name)
        .join("LocalState")
        .join(file_name))
}

#[cfg(target_os = "windows")]
fn write_marker(path: &std::path::Path) -> Result<(), String> {
    use std::io::Write;

    let parent = path
        .parent()
        .ok_or_else(|| "MSIX LocalState 标记路径无效。".to_string())?;
    std::fs::create_dir_all(parent)
        .map_err(|error| format!("创建 MSIX LocalState 目录失败：{error}"))?;

    if path.is_file() {
        return Ok(());
    }

    let temporary = parent.join(format!(
        ".{}.{}.tmp",
        path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("nomo-marker"),
        std::process::id()
    ));
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| format!("创建 MSIX LocalState 临时标记失败：{error}"))?;
    file.write_all(b"1")
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("写入 MSIX LocalState 标记失败：{error}"))?;
    drop(file);

    match std::fs::rename(&temporary, path) {
        Ok(()) => Ok(()),
        Err(_) if path.is_file() => {
            let _ = std::fs::remove_file(temporary);
            Ok(())
        }
        Err(error) => {
            let _ = std::fs::remove_file(temporary);
            Err(format!("提交 MSIX LocalState 标记失败：{error}"))
        }
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn context_menu_enabled() -> Result<bool, String> {
    Ok(!package_local_state_file(CONTEXT_MENU_DISABLED_MARKER)?.is_file())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn context_menu_enabled() -> Result<bool, String> {
    Ok(false)
}

#[cfg(target_os = "windows")]
pub(crate) fn set_context_menu_enabled(enabled: bool) -> Result<(), String> {
    let marker = package_local_state_file(CONTEXT_MENU_DISABLED_MARKER)?;
    if enabled {
        if marker.is_file() {
            std::fs::remove_file(&marker)
                .map_err(|error| format!("启用 MSIX 右键菜单失败：{error}"))?;
        }
    } else {
        write_marker(&marker)?;
    }
    notify_shell_association_changed();
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn set_context_menu_enabled(_enabled: bool) -> Result<(), String> {
    Err("MSIX 右键菜单仅支持 Windows。".to_string())
}

#[cfg(target_os = "windows")]
fn notify_shell_association_changed() {
    use windows_sys::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};

    unsafe {
        SHChangeNotify(
            SHCNE_ASSOCCHANGED as i32,
            SHCNF_IDLIST,
            std::ptr::null(),
            std::ptr::null(),
        );
    }
}

#[cfg(target_os = "windows")]
fn open_windows_settings(uri: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    std::process::Command::new("explorer.exe")
        .arg(uri)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|error| format!("打开 Windows 设置失败：{error}"))?;
    Ok(())
}

#[cfg(target_os = "windows")]
pub(crate) fn open_default_apps_settings() -> Result<(), String> {
    open_windows_settings("ms-settings:defaultapps")
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn open_default_apps_settings() -> Result<(), String> {
    Err("默认应用设置仅支持 Windows。".to_string())
}

#[tauri::command]
pub(crate) fn open_windows_installed_apps() -> Result<DesktopActionPayload, String> {
    #[cfg(target_os = "windows")]
    {
        open_windows_settings("ms-settings:appsfeatures")?;
        return Ok(DesktopActionPayload {
            ok: true,
            message: "已打开 Windows 已安装的应用。".to_string(),
        });
    }

    #[cfg(not(target_os = "windows"))]
    Err("已安装的应用设置仅支持 Windows。".to_string())
}

fn microsoft_store_uri(product_id: &str) -> Result<String, String> {
    let product_id = product_id.trim();
    if product_id.is_empty() || !product_id.bytes().all(|byte| byte.is_ascii_alphanumeric()) {
        return Err("Microsoft Store Product ID 无效。".to_string());
    }
    Ok(format!("ms-windows-store://pdp/?ProductId={product_id}"))
}

#[tauri::command]
pub(crate) fn open_microsoft_store_product() -> Result<DesktopActionPayload, String> {
    let product_id =
        store_product_id().ok_or_else(|| "尚未配置 Microsoft Store Product ID。".to_string())?;
    let uri = microsoft_store_uri(&product_id)?;

    #[cfg(target_os = "windows")]
    {
        open_windows_settings(&uri)?;
        return Ok(DesktopActionPayload {
            ok: true,
            message: "已打开 Microsoft Store。".to_string(),
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = uri;
        Err("Microsoft Store 仅支持 Windows。".to_string())
    }
}

#[tauri::command]
pub(crate) fn get_legacy_installer_notice<R: Runtime>(
    _app: AppHandle<R>,
) -> Result<LegacyInstallerNotice, String> {
    if !is_packaged() {
        return Ok(LegacyInstallerNotice {
            should_prompt: false,
        });
    }

    #[cfg(target_os = "windows")]
    {
        let marker = package_local_state_file(LEGACY_INSTALLER_CHECK_MARKER)?;
        if marker.is_file() {
            return Ok(LegacyInstallerNotice {
                should_prompt: false,
            });
        }

        let should_prompt = crate::software_update::legacy_windows_installer_exists()?;
        write_marker(&marker)?;
        Ok(LegacyInstallerNotice { should_prompt })
    }

    #[cfg(not(target_os = "windows"))]
    Ok(LegacyInstallerNotice {
        should_prompt: false,
    })
}

#[cfg(test)]
mod tests {
    use super::{is_packaged, microsoft_store_uri, package_identity};

    #[test]
    fn partner_center_identity_is_complete() {
        let identity = package_identity().unwrap();
        assert_eq!(identity.state, "partnerCenter");
        assert_eq!(identity.name, "7D729C8F.NomoMarkdown");
        assert_eq!(identity.display_name, "Nomo Markdown");
        assert_eq!(
            identity.publisher,
            "CN=B28DFEE9-0867-4248-BB11-F280549EFAB0"
        );
        assert_eq!(identity.publisher_display_name, "清羽晚安");
        assert_eq!(identity.application_id, "Nomo");
        assert_eq!(
            identity.package_family_name.as_deref(),
            Some("7D729C8F.NomoMarkdown_zq15d798m6gb8")
        );
        assert_eq!(identity.store_product_id.as_deref(), Some("9P1G24GK650Z"));
    }

    #[test]
    fn validates_store_product_uri_input() {
        assert_eq!(
            microsoft_store_uri("9NOMO1234567").unwrap(),
            "ms-windows-store://pdp/?ProductId=9NOMO1234567"
        );
        assert!(microsoft_store_uri("not valid").is_err());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn unpackaged_test_process_uses_the_non_msix_fallback() {
        assert!(!is_packaged());
    }
}
