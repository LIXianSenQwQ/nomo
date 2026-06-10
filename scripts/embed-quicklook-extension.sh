#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPEX_SRC="$ROOT_DIR/src-tauri/target/quicklook/NomoQuickLookPreview.appex"

# 查找 Tauri 构建出来的 .app bundle（优先 release，fallback debug）
APP_BUNDLE=""
for dir in "$ROOT_DIR/src-tauri/target/release/bundle/macos" "$ROOT_DIR/src-tauri/target/debug/bundle/macos"; do
  if [[ -d "$dir" ]]; then
    found=$(find "$dir" -maxdepth 1 -name "*.app" -print -quit 2>/dev/null || true)
    if [[ -n "$found" ]]; then
      APP_BUNDLE="$found"
      break
    fi
  fi
done

if [[ -z "$APP_BUNDLE" ]]; then
  echo "⚠️  未找到 Nomo.app bundle，跳过嵌入 Quick Look 扩展。" >&2
  echo "    请先运行 tauri build，然后手动复制：" >&2
  echo "    cp -R $APPEX_SRC '<App>.app/Contents/PlugIns/'" >&2
  exit 0
fi

if [[ ! -d "$APPEX_SRC" ]]; then
  echo "⚠️  Quick Look 扩展未构建：$APPEX_SRC 不存在" >&2
  exit 1
fi

PLUGINS_DIR="$APP_BUNDLE/Contents/PlugIns"
mkdir -p "$PLUGINS_DIR"
rm -rf "$PLUGINS_DIR/NomoQuickLookPreview.appex"
cp -R "$APPEX_SRC" "$PLUGINS_DIR/"

# 重新签名主 App（因为 bundle 内容变了）
codesign --force --deep --sign - "$APP_BUNDLE"

echo "✅ Quick Look 扩展已嵌入: $PLUGINS_DIR/NomoQuickLookPreview.appex"
