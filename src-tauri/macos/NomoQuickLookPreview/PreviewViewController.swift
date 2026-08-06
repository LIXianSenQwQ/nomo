import Cocoa
import QuickLookUI
import WebKit

/// 使用内嵌 WebKit 渲染器展示 Markdown 文件的 Quick Look 预览控制器。
///
/// 控制器由系统扩展进程通过 `NSExtensionPrincipalClass` 创建；渲染期间只读取传入文件，
/// 不写入源文件或扩展 bundle。无法生成预览时会在面板内显示错误页，而不是让扩展进程退出。
@objc(PreviewViewController)
final class PreviewViewController: NSViewController, QLPreviewingController {
    /// 承载预览页面的非持久化 WebView；在 `loadView()` 中初始化，并随控制器视图生命周期释放。
    private var webView: WKWebView!

    /// 创建铺满 Quick Look 面板的非持久化 WebView 视图层级。
    ///
    /// 该方法由 AppKit 在首次访问 `view` 时调用。它不执行文件 I/O，也不持久化 Cookie、缓存等网站数据。
    override func loadView() {
        let rootView = NSView()
        rootView.wantsLayer = true
        rootView.layer?.backgroundColor = NSColor.textBackgroundColor.cgColor

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()

        let previewWebView = WKWebView(frame: .zero, configuration: configuration)
        previewWebView.translatesAutoresizingMaskIntoConstraints = false
        previewWebView.setValue(false, forKey: "drawsBackground")
        rootView.addSubview(previewWebView)

        NSLayoutConstraint.activate([
            previewWebView.leadingAnchor.constraint(equalTo: rootView.leadingAnchor),
            previewWebView.trailingAnchor.constraint(equalTo: rootView.trailingAnchor),
            previewWebView.topAnchor.constraint(equalTo: rootView.topAnchor),
            previewWebView.bottomAnchor.constraint(equalTo: rootView.bottomAnchor),
        ])

        webView = previewWebView
        view = rootView
    }

    /// 读取并渲染 Quick Look 提供的 Markdown 文件。
    ///
    /// 该方法必须在主 actor 上操作 WebView。读取或编码失败时，会加载可见错误页并正常完成，
    /// 避免系统因协议方法抛错而静默回退到其他预览器。
    ///
    /// - Parameter url: 系统授予扩展只读权限的 Markdown 文件 URL；调用期间必须保持可访问。
    /// - Throws: 为满足 `QLPreviewingController` 协议保留；当前实现会捕获渲染错误，不向系统抛出。
    @MainActor
    func preparePreviewOfFile(at url: URL) async throws {
        do {
            try loadMarkdownPreview(for: url)
        } catch {
            // 预览失败时给出可见错误页，而不是把异常抛给系统导致 Quick Look 静默降级
            loadErrorPreview(error)
        }
    }

    /// 加载 Markdown 文件并渲染预览。
    ///
    /// 渲染器是构建期内联好的单文件 HTML（见 vite.quicklook.config.ts），
    /// 因此这里只需把预览数据注入占位符后用 loadHTMLString 加载，
    /// 不需要也不能改写扩展自身 bundle 内的资源（沙盒只读，且会破块代码签名）。
    ///
    /// - Parameter url: Quick Look 传入的待预览 Markdown 文件 URL（沙盒内只读）。
    /// - Throws: 文件读取失败、渲染资源缺失或数据编码失败时抛出。
    private func loadMarkdownPreview(for url: URL) throws {
        let markdown = try String(contentsOf: url, encoding: .utf8)

        guard
            let rendererIndexUrl = Bundle.main.url(
                forResource: "index",
                withExtension: "html",
                subdirectory: "quicklook-renderer/src/quicklook"
            )
        else {
            throw PreviewError.rendererMissing
        }

        let htmlTemplate = try String(contentsOf: rendererIndexUrl, encoding: .utf8)
        let payload = try makePreviewPayload(markdown: markdown, fileUrl: url)

        let hydratedHtml = htmlTemplate.replacingOccurrences(
            of: "window.__NOMO_QUICKLOOK_PAYLOAD__ = null;",
            with: "window.__NOMO_QUICKLOOK_PAYLOAD__ = \(payload);"
        )

        // 单文件 HTML 无外部资源依赖，baseURL 传 nil；
        // 代价是 Markdown 里引用的本地相对路径图片无法加载（沙盒未授权访问文件目录）
        webView.loadHTMLString(hydratedHtml, baseURL: nil)
    }

    /// 将文档内容和文件上下文编码为可直接嵌入 JavaScript 的 JSON。
    ///
    /// - Parameters:
    ///   - markdown: 完整 Markdown 源文；允许空字符串。
    ///   - fileUrl: 当前文档 URL，用于提供文件名和父目录上下文，不会在此方法中读取文件。
    /// - Returns: UTF-8 JSON 对象文本，可替换渲染器中的 payload 占位符。
    /// - Throws: JSON 序列化失败或结果无法转换为 UTF-8 字符串时抛出。
    private func makePreviewPayload(markdown: String, fileUrl: URL) throws -> String {
        let payload: [String: String] = [
            "markdown": markdown,
            "fileName": fileUrl.lastPathComponent,
            "documentDirectory": fileUrl.deletingLastPathComponent().path,
        ]
        let data = try JSONSerialization.data(withJSONObject: payload, options: [])
        guard let json = String(data: data, encoding: .utf8) else {
            throw PreviewError.payloadEncodingFailed
        }
        return json
    }

    /// 在当前 WebView 中显示经过 HTML 转义的预览错误。
    ///
    /// - Parameter error: 要呈现给用户的错误；其文本会转义，不能注入 HTML。
    /// - Returns: 无返回值；副作用是替换 WebView 当前页面。
    private func loadErrorPreview(_ error: Error) {
        let message = htmlEscape(String(describing: error))
        webView.loadHTMLString(
            """
            <!doctype html>
            <html lang="zh-CN">
              <body style="margin:0;display:grid;min-height:100vh;place-items:center;font:14px -apple-system,BlinkMacSystemFont,sans-serif;color:#68707a;background:#fff;">
                <main style="display:grid;gap:8px;text-align:center;padding:24px;">
                  <strong style="color:#202428;font-size:16px;">无法生成 Nomo 预览</strong>
                  <span>\(message)</span>
                </main>
              </body>
            </html>
            """,
            baseURL: nil
        )
    }
}

/// Quick Look 渲染准备阶段可向内部调用方报告的确定性错误。
private enum PreviewError: Error, CustomStringConvertible {
    case rendererMissing
    case payloadEncodingFailed

    /// 面向 Quick Look 用户的简短中文错误说明，不包含文件内容或路径等敏感信息。
    var description: String {
        switch self {
        case .rendererMissing:
            return "Quick Look 渲染资源缺失"
        case .payloadEncodingFailed:
            return "Markdown 预览数据编码失败"
        }
    }
}

/// 转义要插入 HTML 文本节点的错误字符串。
///
/// - Parameter value: 任意错误描述；允许空字符串和已有实体文本。
/// - Returns: 转义 `&`、尖括号和双引号后的文本；空输入返回空字符串。
private func htmlEscape(_ value: String) -> String {
    value
        .replacingOccurrences(of: "&", with: "&amp;")
        .replacingOccurrences(of: "<", with: "&lt;")
        .replacingOccurrences(of: ">", with: "&gt;")
        .replacingOccurrences(of: "\"", with: "&quot;")
}
