#!/usr/bin/env bash
# 把 light/dark PNG 编进 Assets.car，让应用未运行时 Dock / 启动台也能跟随系统外观。
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "compile-macos-appicon.sh 只能在 macOS 上运行。" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIGHT="$ROOT/src-tauri/icons/nomo/macos/nomo-app-light-256.png"
DARK="$ROOT/src-tauri/icons/nomo/macos/nomo-app-dark-256.png"
OUT_DIR="$ROOT/src-tauri/target/appicon"

if [[ ! -f "$LIGHT" || ! -f "$DARK" ]]; then
  echo "缺少 macOS Dock 图标: $LIGHT / $DARK" >&2
  exit 1
fi

resolve_actool() {
  if xcrun --find actool >/dev/null 2>&1; then
    return 0
  fi
  local app
  for app in /Applications/Xcode.app /Applications/Xcode-beta.app; do
    if [[ -x "$app/Contents/Developer/usr/bin/actool" ]]; then
      export DEVELOPER_DIR="$app/Contents/Developer"
      return 0
    fi
  done
  echo "找不到 actool。请安装 Xcode（Command Line Tools 不够），以便编译跟随系统的 App 图标。" >&2
  exit 1
}

resolve_actool

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ICON="$TMP/AppIcon.icon"
mkdir -p "$ICON/Assets" "$OUT_DIR"

python3 - "$LIGHT" "$DARK" "$ICON" <<'PY'
import json
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path


def paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def read_rgba(path: Path):
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos = 8
    idat = b""
    width = height = bit_depth = color_type = None
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        ctype = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if ctype == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", chunk[:10])
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"IEND":
            break
    if bit_depth != 8 or color_type != 6:
        raise SystemExit(f"{path} 必须是 8-bit RGBA PNG")
    raw = zlib.decompress(idat)
    bpp = 4
    stride = width * bpp
    rows = []
    prev = bytearray(stride)
    offset = 0
    for _ in range(height):
        filter_type = raw[offset]
        scan = bytearray(raw[offset + 1 : offset + 1 + stride])
        offset += 1 + stride
        if filter_type == 1:
            for i in range(stride):
                left = scan[i - bpp] if i >= bpp else 0
                scan[i] = (scan[i] + left) & 255
        elif filter_type == 2:
            for i in range(stride):
                scan[i] = (scan[i] + prev[i]) & 255
        elif filter_type == 3:
            for i in range(stride):
                left = scan[i - bpp] if i >= bpp else 0
                scan[i] = (scan[i] + ((left + prev[i]) // 2)) & 255
        elif filter_type == 4:
            for i in range(stride):
                left = scan[i - bpp] if i >= bpp else 0
                up_left = prev[i - bpp] if i >= bpp else 0
                scan[i] = (scan[i] + paeth(left, prev[i], up_left)) & 255
        elif filter_type != 0:
            raise SystemExit(f"{path} 含不支持的 PNG filter {filter_type}")
        rows.append(bytes(scan))
        prev = scan
    return width, height, b"".join(rows)


def write_png(path: Path, width: int, height: int, rgba: bytes):
    def chunk(tag: bytes, payload: bytes) -> bytes:
        crc = zlib.crc32(tag + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", crc)

    raw = b"".join(b"\x00" + rgba[y * width * 4 : (y + 1) * width * 4] for y in range(height))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def crop_to_opaque_1024(src: Path, dest: Path) -> None:
    width, height, rgba = read_rgba(src)
    min_x, min_y, max_x, max_y = width, height, -1, -1
    for y in range(height):
        row = y * width * 4
        for x in range(width):
            if rgba[row + x * 4 + 3] > 8:
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
    if max_x < min_x:
        raise SystemExit(f"{src} 没有不透明像素")
    crop_w = max_x - min_x + 1
    crop_h = max_y - min_y + 1
    cropped = bytearray(crop_w * crop_h * 4)
    for y in range(crop_h):
        src_off = ((min_y + y) * width + min_x) * 4
        dest_off = y * crop_w * 4
        cropped[dest_off : dest_off + crop_w * 4] = rgba[src_off : src_off + crop_w * 4]
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    write_png(tmp_path, crop_w, crop_h, bytes(cropped))
    subprocess.check_call(
        ["sips", "-z", "1024", "1024", str(tmp_path), "--out", str(dest)],
        stdout=subprocess.DEVNULL,
    )
    tmp_path.unlink(missing_ok=True)


light_src, dark_src, icon_dir = map(Path, sys.argv[1:4])
assets = icon_dir / "Assets"
crop_to_opaque_1024(light_src, assets / "nomo-app-light.png")
crop_to_opaque_1024(dark_src, assets / "nomo-app-dark.png")

layer = {
    "glass": False,
    "image-scale": "fill",
    "opacity": 1,
    "position": {"scale": 1, "translation-in-points": [0, 0]},
}
payload = {
    "fill": "none",
    "groups": [
        {
            "layers": [
                {
                    **layer,
                    "hidden-specializations": [{"appearance": "dark", "value": True}],
                    "image-name": "nomo-app-light.png",
                    "name": "Light",
                },
                {
                    **layer,
                    "hidden-specializations": [
                        {"value": True},
                        {"appearance": "dark", "value": False},
                    ],
                    "image-name": "nomo-app-dark.png",
                    "name": "Dark",
                },
            ],
            "lighting": "combined",
            "name": "Nomo",
            "shadow": {"kind": "none", "opacity": 0},
            "specular": False,
            "translucency": {"enabled": False, "value": 0},
        }
    ],
    "supported-platforms": {"squares": ["macOS"]},
}
(icon_dir / "icon.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY

xcrun actool \
  --output-format human-readable-text \
  --notices \
  --warnings \
  --errors \
  --platform macosx \
  --minimum-deployment-target 15.0 \
  --target-device mac \
  --app-icon AppIcon \
  --compile "$OUT_DIR" \
  --output-partial-info-plist "$TMP/partial.plist" \
  "$ICON"

if [[ ! -f "$OUT_DIR/Assets.car" ]]; then
  echo "actool 没有生成 Assets.car" >&2
  exit 1
fi

echo "已生成跟随系统的 App 图标: $OUT_DIR/Assets.car"
