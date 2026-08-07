use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::{oneshot, Mutex};

use crate::models::{
    Base64FileResult, ExportHtmlInput, ExportPdfInput, ExportResult, ReadFileInput,
};

const PDF_EXPORT_TIMEOUT: Duration = Duration::from_secs(30);
const PDF_EXPORT_WINDOW_PREFIX: &str = "pdf-export-";
static PDF_EXPORT_LOCK: Mutex<()> = Mutex::const_new(());
static PDF_EXPORT_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[tauri::command]
pub(crate) async fn export_html(input: ExportHtmlInput) -> Result<ExportResult, String> {
    let path = Path::new(&input.file_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| format!("创建导出目录失败：{error}"))?;
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
        warnings: Vec::new(),
    })
}

#[tauri::command]
pub(crate) async fn read_file_as_base64(input: ReadFileInput) -> Result<Base64FileResult, String> {
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
        std::fs::create_dir_all(parent).map_err(|error| format!("创建导出目录失败：{error}"))?;
    }

    #[cfg(target_os = "windows")]
    {
        return run_pdf_export(app, input).await;
    }

    #[cfg(target_os = "macos")]
    {
        return run_pdf_export(app, input).await;
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        return Err("当前 Linux 暂不支持 PDF 导出，请先使用 HTML 导出。".to_string());
    }
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
async fn run_pdf_export(app: AppHandle, input: ExportPdfInput) -> Result<ExportResult, String> {
    let _export_guard = PDF_EXPORT_LOCK.lock().await;
    let timer = Instant::now();
    let job = PdfExportJob::create(&app, &input.html_content)?;

    crate::app_logger::info(
        "Export",
        &format!(
            "开始原生 PDF 导出：outline={} paper={} orientation={}",
            input.outline.len(),
            input.paper_size.as_deref().unwrap_or("A4"),
            input.orientation.as_deref().unwrap_or("portrait")
        ),
    );

    let render_result = tokio::time::timeout(PDF_EXPORT_TIMEOUT, async {
        #[cfg(target_os = "windows")]
        {
            crate::export_windows::render_html_to_pdf(
                &app,
                &job.html_path,
                &job.raw_pdf_path,
                &input,
            )
            .await
        }

        #[cfg(target_os = "macos")]
        {
            crate::export_macos::render_html_to_pdf(&app, &job.html_path, &job.raw_pdf_path, &input)
                .await
        }
    })
    .await;

    match render_result {
        Ok(Ok(())) => {}
        Ok(Err(error)) => {
            crate::app_logger::warn("Export", &format!("PDF 原生渲染失败：{error}"));
            return Err(error);
        }
        Err(_) => {
            crate::app_logger::warn("Export", "PDF 原生渲染超时");
            return Err(pdf_export_timeout_error());
        }
    }
    crate::app_logger::info(
        "Export",
        &format!("PDF 原生渲染完成：{} ms", timer.elapsed().as_millis()),
    );

    crate::pdf_outline::validate_pdf(&job.raw_pdf_path)
        .map_err(|error| format!("生成的 PDF 无效：{error}"))?;
    ensure_pdf_export_deadline(timer)?;

    let mut warnings = Vec::new();
    let final_pdf_path = if input.outline.is_empty() {
        &job.raw_pdf_path
    } else {
        match crate::pdf_outline::add_document_outline(
            &job.raw_pdf_path,
            &job.outlined_pdf_path,
            &input.outline,
        ) {
            Ok(()) => {
                crate::app_logger::info(
                    "Export",
                    &format!(
                        "PDF 文档大纲生成完成：{} 项，{} ms",
                        input.outline.len(),
                        timer.elapsed().as_millis()
                    ),
                );
                &job.outlined_pdf_path
            }
            Err(error) => {
                crate::app_logger::warn(
                    "Export",
                    &format!("PDF 文档大纲生成失败，保留原始 PDF：{error}"),
                );
                warnings.push("PDF 已导出，但未能生成文档书签".to_string());
                &job.raw_pdf_path
            }
        }
    };
    ensure_pdf_export_deadline(timer)?;

    let bytes =
        std::fs::read(final_pdf_path).map_err(|error| format!("读取生成的 PDF 失败：{error}"))?;
    crate::file_system::write_file_atomically(Path::new(&input.file_path), &bytes)?;

    crate::app_logger::info(
        "Export",
        &format!(
            "PDF 导出完成：{} ({} bytes, {} ms, warnings={})",
            input.file_path,
            bytes.len(),
            timer.elapsed().as_millis(),
            warnings.len()
        ),
    );

    Ok(ExportResult {
        file_path: input.file_path,
        bytes_written: bytes.len(),
        warnings,
    })
}

fn ensure_pdf_export_deadline(timer: Instant) -> Result<(), String> {
    if timer.elapsed() >= PDF_EXPORT_TIMEOUT {
        return Err(pdf_export_timeout_error());
    }
    Ok(())
}

fn pdf_export_timeout_error() -> String {
    "PDF 导出超时，请稍后重试。".to_string()
}

struct PdfExportJob {
    temp_dir: PathBuf,
    html_path: PathBuf,
    raw_pdf_path: PathBuf,
    outlined_pdf_path: PathBuf,
}

impl PdfExportJob {
    fn create(app: &AppHandle, html_content: &str) -> Result<Self, String> {
        let system_temp_dir = app
            .path()
            .temp_dir()
            .map_err(|error| format!("获取临时目录失败：{error}"))?;
        let sequence = PDF_EXPORT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let temp_dir = system_temp_dir.join(format!(
            "nomo-pdf-export-{}-{timestamp}-{sequence}",
            std::process::id()
        ));
        std::fs::create_dir(&temp_dir).map_err(|error| format!("创建临时导出目录失败：{error}"))?;

        let html_path = temp_dir.join("index.html");
        if let Err(error) = std::fs::write(&html_path, html_content.as_bytes()) {
            let _ = std::fs::remove_dir_all(&temp_dir);
            return Err(format!("写入临时 HTML 失败：{error}"));
        }

        Ok(Self {
            html_path,
            raw_pdf_path: temp_dir.join("raw.pdf"),
            outlined_pdf_path: temp_dir.join("outlined.pdf"),
            temp_dir,
        })
    }
}

impl Drop for PdfExportJob {
    fn drop(&mut self) {
        if let Err(error) = std::fs::remove_dir_all(&self.temp_dir) {
            if error.kind() != std::io::ErrorKind::NotFound {
                crate::app_logger::warn("Export", &format!("清理 PDF 临时目录失败：{error}"));
            }
        }
    }
}

pub(crate) struct PdfExportWindow {
    window: WebviewWindow,
}

impl PdfExportWindow {
    pub(crate) fn window(&self) -> &WebviewWindow {
        &self.window
    }
}

impl Drop for PdfExportWindow {
    fn drop(&mut self) {
        let _ = self.window.destroy();
    }
}

pub(crate) async fn create_pdf_export_window(
    app: &AppHandle,
    html_path: &Path,
) -> Result<PdfExportWindow, String> {
    let file_url = tauri::Url::from_file_path(html_path)
        .map_err(|_| "无法将临时 HTML 路径转换为文件 URL".to_string())?;
    let sequence = PDF_EXPORT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let label = format!(
        "{PDF_EXPORT_WINDOW_PREFIX}{}-{sequence}",
        std::process::id()
    );
    let (ready_tx, ready_rx) = oneshot::channel();
    let ready_tx = Arc::new(StdMutex::new(Some(ready_tx)));

    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::External(file_url))
        .title("Nomo PDF Export")
        .inner_size(1000.0, 1200.0)
        .decorations(false)
        .focused(false)
        .skip_taskbar(true)
        .visible(false)
        .on_page_load(move |_window, payload| {
            if payload.event() == PageLoadEvent::Finished {
                if let Ok(mut sender) = ready_tx.lock() {
                    if let Some(sender) = sender.take() {
                        let _ = sender.send(());
                    }
                }
            }
        })
        .build()
        .map_err(|error| format!("创建 PDF 导出 WebView 失败：{error}"))?;
    let export_window = PdfExportWindow { window };

    ready_rx
        .await
        .map_err(|_| "PDF 导出 WebView 在页面加载完成前关闭".to_string())?;
    Ok(export_window)
}

pub(crate) fn is_pdf_export_window_label(label: &str) -> bool {
    label.starts_with(PDF_EXPORT_WINDOW_PREFIX)
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
