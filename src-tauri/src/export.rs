use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::models::{
    Base64FileResult, ExportHtmlInput, ExportPdfInput, ExportResult, ReadFileInput,
};

#[tauri::command]
pub(crate) async fn export_html(input: ExportHtmlInput) -> Result<ExportResult, String> {
    let path = Path::new(&input.file_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("创建导出目录失败：{error}"))?;
    }

    std::fs::write(path, input.html_content.as_bytes())
        .map_err(|error| format!("写入 HTML 文件失败：{error}"))?;

    crate::app_logger::info(
        "Export",
        &format!(
            "已导出 HTML：{} ({} bytes)",
            input.file_path,
            input.html_content.len()
        ),
    );

    Ok(ExportResult {
        file_path: input.file_path,
        bytes_written: input.html_content.len(),
    })
}

#[tauri::command]
pub(crate) async fn read_file_as_base64(
    input: ReadFileInput,
) -> Result<Base64FileResult, String> {
    let path = Path::new(&input.path);
    if !path.exists() {
        return Err(format!("文件不存在：{}", input.path));
    }
    if !path.is_file() {
        return Err(format!("路径不是文件：{}", input.path));
    }

    let bytes = std::fs::read(path).map_err(|error| format!("读取文件失败：{error}"))?;
    let mime_type = mime_type_from_path(path);
    let base64 = encode_base64(&bytes);

    Ok(Base64FileResult {
        data_url: format!("data:{mime_type};base64,{base64}"),
        mime_type,
    })
}

#[tauri::command]
pub(crate) async fn export_pdf_from_html(
    app: AppHandle,
    input: ExportPdfInput,
) -> Result<ExportResult, String> {
    let pdf_path = Path::new(&input.file_path);
    if let Some(parent) = pdf_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("创建导出目录失败：{error}"))?;
    }

    #[cfg(target_os = "windows")]
    {
        return crate::export_windows::print_html_to_pdf(app, input).await;
    }

    #[cfg(target_os = "macos")]
    {
        return Err("macOS PDF 导出功能即将支持".to_string());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        return Err("当前 Linux 暂不支持 PDF 导出，请先使用 HTML 导出。".to_string());
    }
}

pub(crate) fn write_temp_html(
    app: &AppHandle,
    html_content: &str,
) -> Result<PathBuf, String> {
    let temp_dir = app
        .path()
        .temp_dir()
        .map_err(|error| format!("获取临时目录失败：{error}"))?;
    let export_dir = temp_dir.join(format!(
        "nomo-export-{}-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0),
        std::process::id()
    ));
    std::fs::create_dir_all(&export_dir)
        .map_err(|error| format!("创建临时导出目录失败：{error}"))?;

    let html_path = export_dir.join("index.html");
    std::fs::write(&html_path, html_content.as_bytes())
        .map_err(|error| format!("写入临时 HTML 失败：{error}"))?;

    Ok(html_path)
}

pub(crate) fn cleanup_temp_dir(html_path: &Path) {
    if let Some(parent) = html_path.parent() {
        let _ = std::fs::remove_dir_all(parent);
    }
}

fn mime_type_from_path(path: &Path) -> String {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) => match ext.to_lowercase().as_str() {
            "png" => "image/png".to_string(),
            "jpg" | "jpeg" => "image/jpeg".to_string(),
            "gif" => "image/gif".to_string(),
            "webp" => "image/webp".to_string(),
            "svg" => "image/svg+xml".to_string(),
            "bmp" => "image/bmp".to_string(),
            "ico" => "image/x-icon".to_string(),
            _ => "application/octet-stream".to_string(),
        },
        None => "application/octet-stream".to_string(),
    }
}

const BASE64_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn encode_base64(input: &[u8]) -> String {
    let mut output = String::with_capacity((input.len() + 2) / 3 * 4);
    let mut chunks = input.chunks_exact(3);

    for chunk in &mut chunks {
        let b = ((chunk[0] as u32) << 16) | ((chunk[1] as u32) << 8) | (chunk[2] as u32);
        output.push(BASE64_CHARS[((b >> 18) & 0x3F) as usize] as char);
        output.push(BASE64_CHARS[((b >> 12) & 0x3F) as usize] as char);
        output.push(BASE64_CHARS[((b >> 6) & 0x3F) as usize] as char);
        output.push(BASE64_CHARS[(b & 0x3F) as usize] as char);
    }

    let remainder = chunks.remainder();
    match remainder.len() {
        1 => {
            let b = (remainder[0] as u32) << 16;
            output.push(BASE64_CHARS[((b >> 18) & 0x3F) as usize] as char);
            output.push(BASE64_CHARS[((b >> 12) & 0x3F) as usize] as char);
            output.push('=');
            output.push('=');
        }
        2 => {
            let b = ((remainder[0] as u32) << 16) | ((remainder[1] as u32) << 8);
            output.push(BASE64_CHARS[((b >> 18) & 0x3F) as usize] as char);
            output.push(BASE64_CHARS[((b >> 12) & 0x3F) as usize] as char);
            output.push(BASE64_CHARS[((b >> 6) & 0x3F) as usize] as char);
            output.push('=');
        }
        _ => {}
    }

    output
}
