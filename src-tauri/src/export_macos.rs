use std::path::Path;
use std::sync::{Arc, Mutex};

use block2::RcBlock;
use objc2::runtime::{AnyObject, ProtocolObject};
use objc2::MainThreadMarker;
use objc2_app_kit::{
    NSPaperOrientation, NSPrintInfo, NSPrintJobSavingURL, NSPrintSaveJob, NSPrintingPaginationMode,
};
use objc2_foundation::{NSCopying, NSError, NSSize, NSString, NSURL};
use objc2_web_kit::{WKContentWorld, WKWebView};
use tauri::AppHandle;
use tokio::sync::oneshot;

use crate::models::ExportPdfInput;

const POINTS_PER_MILLIMETER: f64 = 72.0 / 25.4;
const DEFAULT_MARGIN_MM: f64 = 20.0;

pub(crate) async fn render_html_to_pdf(
    app: &AppHandle,
    html_path: &Path,
    output_path: &Path,
    input: &ExportPdfInput,
) -> Result<(), String> {
    let export_window = crate::export::create_pdf_export_window(app, html_path).await?;
    let output_path = output_path.to_path_buf();
    let input = input.clone();
    let (result_tx, result_rx) = oneshot::channel();
    let result_tx = Arc::new(Mutex::new(Some(result_tx)));
    let callback_tx = Arc::clone(&result_tx);

    export_window
        .window()
        .with_webview(move |platform_webview| {
            let result = prepare_and_print_webview(
                platform_webview.inner(),
                output_path,
                input,
                callback_tx,
            );
            if let Err(error) = result {
                send_once(&result_tx, Err(error));
            }
        })
        .map_err(|error| format!("访问 PDF 导出 WKWebView 失败：{error}"))?;

    result_rx
        .await
        .map_err(|_| "等待 macOS PDF 打印时 WebView 已关闭".to_string())?
}

fn prepare_and_print_webview(
    webview_ptr: *mut std::ffi::c_void,
    output_path: std::path::PathBuf,
    input: ExportPdfInput,
    result_tx: Arc<Mutex<Option<oneshot::Sender<Result<(), String>>>>>,
) -> Result<(), String> {
    if webview_ptr.is_null() {
        return Err("获取 WKWebView 实例失败".to_string());
    }

    let webview = unsafe { &*(webview_ptr.cast::<WKWebView>()) };
    let main_thread =
        MainThreadMarker::new().ok_or_else(|| "PDF 导出必须在 macOS 主线程执行".to_string())?;
    let content_world = unsafe { WKContentWorld::pageWorld(main_thread) };
    let script = NSString::from_str(
        r#"
if (document.fonts && document.fonts.ready) {
  await document.fonts.ready;
}
await Promise.all(Array.from(document.images).map((image) => {
  if (image.complete) return Promise.resolve();
  return new Promise((resolve) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', resolve, { once: true });
  });
}));
return true;
"#,
    );
    let handler = RcBlock::new(move |_value: *mut AnyObject, error: *mut NSError| {
        let result = if error.is_null() {
            print_webview(webview_ptr, &output_path, &input)
        } else {
            let description = unsafe { &*error }.localizedDescription();
            Err(format!(
                "等待 PDF 页面字体和图片完成失败：{}",
                description.to_string()
            ))
        };
        send_once(&result_tx, result);
    });
    // evaluateJavaScript 无法返回 Promise；必须由异步接口等待字体和图片加载完成。
    unsafe {
        webview.callAsyncJavaScript_arguments_inFrame_inContentWorld_completionHandler(
            &script,
            None,
            None,
            &content_world,
            Some(&handler),
        );
    }
    Ok(())
}

fn print_webview(
    webview_ptr: *mut std::ffi::c_void,
    output_path: &Path,
    input: &ExportPdfInput,
) -> Result<(), String> {
    let webview = unsafe { &*(webview_ptr.cast::<WKWebView>()) };
    let print_info = NSPrintInfo::new();
    configure_print_info(&print_info, output_path, input)?;

    let operation = unsafe { webview.printOperationWithPrintInfo(&print_info) };
    operation.setShowsPrintPanel(false);
    operation.setShowsProgressPanel(false);
    operation.setCanSpawnSeparateThread(false);

    if operation.runOperation() {
        Ok(())
    } else {
        Err("macOS 未能生成 PDF".to_string())
    }
}

fn configure_print_info(
    print_info: &NSPrintInfo,
    output_path: &Path,
    input: &ExportPdfInput,
) -> Result<(), String> {
    let (width, height) = paper_size_points(input.paper_size.as_deref());
    let margins = input.margins.as_ref();
    let output_path = NSString::from_str(&output_path.to_string_lossy());
    let output_url = NSURL::fileURLWithPath(&output_path);

    print_info.setPaperSize(NSSize::new(width, height));
    print_info.setOrientation(if input.orientation.as_deref() == Some("landscape") {
        NSPaperOrientation::Landscape
    } else {
        NSPaperOrientation::Portrait
    });
    print_info.setTopMargin(millimeters_to_points(margins.map(|value| value.top)));
    print_info.setRightMargin(millimeters_to_points(margins.map(|value| value.right)));
    print_info.setBottomMargin(millimeters_to_points(margins.map(|value| value.bottom)));
    print_info.setLeftMargin(millimeters_to_points(margins.map(|value| value.left)));
    print_info.setHorizontallyCentered(false);
    print_info.setVerticallyCentered(false);
    print_info.setHorizontalPagination(NSPrintingPaginationMode::Fit);
    print_info.setVerticalPagination(NSPrintingPaginationMode::Automatic);
    print_info.setJobDisposition(unsafe { NSPrintSaveJob });

    let settings = unsafe { print_info.dictionary() };
    let saving_url_key: &ProtocolObject<dyn NSCopying> =
        ProtocolObject::from_ref(unsafe { NSPrintJobSavingURL });
    let output_url: &AnyObject = &*output_url;
    unsafe {
        settings.setObject_forKey(output_url, saving_url_key);
    }

    Ok(())
}

fn paper_size_points(paper_size: Option<&str>) -> (f64, f64) {
    match paper_size {
        Some(value) if value.eq_ignore_ascii_case("letter") => (612.0, 792.0),
        Some(value) if !value.eq_ignore_ascii_case("a4") => {
            crate::app_logger::warn("Export", &format!("暂不支持的纸张大小：{value}，使用 A4"));
            (210.0 * POINTS_PER_MILLIMETER, 297.0 * POINTS_PER_MILLIMETER)
        }
        _ => (210.0 * POINTS_PER_MILLIMETER, 297.0 * POINTS_PER_MILLIMETER),
    }
}

fn millimeters_to_points(value: Option<f64>) -> f64 {
    let value = value.filter(|value| value.is_finite() && *value >= 0.0);
    value.unwrap_or(DEFAULT_MARGIN_MM) * POINTS_PER_MILLIMETER
}

fn send_once(
    sender: &Arc<Mutex<Option<oneshot::Sender<Result<(), String>>>>>,
    result: Result<(), String>,
) {
    if let Ok(mut sender) = sender.lock() {
        if let Some(sender) = sender.take() {
            let _ = sender.send(result);
        }
    }
}
