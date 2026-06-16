#!/usr/bin/env bash
# 根据 macos/ 下已调好的 PNG 仅重新生成 icon.icns，不修改 icon.ico / iOS / Android。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MACOS_DIR="$ROOT/src-tauri/icons/nomo/macos"
ICONS_DIR="$ROOT/src-tauri/icons"
SOURCE_ICON="$MACOS_DIR/nomo-app-light-256.png"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [[ ! -f "$SOURCE_ICON" ]]; then
  echo "缺少 macOS 图标源文件: $SOURCE_ICON" >&2
  exit 1
fi

pnpm tauri icon "$SOURCE_ICON" -o "$TMP/out"
cp "$TMP/out/icon.icns" "$ICONS_DIR/icon.icns"

echo "已更新 macOS 图标: $ICONS_DIR/icon.icns"
echo "运行时 Dock 图标请编辑 $MACOS_DIR/*.png 后重新编译 Rust：pnpm run build:macos 或 pnpm tauri dev"
