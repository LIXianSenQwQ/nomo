import Cocoa
import QuickLookUI
import WebKit

@objc(PreviewViewController)
final class PreviewViewController: NSViewController, QLPreviewingController {
    private var webView: WKWebView!

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

    @MainActor
    func preparePreviewOfFile(at url: URL) async throws {
        try loadMarkdownPreview(for: url)
    }

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

        // 注入预览数据并移除 crossorigin 属性（file:// 协议不支持 CORS）
        let hydratedHtml = htmlTemplate
            .replacingOccurrences(of: " crossorigin", with: "")
            .replacingOccurrences(
                of: "window.__NOMO_QUICKLOOK_PAYLOAD__ = null;",
                with: "window.__NOMO_QUICKLOOK_PAYLOAD__ = \(payload);"
            )

        // 使用 loadFileURL 替代 loadHTMLString，沙盒中可正确加载相对路径资源
        try hydratedHtml.write(to: rendererIndexUrl, atomically: true, encoding: .utf8)

        let resourceBaseUrl = rendererIndexUrl
            .deletingLastPathComponent() // src/quicklook/
            .deletingLastPathComponent() // src/
            .deletingLastPathComponent() // quicklook-renderer/

        webView.loadFileURL(rendererIndexUrl, allowingReadAccessTo: resourceBaseUrl)
    }

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

private enum PreviewError: Error, CustomStringConvertible {
    case rendererMissing
    case payloadEncodingFailed

    var description: String {
        switch self {
        case .rendererMissing:
            return "Quick Look 渲染资源缺失"
        case .payloadEncodingFailed:
            return "Markdown 预览数据编码失败"
        }
    }
}

private func htmlEscape(_ value: String) -> String {
    value
        .replacingOccurrences(of: "&", with: "&amp;")
        .replacingOccurrences(of: "<", with: "&lt;")
        .replacingOccurrences(of: ">", with: "&gt;")
        .replacingOccurrences(of: "\"", with: "&quot;")
}
