#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS bundle verification can only run on macOS." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_DIR="$ROOT_DIR/src-tauri/target/release/bundle/macos"
APP_BUNDLES=("$BUNDLE_DIR"/*.app)

if [[ ${#APP_BUNDLES[@]} -ne 1 || ! -d "${APP_BUNDLES[0]}" ]]; then
  echo "Expected exactly one macOS app bundle under $BUNDLE_DIR." >&2
  exit 1
fi

APP_BUNDLE="${APP_BUNDLES[0]}"
APP_INFO="$APP_BUNDLE/Contents/Info.plist"
EXTENSION_BUNDLE="$APP_BUNDLE/Contents/PlugIns/NomoQuickLookPreview.appex"
EXTENSION_INFO="$EXTENSION_BUNDLE/Contents/Info.plist"

if [[ ! -d "$EXTENSION_BUNDLE" || ! -f "$EXTENSION_INFO" ]]; then
  echo "Quick Look extension is missing from $APP_BUNDLE." >&2
  exit 1
fi

DECLARED_EXTENSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundlePlugIns:0' "$APP_INFO")"
if [[ "$DECLARED_EXTENSION" != "Contents/PlugIns/NomoQuickLookPreview.appex" ]]; then
  echo "Containing app does not declare the embedded Quick Look extension." >&2
  exit 1
fi

APP_VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
APP_BUNDLE_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP_INFO")"
EXTENSION_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$EXTENSION_INFO")"
EXTENSION_BUNDLE_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$EXTENSION_INFO")"
if [[ "$EXTENSION_VERSION" != "$APP_VERSION" ]]; then
  echo "Quick Look version mismatch: app=$APP_VERSION extension=$EXTENSION_VERSION." >&2
  exit 1
fi
if [[ "$EXTENSION_BUNDLE_VERSION" != "$APP_BUNDLE_VERSION" ]]; then
  echo "Quick Look build version mismatch: app=$APP_BUNDLE_VERSION extension=$EXTENSION_BUNDLE_VERSION." >&2
  exit 1
fi

ICON_NAME="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIconName' "$APP_INFO")"
if [[ "$ICON_NAME" != "AppIcon" ]]; then
  echo "Containing app is missing CFBundleIconName=AppIcon." >&2
  exit 1
fi
if [[ ! -f "$APP_BUNDLE/Contents/Resources/Assets.car" ]]; then
  echo "Appearance-aware AppIcon catalog is missing from $APP_BUNDLE." >&2
  exit 1
fi

/usr/bin/codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"

echo "Verified embedded Quick Look extension: $EXTENSION_BUNDLE"
