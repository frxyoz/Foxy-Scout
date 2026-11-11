#!/bin/zsh
# Convert the generated master artwork into web and macOS application icons.
set -euo pipefail
fss_root="$(cd "$(dirname "$0")/.." && pwd)"
fss_assets="$fss_root/assets"
mkdir -p "$fss_root/.cache"
fss_icon_temp="$(mktemp -d "$fss_root/.cache/foxy-icons.XXXXXX")"
trap 'rm -rf "$fss_icon_temp"' EXIT
fss_iconset="$fss_icon_temp/FoxyScout.iconset"
mkdir "$fss_iconset"
for fss_icon_size in 16 32 128 256 512; do
  sips -z "$fss_icon_size" "$fss_icon_size" "$fss_assets/fox-logo.png" \
    --out "$fss_iconset/icon_${fss_icon_size}x${fss_icon_size}.png" >/dev/null
  fss_retina_size=$((fss_icon_size * 2))
  sips -z "$fss_retina_size" "$fss_retina_size" "$fss_assets/fox-logo.png" \
    --out "$fss_iconset/icon_${fss_icon_size}x${fss_icon_size}@2x.png" >/dev/null
done
iconutil -c icns "$fss_iconset" -o "$fss_assets/icon.icns"
sips -z 1024 1024 "$fss_assets/fox-logo.png" --out "$fss_assets/icon.png" >/dev/null
cp "$fss_assets/fox-logo.png" "$fss_assets/icon_source.png"
cp "$fss_assets/icon.icns" "$fss_assets/icon.png" "$fss_root/src-tauri/icons/"
cp "$fss_assets/fox-logo.png" "$fss_root/frontend/assets/fox-logo.png"
echo 'Built Foxy Scout application icons.' 
