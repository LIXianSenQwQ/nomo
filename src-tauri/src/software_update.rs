use std::{
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime};

const GITHUB_LATEST_RELEASE_API: &str =
    "https://api.github.com/repos/LIXianSenQwQ/nomo/releases/latest";
const CHECKSUMS_ASSET_NAME: &str = "checksums.md5";
const DOWNLOAD_PROGRESS_EVENT: &str = "nomo://software-update-download-progress";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SoftwareUpdateCandidate {
    pub(crate) version: String,
    pub(crate) date: Option<String>,
    pub(crate) body: Option<String>,
    pub(crate) asset_name: String,
    pub(crate) asset_size: Option<u64>,
    pub(crate) download_url: String,
    pub(crate) md5: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SoftwareUpdateCheckPayload {
    pub(crate) supported: bool,
    pub(crate) available: bool,
    pub(crate) current_version: String,
    pub(crate) version: Option<String>,
    pub(crate) date: Option<String>,
    pub(crate) body: Option<String>,
    pub(crate) candidate: Option<SoftwareUpdateCandidate>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DownloadedSoftwareUpdate {
    pub(crate) version: String,
    pub(crate) asset_name: String,
    pub(crate) file_path: String,
    pub(crate) md5: String,
    pub(crate) downloaded_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SoftwareUpdateDownloadProgress {
    request_id: String,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    percent: Option<u8>,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    published_at: Option<String>,
    created_at: Option<String>,
    body: Option<String>,
    assets: Vec<GitHubReleaseAsset>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
struct GitHubReleaseAsset {
    name: String,
    size: Option<u64>,
    browser_download_url: String,
}

#[tauri::command]
pub(crate) fn is_windows_installer_installation() -> Result<bool, String> {
    is_current_windows_installer_installation()
}

#[tauri::command]
pub(crate) async fn check_software_update() -> Result<SoftwareUpdateCheckPayload, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    if !is_current_windows_installer_installation()? {
        return Ok(SoftwareUpdateCheckPayload {
            supported: false,
            available: false,
            current_version,
            version: None,
            date: None,
            body: None,
            candidate: None,
        });
    }

    let client = release_http_client()?;
    let release = client
        .get(GITHUB_LATEST_RELEASE_API)
        .send()
        .await
        .map_err(|error| format!("检查 GitHub Release 更新失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("GitHub Release 更新接口返回异常：{error}"))?
        .json::<GitHubRelease>()
        .await
        .map_err(|error| format!("解析 GitHub Release 更新信息失败：{error}"))?;

    let release_version = normalize_release_version(&release.tag_name)?;
    let date = release.published_at.clone().or(release.created_at.clone());
    if !is_release_newer(&current_version, &release_version)? {
        return Ok(SoftwareUpdateCheckPayload {
            supported: true,
            available: false,
            current_version,
            version: Some(release_version),
            date,
            body: release.body,
            candidate: None,
        });
    }

    let installer_asset = select_windows_installer_asset(&release.assets, &release_version)
        .ok_or_else(|| format!("GitHub Release 缺少 Windows 安装包资产：Nomo_{release_version}_x64-setup.exe"))?;
    let checksums_asset = find_asset_by_name(&release.assets, CHECKSUMS_ASSET_NAME)
        .ok_or_else(|| "GitHub Release 缺少 MD5 校验清单 checksums.md5".to_string())?;
    let checksums = client
        .get(&checksums_asset.browser_download_url)
        .send()
        .await
        .map_err(|error| format!("下载 MD5 校验清单失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("MD5 校验清单下载接口返回异常：{error}"))?
        .text()
        .await
        .map_err(|error| format!("读取 MD5 校验清单失败：{error}"))?;
    let expected_md5 = find_md5_for_file(&checksums, &installer_asset.name)
        .ok_or_else(|| format!("MD5 校验清单缺少安装包条目：{}", installer_asset.name))?;
    let candidate = SoftwareUpdateCandidate {
        version: release_version.clone(),
        date: date.clone(),
        body: release.body.clone(),
        asset_name: installer_asset.name.clone(),
        asset_size: installer_asset.size,
        download_url: installer_asset.browser_download_url.clone(),
        md5: expected_md5,
    };

    Ok(SoftwareUpdateCheckPayload {
        supported: true,
        available: true,
        current_version,
        version: Some(release_version),
        date,
        body: release.body,
        candidate: Some(candidate),
    })
}

#[tauri::command]
pub(crate) async fn download_software_update<R: Runtime>(
    app: AppHandle<R>,
    candidate: SoftwareUpdateCandidate,
    request_id: String,
) -> Result<DownloadedSoftwareUpdate, String> {
    if !is_current_windows_installer_installation()? {
        return Err("当前环境不支持自动更新：仅 Windows 安装版支持应用内更新。".to_string());
    }
    validate_md5(&candidate.md5)?;

    let update_dir = software_update_cache_dir(&app)?;
    fs::create_dir_all(&update_dir)
        .map_err(|error| format!("创建更新缓存目录失败：{error}"))?;
    let target_path = update_dir.join(&candidate.asset_name);
    let temp_path = update_dir.join(format!("{}.download", candidate.asset_name));
    let _ = fs::remove_file(&temp_path);

    let client = release_http_client()?;
    let mut response = client
        .get(&candidate.download_url)
        .send()
        .await
        .map_err(|error| format!("下载更新安装包失败：{error}"))?
        .error_for_status()
        .map_err(|error| format!("更新安装包下载接口返回异常：{error}"))?;
    let total_bytes = response.content_length().or(candidate.asset_size);
    let mut file =
        File::create(&temp_path).map_err(|error| format!("创建更新安装包缓存失败：{error}"))?;
    let mut context = md5::Context::new();
    let mut downloaded_bytes = 0_u64;

    emit_download_progress(&app, &request_id, downloaded_bytes, total_bytes);
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("读取更新安装包下载内容失败：{error}"))?
    {
        file.write_all(&chunk)
            .map_err(|error| format!("写入更新安装包缓存失败：{error}"))?;
        context.consume(&chunk);
        downloaded_bytes += chunk.len() as u64;
        emit_download_progress(&app, &request_id, downloaded_bytes, total_bytes);
    }
    file.flush()
        .map_err(|error| format!("刷新更新安装包缓存失败：{error}"))?;

    let actual_md5 = format!("{:x}", context.compute());
    if !actual_md5.eq_ignore_ascii_case(&candidate.md5) {
        let _ = fs::remove_file(&temp_path);
        return Err(format!(
            "更新包校验失败：Release 记录的 MD5 为 {}，实际下载文件 MD5 为 {}。",
            candidate.md5, actual_md5
        ));
    }

    fs::rename(&temp_path, &target_path)
        .map_err(|error| format!("保存更新安装包失败：{error}"))?;
    Ok(DownloadedSoftwareUpdate {
        version: candidate.version,
        asset_name: candidate.asset_name,
        file_path: target_path.to_string_lossy().to_string(),
        md5: actual_md5,
        downloaded_bytes,
    })
}

#[tauri::command]
pub(crate) fn install_software_update<R: Runtime>(
    app: AppHandle<R>,
    downloaded_update: DownloadedSoftwareUpdate,
) -> Result<(), String> {
    if !is_current_windows_installer_installation()? {
        return Err("当前环境不支持自动更新：仅 Windows 安装版支持应用内更新。".to_string());
    }

    let update_dir = software_update_cache_dir(&app)?;
    let installer_path = validate_downloaded_installer_path(
        &PathBuf::from(&downloaded_update.file_path),
        &update_dir,
        &downloaded_update.asset_name,
    )?;
    let actual_md5 = calculate_file_md5(&installer_path)?;
    if !actual_md5.eq_ignore_ascii_case(&downloaded_update.md5) {
        return Err(format!(
            "更新包校验失败：Release 记录的 MD5 为 {}，实际安装文件 MD5 为 {}。",
            downloaded_update.md5, actual_md5
        ));
    }

    launch_windows_installer_and_exit(&app, &installer_path)
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

fn release_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("Nomo software updater")
        .build()
        .map_err(|error| format!("创建更新请求客户端失败：{error}"))
}

fn normalize_release_version(tag_name: &str) -> Result<String, String> {
    let version = tag_name.trim().trim_start_matches('v').trim();
    if version.is_empty() {
        return Err("GitHub Release 缺少有效版本号。".to_string());
    }
    Ok(version.to_string())
}

fn is_release_newer(current_version: &str, release_version: &str) -> Result<bool, String> {
    let current = semver::Version::parse(current_version)
        .map_err(|error| format!("解析当前版本号失败：{error}"))?;
    let release = semver::Version::parse(release_version)
        .map_err(|error| format!("解析 Release 版本号失败：{error}"))?;
    Ok(release > current)
}

fn select_windows_installer_asset<'a>(
    assets: &'a [GitHubReleaseAsset],
    version: &str,
) -> Option<&'a GitHubReleaseAsset> {
    let expected_name = format!("Nomo_{version}_x64-setup.exe");
    assets.iter().find(|asset| asset.name == expected_name)
}

fn find_asset_by_name<'a>(
    assets: &'a [GitHubReleaseAsset],
    name: &str,
) -> Option<&'a GitHubReleaseAsset> {
    assets.iter().find(|asset| asset.name == name)
}

fn find_md5_for_file(checksums: &str, file_name: &str) -> Option<String> {
    checksums.lines().find_map(|line| {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            return None;
        }

        let mut parts = trimmed.splitn(2, char::is_whitespace);
        let md5 = parts.next()?.trim();
        let rest = parts.next()?.trim();
        if !is_valid_md5(md5) || rest != file_name {
            return None;
        }

        Some(md5.to_ascii_lowercase())
    })
}

fn validate_md5(md5: &str) -> Result<(), String> {
    if is_valid_md5(md5) {
        Ok(())
    } else {
        Err("Release 记录的 MD5 格式无效。".to_string())
    }
}

fn is_valid_md5(md5: &str) -> bool {
    md5.len() == 32 && md5.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn software_update_cache_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("获取更新缓存目录失败：{error}"))?
        .join("updates"))
}

fn emit_download_progress<R: Runtime>(
    app: &AppHandle<R>,
    request_id: &str,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
) {
    let percent = total_bytes
        .filter(|total| *total > 0)
        .map(|total| ((downloaded_bytes.saturating_mul(100) / total).min(100)) as u8);
    let _ = app.emit(
        DOWNLOAD_PROGRESS_EVENT,
        SoftwareUpdateDownloadProgress {
            request_id: request_id.to_string(),
            downloaded_bytes,
            total_bytes,
            percent,
        },
    );
}

fn calculate_file_md5(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| format!("读取更新安装包失败：{error}"))?;
    Ok(format!("{:x}", md5::compute(bytes)))
}

fn validate_downloaded_installer_path(
    file_path: &Path,
    update_dir: &Path,
    asset_name: &str,
) -> Result<PathBuf, String> {
    let canonical_file = file_path
        .canonicalize()
        .map_err(|error| format!("读取更新安装包路径失败：{error}"))?;
    let canonical_dir = update_dir
        .canonicalize()
        .map_err(|error| format!("读取更新缓存目录失败：{error}"))?;
    let file_name = canonical_file
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "更新安装包文件名无效。".to_string())?;

    if !canonical_file.starts_with(&canonical_dir) || file_name != asset_name {
        return Err("更新安装包路径无效。".to_string());
    }

    Ok(canonical_file)
}

#[cfg(target_os = "windows")]
fn launch_windows_installer_and_exit<R: Runtime>(
    app: &AppHandle<R>,
    installer_path: &Path,
) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::{
        Foundation::HWND,
        UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOW},
    };

    fn wide_null(value: &std::ffi::OsStr) -> Vec<u16> {
        value.encode_wide().chain(std::iter::once(0)).collect()
    }

    let file = wide_null(installer_path.as_os_str());
    let operation = wide_null(std::ffi::OsStr::new("open"));
    let parameters = wide_null(std::ffi::OsStr::new("/P /R"));

    let result = unsafe {
        ShellExecuteW(
            0 as HWND,
            operation.as_ptr(),
            file.as_ptr(),
            parameters.as_ptr(),
            std::ptr::null(),
            SW_SHOW,
        )
    };
    if result as isize <= 32 {
        return Err(format!("启动更新安装器失败，系统错误码：{}", result as isize));
    }

    app.exit(0);
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn launch_windows_installer_and_exit<R: Runtime>(
    _app: &AppHandle<R>,
    _installer_path: &Path,
) -> Result<(), String> {
    Err("当前平台不支持 Windows 安装包更新。".to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        find_md5_for_file, is_release_newer, select_windows_installer_asset, GitHubReleaseAsset,
    };

    fn asset(name: &str) -> GitHubReleaseAsset {
        GitHubReleaseAsset {
            name: name.to_string(),
            size: Some(100),
            browser_download_url: format!("https://example.test/{name}"),
        }
    }

    #[test]
    fn parses_checksums_md5_with_exact_file_name() {
        let checksums = "\
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  Nomo_0.1.4_x64.zip
BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB  Nomo_0.1.4_x64-setup.exe
cccccccccccccccccccccccccccccccc  Nomo_0.1.4_x64-setup.exe.sig";

        assert_eq!(
            find_md5_for_file(checksums, "Nomo_0.1.4_x64-setup.exe").as_deref(),
            Some("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
        );
    }

    #[test]
    fn ignores_invalid_or_missing_checksum_rows() {
        let checksums = "\
not-md5  Nomo_0.1.4_x64-setup.exe
dddddddddddddddddddddddddddddddd
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee  Nomo_0.1.4_x64.zip";

        assert_eq!(find_md5_for_file(checksums, "Nomo_0.1.4_x64-setup.exe"), None);
    }

    #[test]
    fn supports_asset_names_with_spaces() {
        let checksums =
            "ffffffffffffffffffffffffffffffff  Nomo Setup 0.1.4 x64.exe";

        assert_eq!(
            find_md5_for_file(checksums, "Nomo Setup 0.1.4 x64.exe").as_deref(),
            Some("ffffffffffffffffffffffffffffffff")
        );
    }

    #[test]
    fn selects_only_expected_windows_installer_asset() {
        let assets = vec![
            asset("Nomo_0.1.4_x64.zip"),
            asset("Nomo_0.1.4_x64-setup.exe.sig"),
            asset("Nomo_0.1.4_aarch64.dmg"),
            asset("Nomo_0.1.4_x64-setup.exe"),
        ];

        assert_eq!(
            select_windows_installer_asset(&assets, "0.1.4").map(|asset| asset.name.as_str()),
            Some("Nomo_0.1.4_x64-setup.exe")
        );
    }

    #[test]
    fn compares_semantic_versions() {
        assert!(is_release_newer("0.1.3", "0.1.4").unwrap());
        assert!(!is_release_newer("0.1.4", "0.1.4").unwrap());
        assert!(!is_release_newer("0.1.5", "0.1.4").unwrap());
    }

    #[cfg(target_os = "windows")]
    mod windows_tests {
        use super::super::parse_reg_value;

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
}
