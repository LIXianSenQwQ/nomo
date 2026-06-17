<p align="center">
  <img src="./assets/128x128.png" alt="128x128.png" width="60px">
</p>

<h1 align="center"><strong>Nomo</strong></h1>

<p align="center">
  <a href="https://github.com/LIXianSenQwQ/nomo/releases">
    <img src="https://img.shields.io/github/v/release/LIXianSenQwQ/nomo?label=release" alt="GitHub Release">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue" alt="License">
  </a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB" alt="Tauri 2">
  <img src="https://img.shields.io/badge/Svelte-5-FF3E00" alt="Svelte 5">
</p>

<p align="center">
  <a href="./README.md"><strong>简体中文</strong></a>
  ·
  <a href="./README.en.md">English</a>
</p>

---

Nomo 是一款所见即所得、即时渲染、无干扰的 Markdown 编辑器，支持 macOS 与 Windows。

它采用极简设计，提供流畅的实时预览体验，支持图片与文字混排、代码块、行内代码、公式块、行内公式、多种图表、文件大纲与目录导航，并内置类似 VS Code 的文件管理能力。文档可一键导出为 HTML 或 PDF。

---

<p align="center">
  <img src="./assets/demo_image.gif" alt="demo_image.gif" width="1920px">
</p>

## 下载与安装

从 [GitHub Releases](https://github.com/LIXianSenQwQ/nomo/releases) 下载对应系统的安装包：

| 系统 | 最低版本 | 推荐安装包 |
| :--- | :--- | :--- |
| macOS | 12.0+ | `.dmg` |
| Windows | 10/11 | `.exe` / `.msi` |

> 安装后，Nomo 会自动关联 `.md` 与 `.markdown` 文件，双击即可直接打开编辑。可以在设置 -> 文件与窗口中绑定文件夹等。

## 核心功能

- **所见即所得编辑**：基于 ProseMirror 的语义化编辑器，输入 Markdown 语法即时渲染，也可直接以富文本方式编辑。
- **实时预览**：编辑与渲染同步，无需手动切换预览窗口。
- **代码块高亮**：集成 Shiki，支持多语言语法高亮与行号显示。
- **数学公式**：支持 KaTeX 行内公式与公式块。
- **图表支持**：内置 Mermaid，可直接在文档中插入流程图、时序图、类图等。
- **文件管理**：类似 VS Code 的侧边栏文件浏览器，支持打开文件夹、多标签页、最近文件。
- **大纲与目录**：自动生成文档大纲，支持目录导航与折叠。
- **导出与分享**：一键导出为自包含 HTML 或 A4 尺寸 PDF。
- **自动更新**：启动时自动检查新版本并提示更新。

## 常用快捷键

> 以下快捷键基于当前默认配置；部分快捷键可在「设置 → 快捷键」中自定义。

### 文件与窗口

| 快捷键 | 作用 |
| :--- | :--- |
| `Ctrl + N` | 新建 Markdown 文件 |
| `Ctrl + Shift + N` | 新建窗口 |
| `Ctrl + O` | 打开文件 |
| `Ctrl + Shift + O` | 打开文件夹 |
| `Ctrl + S` | 保存 |
| `Ctrl + Shift + S` | 另存为 |
| `Ctrl + W` | 关闭当前文件 |
| `Ctrl + E` | 切换源码 / 语义编辑模式 |

### 编辑与格式

| 快捷键 | 作用 |
| :--- | :--- |
| `Ctrl + Z` | 撤销 |
| `Ctrl + Y` | 重做 |
| `Ctrl + B` | 加粗 |
| `Ctrl + I` | 斜体 |
| `Ctrl + U` | 下划线 |
| `Ctrl + `` | 行内代码 |
| `Ctrl + K` | 插入 / 编辑链接 |
| `Ctrl + ` | 清除格式 |

### 段落与元素

| 快捷键 | 作用 |
| :--- | :--- |
| `Ctrl + 1` ~ `Ctrl + 6` | 一级 ~ 六级标题 |
| `Ctrl + 0` | 转换为段落 |
| `Ctrl + =` | 提升标题级别 |
| `Ctrl + -` | 降低标题级别 |
| `Ctrl + Shift + T` | 插入表格 |
| `Ctrl + Shift + K` | 插入代码块 |
| `Ctrl + Shift + M` | 插入公式块 |
| `Ctrl + Shift + Q` | 切换引用块 |
| `Ctrl + Shift + [` | 有序列表 |
| `Ctrl + Shift + ]` | 无序列表 |
| `Ctrl + Shift + X` | 任务列表 |
| `Ctrl + Shift + H` | 水平分割线 |
| `Ctrl + Shift + A` | 插入 Callout |

### 界面与导出

| 快捷键 | 作用 |
| :--- | :--- |
| `Ctrl + F` | 打开 / 关闭搜索 |
| `Ctrl + H` | 打开 / 关闭替换 |
| `Ctrl + Tab` | 切换到下一个标签页 |
| `Ctrl + Shift + Tab` | 切换到上一个标签页 |
| `Ctrl + Shift + L` | 切换主题 |
| `Ctrl + Shift + E` | 导出 HTML |
| `Ctrl + Shift + P` | 导出 PDF |

## 技术栈与开发环境

Nomo 采用 **Tauri 2** + **Svelte 5** 的桌面端架构：

| 层级 | 主要技术 |
| :--- | :--- |
| 前端框架 | Svelte 5、Vite、TypeScript |
| 桌面运行时 | Tauri 2（Rust） |
| 编辑器内核 | ProseMirror、markdown-it |
| 代码高亮 | Shiki |
| 数学渲染 | KaTeX |
| 图表渲染 | Mermaid |
| 图标 | Lucide Svelte |
| 国际化 | Inlang Paraglide JS |

### 目录结构

```text
.
├── assets/                     # 图标、Demo 图片等静态资源
├── scripts/                    # 构建辅助脚本（含 macOS Quick Look 扩展）
├── src/                        # 前端源码
│   ├── app/                    # 应用层：组件、状态、业务逻辑
│   └── lib/                    # 通用库：编辑器核心、Markdown、服务
├── src-tauri/                  # Tauri / Rust 后端
│   ├── macos/NomoQuickLookPreview/   # macOS Quick Look 扩展
│   ├── Cargo.toml
│   └── tauri.conf.json
├── sample.md                   # 示例文档
├── package.json
└── vite.config.ts
```


### 环境要求

- [Node.js](https://nodejs.org/)（建议 LTS 版本）
- [pnpm](https://pnpm.io/) 11.5.1+
- [Rust](https://www.rust-lang.org/tools/install) 与 cargo
- Windows 构建：Visual Studio 2022 生成工具 或完整 VS
- macOS 构建：Xcode Command Line Tools

### 应用打包

```bash
# Windows 64 位 NSIS 安装包
pnpm run build:win64:nsis

# macOS 应用
pnpm run build:macos
```

打包产物默认输出到 `src-tauri/target/release/bundle/`。

## 路线图

以下是当前阶段的重点方向，欢迎通过 Issue 讨论优先级：

- [ ] **macOS 完整测试以及原生体验**：将快捷键从 `Ctrl` 迁移到 `Cmd`，补充触控板手势与原生菜单语义。
- [ ] **扩展机制**：开放主题、代码块语言、导出后处理等插件接口。
- [ ] **更多导出格式**：探索 Word、ePub 等文档导出能力。
- [ ] **国际化完善**：持续补充多语言翻译与界面文案校对。
- [ ] **性能优化**：大文档打开、长代码块渲染、图片懒加载等场景的持续优化。

## 贡献指南

欢迎提交 Issue 与 Pull Request！

1. **发现问题**：请先搜索已有 Issue，避免重复提交。
2. **提交 Issue**：尽量描述复现步骤、系统版本、截图或 GIF。

## 支持项目

<p>
  <a href="https://github.com/LIXianSenQwQ">
    <img src="https://img.shields.io/github/followers/LIXianSenQwQ?style=social" alt="Follow LIXianSenQwQ">
  </a>
  <a href="https://github.com/LIXianSenQwQ/nomo">
    <img src="https://img.shields.io/github/stars/LIXianSenQwQ/nomo?style=social" alt="Star Nomo">
  </a>
</p>

如果 Nomo 对你有帮助，欢迎关注 [LIXianSenQwQ](https://github.com/LIXianSenQwQ)，并在 [GitHub 仓库](https://github.com/LIXianSenQwQ/nomo) 点一个 Star。你的关注与 Star 会帮助项目被更多人看到，也会支持后续版本继续迭代。

## License

Nomo 使用 [PolyForm Noncommercial License 1.0.0](./LICENSE) 授权，仅允许非商业用途使用、修改和分发。商业使用请先联系作者取得额外授权。

## 社区

- [linux](https://linux.do/)

## 致谢

感谢以下开源项目为 Nomo 提供的基础能力：

- [Tauri](https://tauri.app/)
- [Svelte](https://svelte.dev/)
- [ProseMirror](https://prosemirror.net/)
- [markdown-it](https://github.com/markdown-it/markdown-it)
- [Shiki](https://shiki.style/)
- [KaTeX](https://katex.org/)
- [Mermaid](https://mermaid.js.org/)

