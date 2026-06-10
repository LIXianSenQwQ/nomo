#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Nomo Quick Look extension can only be built on macOS." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSION_SRC_DIR="$ROOT_DIR/src-tauri/macos/NomoQuickLookPreview"
RENDERER_DIR="$ROOT_DIR/src-tauri/target/quicklook-renderer"
OUTPUT_DIR="$ROOT_DIR/src-tauri/target/quicklook/NomoQuickLookPreview.appex"
CONTENTS_DIR="$OUTPUT_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

PNPM_BIN="${PNPM_BIN:-pnpm}"

cd "$ROOT_DIR"
"$PNPM_BIN" run build:quicklook-renderer

rm -rf "$OUTPUT_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

cp "$EXTENSION_SRC_DIR/Info.plist" "$CONTENTS_DIR/Info.plist"
cp -R "$RENDERER_DIR" "$RESOURCES_DIR/quicklook-renderer"

APP_VERSION="$(node -p "require('./package.json').version")"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $APP_VERSION" "$CONTENTS_DIR/Info.plist"

# 获取当前 macOS 版本用于构建 target
MACOS_VERSION=$(sw_vers -productVersion | awk -F. '{print $1 "." $2}')
ARCH=$(uname -m)

xcrun swiftc \
  "$EXTENSION_SRC_DIR/main.swift" \
  "$EXTENSION_SRC_DIR/PreviewViewController.swift" \
  -module-name NomoQuickLookPreview \
  -application-extension \
  -target "${ARCH}-apple-macosx12.0" \
  -o "$MACOS_DIR/NomoQuickLookPreview" \
  -framework Cocoa \
  -framework QuickLook \
  -framework QuickLookUI \
  -framework WebKit

ENTITLEMENTS="$EXTENSION_SRC_DIR/NomoQuickLookPreview.entitlements"

if [[ -n "${APPLE_CODESIGN_IDENTITY:-}" ]]; then
  /usr/bin/codesign --force --sign "$APPLE_CODESIGN_IDENTITY" --entitlements "$ENTITLEMENTS" "$OUTPUT_DIR"
else
  /usr/bin/codesign --force --sign - --entitlements "$ENTITLEMENTS" "$OUTPUT_DIR"
fi

echo "Built $OUTPUT_DIR"
