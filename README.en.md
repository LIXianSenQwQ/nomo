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
  <a href="./README.md">简体中文</a>
  ·
  <a href="./README.en.md"><strong>English</strong></a>
</p>

---

Nomo is a WYSIWYG, instant-rendering, distraction-free Markdown editor for macOS and Windows.

It uses a minimal design and provides a smooth live preview experience. It supports mixed image and text layout, code blocks, inline code, display math, inline math, multiple diagram types, document outlines, table of contents navigation, and built-in file management similar to VS Code. Documents can be exported to HTML or PDF with one click.

---

<p align="center">
  <img src="./assets/demo_image.gif" alt="demo_image.gif" width="1920px">
</p>

## Download and Installation

Download the installer for your system from [GitHub Releases](https://github.com/LIXianSenQwQ/nomo/releases):

| System | Minimum Version | Recommended Installer |
| :--- | :--- | :--- |
| macOS | 12.0+ | `.dmg` |
| Windows | 10/11 | `.exe` / `.msi` |

> After installation, Nomo automatically associates `.md` and `.markdown` files, so you can double-click them to open and edit directly. You can also bind folders in Settings -> Files and Windows.

## Core Features

- **WYSIWYG editing**: A semantic editor based on ProseMirror. Markdown syntax is rendered instantly as you type, and you can also edit directly in rich text.
- **Live preview**: Editing and rendering stay synchronized without manually switching to a preview window.
- **Code block highlighting**: Integrated with Shiki, supporting syntax highlighting and line numbers for multiple languages.
- **Math formulas**: Supports KaTeX inline math and display math blocks.
- **Diagram support**: Built-in Mermaid support for inserting flowcharts, sequence diagrams, class diagrams, and more directly in documents.
- **File management**: A VS Code-like sidebar file explorer with folder opening, multiple tabs, and recent files.
- **Outline and table of contents**: Automatically generates document outlines with navigation and folding support.
- **Export and sharing**: Export to self-contained HTML or A4-size PDF with one click.
- **Automatic updates**: Automatically checks for new versions on startup and prompts you to update.

## Common Shortcuts

> The following shortcuts are based on the current default configuration. Some shortcuts can be customized in Settings -> Shortcuts.

### Files and Windows

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + N` | Create a new Markdown file |
| `Ctrl + Shift + N` | Create a new window |
| `Ctrl + O` | Open file |
| `Ctrl + Shift + O` | Open folder |
| `Ctrl + S` | Save |
| `Ctrl + Shift + S` | Save as |
| `Ctrl + W` | Close current file |
| `Ctrl + E` | Toggle source / semantic editing mode |

### Editing and Formatting

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
| `Ctrl + B` | Bold |
| `Ctrl + I` | Italic |
| `Ctrl + U` | Underline |
| <code>Ctrl + `</code> | Inline code |
| `Ctrl + K` | Insert / edit link |
| `Ctrl + ` | Clear formatting |

### Paragraphs and Elements

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + 1` ~ `Ctrl + 6` | Heading 1 ~ Heading 6 |
| `Ctrl + 0` | Convert to paragraph |
| `Ctrl + =` | Increase heading level |
| `Ctrl + -` | Decrease heading level |
| `Ctrl + Shift + T` | Insert table |
| `Ctrl + Shift + K` | Insert code block |
| `Ctrl + Shift + M` | Insert math block |
| `Ctrl + Shift + Q` | Toggle blockquote |
| `Ctrl + Shift + [` | Ordered list |
| `Ctrl + Shift + ]` | Unordered list |
| `Ctrl + Shift + X` | Task list |
| `Ctrl + Shift + H` | Horizontal rule |
| `Ctrl + Shift + A` | Insert callout |

### Interface and Export

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + F` | Open / close search |
| `Ctrl + H` | Open / close replace |
| `Ctrl + Tab` | Switch to next tab |
| `Ctrl + Shift + Tab` | Switch to previous tab |
| `Ctrl + Shift + L` | Toggle theme |
| `Ctrl + Shift + E` | Export HTML |
| `Ctrl + Shift + P` | Export PDF |

## Tech Stack and Development Environment

Nomo uses a desktop architecture based on **Tauri 2** + **Svelte 5**:

| Layer | Main Technologies |
| :--- | :--- |
| Frontend framework | Svelte 5, Vite, TypeScript |
| Desktop runtime | Tauri 2 (Rust) |
| Editor core | ProseMirror, markdown-it |
| Code highlighting | Shiki |
| Math rendering | KaTeX |
| Diagram rendering | Mermaid |
| Icons | Lucide Svelte |
| Internationalization | Inlang Paraglide JS |

### Directory Structure

```text
.
├── assets/                     # Static assets such as icons and demo images
├── scripts/                    # Build helper scripts, including the macOS Quick Look extension
├── src/                        # Frontend source code
│   ├── app/                    # Application layer: components, state, business logic
│   └── lib/                    # Shared libraries: editor core, Markdown, services
├── src-tauri/                  # Tauri / Rust backend
│   ├── macos/NomoQuickLookPreview/   # macOS Quick Look extension
│   ├── Cargo.toml
│   └── tauri.conf.json
├── sample.md                   # Sample document
├── package.json
└── vite.config.ts
```

### Requirements

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [pnpm](https://pnpm.io/) 11.5.1+
- [Rust](https://www.rust-lang.org/tools/install) and cargo
- Windows build: Visual Studio 2022 Build Tools or the full Visual Studio
- macOS build: Xcode Command Line Tools

### Application Packaging

```bash
# Windows 64-bit NSIS installer
pnpm run build:win64:nsis

# macOS application
pnpm run build:macos
```

Build artifacts are output to `src-tauri/target/release/bundle/` by default.

## Roadmap

The following are the current focus areas. Discussions about priorities are welcome through Issues:

- [ ] **Full macOS testing and native experience**: Migrate shortcuts from `Ctrl` to `Cmd`, and add trackpad gestures and native menu semantics.
- [ ] **Extension mechanism**: Open plugin interfaces for themes, code block languages, export post-processing, and more.
- [ ] **More export formats**: Explore document export support for Word, ePub, and other formats.
- [ ] **Internationalization improvements**: Continue adding multilingual translations and proofreading UI copy.
- [ ] **Performance optimization**: Keep optimizing scenarios such as opening large documents, rendering long code blocks, and lazy-loading images.

## Contribution Guide

Issues and Pull Requests are welcome!

1. **Report a problem**: Please search existing Issues first to avoid duplicates.
2. **Submit an Issue**: Try to include reproduction steps, system version, screenshots, or GIFs.

## Support the Project

<p>
  <a href="https://github.com/LIXianSenQwQ">
    <img src="https://img.shields.io/github/followers/LIXianSenQwQ?style=social" alt="Follow LIXianSenQwQ">
  </a>
  <a href="https://github.com/LIXianSenQwQ/nomo">
    <img src="https://img.shields.io/github/stars/LIXianSenQwQ/nomo?style=social" alt="Star Nomo">
  </a>
</p>

If Nomo helps you, feel free to follow [LIXianSenQwQ](https://github.com/LIXianSenQwQ) and star the [GitHub repository](https://github.com/LIXianSenQwQ/nomo). Your follow and star help more people discover the project and support continued iteration in future versions.

## License

Nomo is licensed under the [PolyForm Noncommercial License 1.0.0](./LICENSE). It may only be used, modified, and distributed for noncommercial purposes. For commercial use, please contact the author first to obtain additional authorization.

## Acknowledgements

Thanks to the following open-source projects for providing the foundation for Nomo:

- [Tauri](https://tauri.app/)
- [Svelte](https://svelte.dev/)
- [ProseMirror](https://prosemirror.net/)
- [markdown-it](https://github.com/markdown-it/markdown-it)
- [Shiki](https://shiki.style/)
- [KaTeX](https://katex.org/)
- [Mermaid](https://mermaid.js.org/)
