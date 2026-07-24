# TXT/JSON 分段编辑器技术方案

## 1. 技术边界

- 现有 `.md`、`.markdown` 标签页继续使用当前 `ProseMirrorEditorCore`、Markdown 解析器、Schema、NodeView、源码模式和语义模式。
- 分段编辑器只允许在 `.txt`、`.json` 标签页启用。
- 不修改现有 Markdown 文档的打开、编辑、渲染、搜索、保存、自动保存、恢复草稿、导出和大文档处理语义。
- TXT/JSON 正文不得进入现有 Markdown 解析、规范化、大纲、Front Matter、Mermaid、公式、图片或 HTML 导出链路。
- WebView 和 Rust 均不得一次性持有 TXT/JSON 完整正文；文件内容始终按需分段读取。
- 全文搜索、替换全部、全选复制、JSON 校验和 JSON 格式化由 Rust 后台流式任务执行，支持进度与取消。
- 第一阶段只允许编辑 UTF-8、UTF-8 BOM 文件，并原样保留 BOM 与 `LF`/`CRLF`；其他编码只读打开并提示转换。

## 2. 文档类型隔离

使用可判别联合类型隔离 Markdown 与分段文本状态，避免在 Markdown `Tab` 上堆叠可选字段。

```ts
type DocumentKind = 'markdown' | 'text' | 'json';

interface CommonTabState {
  id: string;
  fileName: string;
  filePath: string;
  nativePath: string | null;
  dirty: boolean;
  diskReadonly: boolean;
  lastKnownModifiedAt: number;
  externalFileChange: ExternalFileChangeState;
}

interface MarkdownTabState extends CommonTabState {
  documentKind: 'markdown';
  markdown: string;
  savedMarkdown: string;
  largeDocumentMode: boolean;
  readonlyDocumentMode: boolean;
  version: number;
}

interface SegmentedTextTabState extends CommonTabState {
  documentKind: 'text' | 'json';
  sessionId: string;
  revision: number;
  persistedRevision: number;
  selection: GlobalSelection | null;
  scrollAnchor: GlobalScrollAnchor | null;
  indexProgress: number;
}

type Tab = MarkdownTabState | SegmentedTextTabState;
```

文件类型路由固定为：

| 扩展名             | `documentKind` | 编辑器路径                                               |
| ------------------ | -------------- | -------------------------------------------------------- |
| `.md`、`.markdown` | `markdown`     | 现有 `EditorWorkspace` + `ProseMirrorEditorCore`         |
| `.txt`             | `text`         | 新增 `SegmentedTextEditorWorkspace`                      |
| `.json`            | `json`         | 新增 `SegmentedTextEditorWorkspace` + 局部 JSON 词法高亮 |

`AppShell` 只负责按活动标签页的 `documentKind` 选择工作区组件。Markdown 标签页不得创建分段会话，TXT/JSON 标签页不得调用 `editor.setMarkdown()`、`editor.flushMarkdown()` 或 `normalizeMarkdownForSave()`。

## 3. Rust 分段文档引擎

新增独立模块，不把分段逻辑加入现有 `file_system.rs` 的 Markdown 命令：

```text
src-tauri/src/text_document/
├── mod.rs
├── commands.rs
├── session.rs
├── piece_tree.rs
├── chunk_reader.rs
├── line_index.rs
├── edit_journal.rs
├── task_runner.rs
└── encoding.rs
```

### 3.1 会话模型

```rust
struct DocumentSession {
    session_id: String,
    path: PathBuf,
    document_kind: SegmentedDocumentKind,
    revision: u64,
    persisted_revision: u64,
    encoding: TextEncoding,
    bom: BomKind,
    line_ending: LineEnding,
    piece_tree: PieceTree,
    line_index: LineIndex,
    edit_journal: EditJournal,
    chunk_cache: ChunkCache,
}
```

- `DocumentSessionManager` 按 `sessionId` 管理会话。
- 原文件保持只读，通过随机访问读取所需字节范围，不执行 `read_to_string()` 全量读取。
- 会话内存只保存 Piece Tree 元数据、稀疏索引、编辑补丁和有上限的分块缓存。
- 所有读取、修改、保存和后台任务都携带 `revision`，过期响应不得覆盖新状态。

### 3.2 Piece Tree

Piece Tree 节点只引用原文件或追加修改文件中的区间：

```rust
enum PieceSource {
    Original { offset: u64, length: u64 },
    Added { offset: u64, length: u64 },
}
```

- 插入内容追加写入 `Added` 缓冲区，不复制原文件。
- 删除只修改 Piece Tree 引用关系。
- Piece Tree 节点维护逻辑字节长度、换行数量和子树统计，用于全局位置查找。
- 块边界不得切断 UTF-8 字符或 `CRLF`。
- 超长单行允许在行内继续分块，并维护水平分段位置。

## 4. 行索引

- 打开文件时立即返回首个分块，不等待完整扫描。
- Rust 后台扫描原始文件快照并构建两级稀疏行索引。
- 粗粒度检查点写入独立索引缓存文件；当前分块在内存中维护精确行偏移。
- 索引任务定期发送 `indexedBytes`、`totalBytes`、`estimatedLines` 和 `completed`。
- 索引完成前允许编辑已加载区域；后台扫描基于不可变原始快照，完成后再合并编辑补丁造成的行数变化。
- 索引完成前，滚动高度使用已扫描区域的行密度估算并逐步校正；跳转行号和全文任务进入等待状态。

## 5. Tauri 命令与数据协议

新增命令：

```text
open_segmented_document
read_segmented_window
apply_segmented_edits
flush_segmented_journal
save_segmented_revision
start_segmented_task
cancel_segmented_task
close_segmented_session
```

打开结果只返回元数据和首个窗口：

```ts
interface OpenSegmentedDocumentResult {
  sessionId: string;
  revision: number;
  documentKind: 'text' | 'json';
  encoding: 'utf-8' | 'utf-8-bom' | 'unsupported';
  lineEnding: 'lf' | 'crlf' | 'mixed';
  byteLength: number;
  readonly: boolean;
  firstWindow: SegmentedWindow;
}
```

分块结果：

```ts
interface SegmentedWindow {
  revision: number;
  startByte: number;
  endByte: number;
  startLine: number;
  text: string;
  leadingPartialLine: boolean;
  trailingPartialLine: boolean;
  indexProgress: number;
}
```

编辑请求只传增量：

```ts
interface SegmentedEditBatch {
  sessionId: string;
  baseRevision: number;
  edits: Array<{
    fromByte: number;
    toByte: number;
    insertedText: string;
  }>;
}
```

- Rust 后端全局位置使用 UTF-8 字节偏移。
- CodeMirror 局部位置使用 UTF-16 code unit 偏移。
- 每个已加载分块建立局部 UTF-8/UTF-16 双向映射表。
- 后台任务进度使用 Tauri Channel 或带任务 ID 的定向事件传输，不返回完整正文或完整结果集合。

## 6. WebView 分段编辑器

新增：

```text
src/lib/text-editor/
├── SegmentedTextEditorCore.ts
├── viewportController.ts
├── chunkCache.ts
├── positionMapping.ts
├── editBatch.ts
└── jsonLexer.ts

src/app/components/
└── SegmentedTextEditorWorkspace.svelte
```

### 6.1 编辑器结构

CodeMirror 只持有当前局部窗口，不作为完整文件模型：

```text
虚拟滚动容器
├── 顶部虚拟占位区
├── CodeMirror 当前编辑窗口
└── 底部虚拟占位区
```

- `viewportController` 根据全局滚动位置计算目标行和目标字节范围。
- 接近窗口边界时预取前后分块。
- 快速滚动或跳转时取消过期读取，使用 `revision + requestId` 丢弃迟到响应。
- 输入法组合期间不得重建 CodeMirror 状态或切换局部窗口。
- 跨块选区只在当前可见部分绘制，完整选区端点使用全局位置保存。
- 大跨度跳转未命中缓存时先显示位置占位，分块返回后再显示文本。
- 超长单行自动关闭软换行，并使用水平分段缓存。

### 6.2 分块缓存

- WebView 使用按字节容量限制的 LRU 缓存。
- 缓存上限与文件大小无关，通过性能基准确定默认值。
- 当前窗口、前后预取窗口和包含选区端点的窗口不可立即淘汰。
- Rust 使用独立有上限的读取缓存，不缓存完整文件。

## 7. 编辑数据流

```text
CodeMirror 本地输入
  → 立即更新当前局部窗口
  → 按动画帧合并相邻修改
  → apply_segmented_edits(baseRevision, edits)
  → Rust 更新 Piece Tree 和编辑日志
  → 返回新 revision、dirty 和失效索引范围
```

- Svelte 只接收 `revision`、`dirty`、索引进度和任务状态。
- TXT/JSON 输入不得更新全局 `markdown` 字符串或 `Tab.markdown`。
- 分段编辑不得触发 `analyzeMarkdown()`、Markdown 大纲分析、Markdown 搜索装饰或 Markdown 自动保存函数。
- 切换标签、关闭窗口、手动保存前强制提交尚未发送的编辑批次。

## 8. 保存与并发编辑

- 保存开始时冻结目标 `revision`，不锁定当前编辑器。
- Rust 按 Piece Tree 顺序流式读取原文件区间与 Added 区间，写入同目录临时文件。
- 临时文件写入完成后执行内容刷新、目录刷新和原子替换。
- 保存期间产生的新修改进入更高 `revision`。
- 保存完成后，只有当前 revision 等于已保存 revision 时才清除 dirty；否则标签继续保持未保存状态。
- 保存失败不得清除 Piece Tree、修改日志或 dirty 状态。
- 自动保存只启动后台保存任务，不获取或传输完整正文。

## 9. 撤销与崩溃恢复

- 编辑补丁先进入 Rust 内存队列，再批量追加到恢复日志。
- 每约 1 秒刷新恢复日志；保存、切换标签、关闭窗口时立即刷新。
- 异常退出最多允许丢失最后约 1 秒尚未落盘的输入。
- 恢复日志记录基线文件身份、revision、补丁、校验信息和会话元数据。
- 正常保存后清理已经包含在持久化 revision 中的日志。
- 恢复时若原文件身份发生变化，不自动应用补丁，改为恢复到新文件。
- 撤销/重做按补丁字节容量限制，超过容量后淘汰最早记录。
- 替换全部作为单个可撤销事务提交。

## 10. 后台全文任务

统一由 Rust `SegmentedTaskRunner` 执行：

```text
search
replace-all
select-all-copy
json-validate
json-format
```

- 每个任务包含 `taskId`、`baseRevision`、进度、取消令牌和结果 revision。
- 搜索必须保留块间重叠区域，保证跨块匹配正确。
- WebView 只接收匹配总数、当前匹配和附近匹配，不接收全部匹配数组。
- 全选复制由 Rust 流式写入系统剪贴板或临时文件，不在 WebView 拼接全文。
- JSON 校验和格式化使用流式解析，不在 WebView 构造完整 JSON 对象。
- 任务运行期间文档 revision 变化时，任务必须检测冲突；只读任务可基于冻结 revision 完成，写任务提交前必须再次校验基线。

## 11. JSON 局部能力

- 只对当前加载窗口执行轻量词法高亮。
- 高亮范围仅包含字符串、数字、布尔值、`null` 和结构标点。
- Rust 索引可提供分块起始处的 JSON 词法状态检查点，避免字符串跨块时误判。
- 第一阶段不实现代码折叠、实时全文校验或完整 JSON 语法树。
- 完整校验和格式化必须由用户手动触发后台任务。
- 超长单行 JSON 自动关闭软换行、实时校验和高亮；后台任务仍可执行。

## 12. 外部文件变化

- 延用现有外部文件状态检查与确认交互，但分段会话使用基线文件身份判断变化。
- 会话无修改时允许关闭旧会话并重新打开文件。
- 会话有修改时暂停自动保存，不执行自动合并。
- 用户可选择放弃修改并重新加载、覆盖外部版本或另存为。
- 覆盖外部版本仍使用冻结 revision 和原子保存流程。

## 13. 性能不变量

- 打开文件时不得等待全文读取或完整索引。
- WebView 缓存占用由固定容量控制，不随文件大小线性增长。
- Rust 不保存完整正文副本，内存增长只允许与缓存、Piece Tree 节点和活动任务有关。
- 单次输入路径不得执行与文件总大小相关的扫描、序列化或复制。
- Svelte 响应式状态不得包含 TXT/JSON 完整正文。
- 全文搜索、替换、格式化和保存允许耗时与文件大小线性相关，但不得阻塞编辑线程。
- 所有异步响应必须通过 revision 防止旧结果覆盖新状态。
- Markdown 标签页的性能路径、状态模型和大文档阈值保持现状。

## 14. 验证范围

### Markdown 回归隔离

- 运行全部现有 Markdown 编辑器、源码模式、语义模式、搜索、保存、工作区恢复和导出测试。
- 增加路由测试，证明 `.md`、`.markdown` 始终创建 `MarkdownTabState` 且只挂载现有 `EditorWorkspace`。
- 增加调用隔离测试，证明 Markdown 标签页不会调用任何 `segmented_*` 命令。
- 增加调用隔离测试，证明 TXT/JSON 标签页不会调用 `setMarkdown()`、`flushMarkdown()`、`normalizeMarkdownForSave()` 或 Markdown 分析函数。

### 分段协议测试

- UTF-8 多字节字符位于块边界。
- `CRLF` 位于块边界。
- 搜索目标跨块。
- 插入、删除和替换跨越多个 Piece。
- 后台索引期间编辑当前窗口。
- 保存期间继续编辑，新 revision 保持 dirty。
- 保存失败、磁盘空间不足和临时文件替换失败。
- 恢复日志完整、截断和校验失败。
- 外部文件在干净、未保存、保存中三种状态下发生变化。
- 快速滚动、请求乱序和缓存淘汰。
- 输入法组合期间触发预取或窗口重定位。
- 超长单行 JSON 的水平分段、搜索和编辑。
- 后台任务取消及 revision 冲突。

### 性能验证

- 使用普通多行 TXT、大型多行 JSON、压缩单行 JSON 和大量中文字符文件。
- 记录首次可见内容耗时、输入到绘制延迟、滚动长任务、WebView 峰值内存、Rust 峰值内存、索引速度和保存吞吐。
- 验证增加文件大小时 WebView 缓存保持容量上限，输入路径耗时不随文件总大小线性增长。
