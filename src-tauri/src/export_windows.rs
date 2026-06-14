use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use tauri::AppHandle;

use crate::export::{cleanup_temp_dir, write_temp_html};
use crate::models::{ExportPdfInput, ExportResult};

const EDGE_PATHS: [&str; 3] = [
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Users\{USER}\AppData\Local\Microsoft\Edge\Application\msedge.exe",
];

pub(crate) async fn print_html_to_pdf(
    app: AppHandle,
    input: ExportPdfInput,
) -> Result<ExportResult, String> {
    let html_path = write_temp_html(&app, &input.html_content).map_err(|e| e.to_string())?;
    let pdf_path = input.file_path.clone();

    let result = print_with_edge(&html_path,&pdf_path, &input).await;

    cleanup_temp_dir(&html_path);
    result
}

async fn print_with_edge(
    html_path: &Path,
    pdf_path: &str,
    input: &ExportPdfInput,
) -> Result<ExportResult, String> {
    let html_file_url = path_to_file_url(html_path)?;
    let edge_path = find_edge_executable().ok_or(
        "未找到 Microsoft Edge，无法使用系统浏览器生成 PDF。请安装 Edge 或等待后续 WebView2 原生打印实现。".to_string(),
    )?;

    let mut cmd = Command::new(&edge_path);
    cmd.arg("--headless")
        .arg("--disable-gpu")
        .arg("--run-all-compositor-stages-before-draw")
        .arg("--disable-extensions")
        .arg("--no-sandbox")
        .arg("--disable-dev-shm-usage")
        .arg("--print-to-pdf-no-header")
        .arg(format!("--print-to-pdf={}", pdf_path))
        .arg(&html_file_url)
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let margins = input.margins.as_ref();
    if let Some(m) = margins {
        cmd.arg(format!("--print-to-pdf-margin-top={}", m.top));
        cmd.arg(format!("--print-to-pdf-margin-right={}", m.right));
        cmd.arg(format!("--print-to-pdf-margin-bottom={}", m.bottom));
        cmd.arg(format!("--print-to-pdf-margin-left={}", m.left));
    }

    if input.orientation.as_deref() == Some("landscape") {
        cmd.arg("--landscape");
    }

    match input.paper_size.as_deref() {
        Some("Letter") | Some("letter") => {
            cmd.arg("--page-size=letter");
        }
        Some("A4") | Some("a4") | None => {
            cmd.arg("--page-size=A4");
        }
        Some(size) => {
            crate::app_logger::warn("Export", &format!("暂不支持的纸张大小：{size}，使用 A4"));
            cmd.arg("--page-size=A4");
        }
    }

    // Edge/Chromium headless 默认会按 CSS 打印背景色；print_background=false 暂无可靠命令行开关。
    let _ = input.print_background;

    let output = cmd.output().map_err(|e| format!("启动 Edge 打印失败：{e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Edge 打印 PDF 失败：{stderr}"));
    }

    if !Path::new(pdf_path).exists() {
        return Err("PDF 文件未生成".to_string());
    }

    let bytes_written = std::fs::metadata(pdf_path)
        .map(|m| m.len() as usize)
        .unwrap_or(0);

    crate::app_logger::info("Export", &format!("已通过 Edge 生成 PDF：{pdf_path} ({bytes_written} bytes)"));

    Ok(ExportResult {
        file_path: pdf_path.to_string(),
        bytes_written,
    })
}

fn find_edge_executable() -> Option<PathBuf> {
    // 先检查固定路径。
    for path in &EDGE_PATHS {
        let expanded = if path.contains("{USER}") {
            if let Ok(user) = std::env::var("USERPROFILE") {
                path.replace("{USER}", &user)
            } else {
                continue;
            }
        } else {
            path.to_string()
        };
        let p = PathBuf::from(expanded);
        if p.exists() {
            return Some(p);
        }
    }

    // 尝试通过 where 命令查找。
    if let Ok(output) = Command::new("where").arg("msedge").output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(line) = stdout.lines().next() {
                let p = PathBuf::from(line.trim());
                if p.exists() {
                    return Some(p);
                }
            }
        }
    }

    None
}

fn path_to_file_url(path: &Path) -> Result<String, String> {
    let canonical = path.canonicalize().map_err(|e| format!("解析临时 HTML 路径失败：{e}"))?;
    let path_str = canonical.to_string_lossy();
    // Windows canonicalize 返回 \\?\C:\...，需要去掉前缀。
    let clean_path = path_str.strip_prefix(r"\\?\").unwrap_or(&path_str);
    let with_slashes = clean_path.replace('\\', "/");
    Ok(format!("file:///{}", with_slashes))
}

// 保留 WebView2 原生打印 TODO 占位。
#[allow(dead_code)]
pub(crate) async fn _print_with_webview2(
    _app: AppHandle,
    _input: ExportPdfInput,
) -> Result<ExportResult, String> {
    Err("WebView2 PrintToPdfAsync 原生实现预留入口".to_string())
}

pub(crate) fn _unused(_: PathBuf) {}
