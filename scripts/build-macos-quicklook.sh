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

ARCH="${QUICKLOOK_ARCH:-$(uname -m)}"
case "$ARCH" in
  arm64|aarch64)
    SWIFT_TARGET_ARCH="arm64"
    ;;
  x86_64|amd64)
    SWIFT_TARGET_ARCH="x86_64"
    ;;
  *)
    echo "Unsupported Quick Look architecture: $ARCH" >&2
    exit 1
    ;;
esac

xcrun swiftc \
  "$EXTENSION_SRC_DIR/main.swift" \
  "$EXTENSION_SRC_DIR/PreviewViewController.swift" \
  -module-name NomoQuickLookPreview \
  -application-extension \
  -target "${SWIFT_TARGET_ARCH}-apple-macosx12.0" \
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
