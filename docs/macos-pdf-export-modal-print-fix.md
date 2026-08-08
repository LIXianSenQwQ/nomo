# macOS PDF 导出假死修复说明

分支：`fix/macos-pdf-export-freeze`，提交 `802596a`。

## 1. 问题现象

macOS 版本点击"导出 PDF"后，整个 app 假死（UI 无响应、出现彩虹圈），直到打印渲染结束才恢复。Windows 版本无此问题。

## 2. 根因分析

### 2.1 导出调用链

1. 前端 `exportService.ts` 把编辑器 HTML 内嵌图片后，调用 Tauri 命令 `export_pdf_from_html`（`src-tauri/src/export.rs`）。
2. Rust 端创建隐藏的无边框窗口（`WebviewUrl::External(file://...)`），在其中加载临时 HTML，等待页面加载完成。
3. macOS 端（`src-tauri/src/export_macos.rs`）通过 `callAsyncJavaScript` 等待字体和图片就绪，然后在 **JS 完成回调里**调用 `print_webview`。
4. `print_webview` 创建 `NSPrintOperation`（保存到文件的打印任务）并执行打印。
5. 打印完成后校验 PDF、用 lopdf 注入文档书签，最后原子写入用户选择的目标路径。

### 2.2 卡死的直接原因

旧代码第 4 步是这样执行的：

```rust
operation.setCanSpawnSeparateThread(false);
operation.runOperation()
```

`NSPrintOperation.runOperation()` 是**同步阻塞**接口：在当前线程跑完整个排版和渲染才返回。而 JS 完成回调运行在 **macOS 主线程**上——也就是说主线程在打印期间完全停止处理事件循环。

桌面 app 的所有 UI（主窗口、菜单、托盘）都跑在同一个主线程 runloop 上，所以表现为**整个 app 假死**，文档越大卡得越久。

Windows 端不存在该问题，因为 WebView2 的 `PrintToPdf` 本身就是异步接口（`PrintToPdfCompletedHandler` 回调），不占用 UI 线程。

## 3. 修复方案

### 3.1 改用 AppKit 官方异步打印

`src-tauri/src/export_macos.rs` 中把 `runOperation()` 替换为：

```rust
operation.runOperationModalForWindow_delegate_didRunSelector_contextInfo(
    &window,
    Some(&delegate),
    Some(sel!(printOperationDidRun:success:contextInfo:)),
    context_ptr,
);
```

这是 AppKit 为异步打印提供的标准接口：调用后立即返回，打印在模态会话中进行，主线程 runloop 继续处理事件，app 不再假死；打印完成或失败后通过 delegate 的 `printOperationDidRun:success:contextInfo:` 方法拿到结果，恰好接入原有的 oneshot channel 异步流程，下游（校验、书签、写盘）代码无需改动。

### 3.2 回调委托 `NomoPdfPrintDelegate`

用 `objc2::define_class!` 定义了一个 `NSObject` 子类作为回调委托：

- 方法签名严格匹配 AppKit 约定的 `printOperationDidRun:success:contextInfo:`。
- **注意：该回调在打印线程（非主线程）触发**——这一点经过实测确认（`Thread.isMainThread == false`）。因此回调体内只做线程安全的操作：从 `context_info` 回收 `PrintContext`、通过 `send_once` 把结果送进 oneshot channel。**绝对不能在回调里直接操作 NSWindow 等 AppKit 对象**（实测在回调里 `window.close()` 会直接段错误，栈位于 `NSWMWindowCoordinator`）。

### 3.3 生命周期管理 `PrintContext`

```rust
struct PrintContext {
    result_tx: Arc<Mutex<Option<oneshot::Sender<Result<(), String>>>>>,
    _operation: Retained<NSPrintOperation>,
    _delegate: Retained<NomoPdfPrintDelegate>,
}
```

打印是异步的，`print_webview` 返回后打印操作和委托必须继续存活。做法是把它们连同结果 channel 打包进 `Box<PrintContext>`，指针经 `contextInfo` 透传，回调里 `Box::from_raw` 回收——谁来释放、何时释放都是明确的，不会悬挂也不会提前释放。

### 3.4 启动失败的上报路径

JS 回调里调用 `print_webview` 的返回值只代表"模态打印是否成功启动"（如取不到窗口、打印信息配置失败），启动失败才直接 `send_once(Err(...))`；启动成功后结果一律由 delegate 回调上报。两条路径互斥，channel 只会被发送一次。

### 3.5 顺带修复：mac 端 PDF 书签静默失效

验证过程中发现第二个 bug（`src-tauri/src/pdf_outline.rs`）：macOS WebKit 生成的 PDF 里，链接的 URI 是**间接对象**（`/URI 17 0 R` 的形式），而 `marker_from_annotation` 原来直接 `Object::as_str()` 取字符串，遇到间接引用取不到，导致标题定位标记全部匹配失败 → 书签静默生成失败（只留一条 warning，PDF 本身正常导出，用户很难察觉）。修复方式是先 `document.dereference()` 再取字符串；`dereference` 对非引用对象原样返回，因此 Windows（Chromium 生成的直接字符串）行为不受影响。

### 3.6 构建配置

`src-tauri/Cargo.toml` 的 `objc2-app-kit` 增加 `NSResponder` feature：`runOperationModalForWindow_delegate_didRunSelector_contextInfo` 的编译开关要求 `NSResponder + NSWindow` 同时启用。

## 4. 验证情况

- `cargo check` / `cargo build` 通过（仅剩两个与本次改动无关的既有 warning）。
- Swift 等价实验（隐藏无边框窗口 + `callAsyncJavaScript` 回调 + 模态打印）：模态接口立即返回、主线程不阻塞、回调正常触发、PDF 成功写出；同时实测确认了回调运行在打印线程。
- 真实 app 自检：连续 5 次导出约 55 万字符、含 120 个标题书签和图片的文档，每次约 700ms 完成，PDF 和书签均正常，进程稳定。
- 超时路径验证：构造超大文档触发 30s 超时，超时后窗口销毁、错误正常返回，进程无异常。

## 5. 遗留事项

- 模态打印期间主窗口会短暂不可交互（类似弹了一个看不见的模态框，通常 1~2 秒），但不会再出现整个 app 无响应的假死。如未来需要导出期间完全可操作，需评估 `canSpawnSeparateThread` 加完成轮询的方案，复杂度和风险更高，暂不采用。
- `ExportPdfInput.print_background` 在 mac 端目前未生效（dead code warning）：背景打印由导出 CSS 里的 `print-color-adjust: exact` 控制。若以后前端要支持"不打印背景"，需要在 mac 端补实现。
- mac 端排版基于 1000px 宽的隐藏窗口再缩放适配纸张，与 Windows 端（按纸张宽度排版）在字号观感上可能存在差异，后续如收到相关反馈可对比验证。
