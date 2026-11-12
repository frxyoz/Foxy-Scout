#!/bin/zsh
set -euo pipefail
fss_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$fss_root"
export PATH="$HOME/.cargo/bin:$PATH"
if [[ ! -d node_modules ]]; then
  npm ci
fi
npm run tauri -- build
fss_bundle="$fss_root/src-tauri/target/release/bundle/macos/Foxy Scout.app"
fss_installed="/Applications/Foxy Scout.app"
codesign --force --deep --sign - "$fss_bundle"
codesign --verify --deep --strict "$fss_bundle"
mkdir -p dist
if [[ -d "$fss_installed" ]]; then
  fss_backup_dir=$(mktemp -d "$fss_root/dist/app-backup.XXXXXX")
  ditto "$fss_installed" "$fss_backup_dir/Foxy Scout.app"
fi
fss_was_running=false
if pgrep -fx "$fss_installed/Contents/MacOS/foxy-scout" >/dev/null; then
  fss_was_running=true
  osascript -e 'tell application id "local.foxy.scout" to quit'
fi
ditto "$fss_bundle" "$fss_root/dist/Foxy Scout.app"
ditto "$fss_bundle" "$fss_root/Foxy Scout.app"
ditto "$fss_bundle" "$fss_installed"
for fss_copy in "$fss_root/dist/Foxy Scout.app" "$fss_root/Foxy Scout.app" "$fss_installed"; do
  codesign --verify --deep --strict "$fss_copy"
  cmp "$fss_bundle/Contents/MacOS/foxy-scout" "$fss_copy/Contents/MacOS/foxy-scout"
done
if [[ "$fss_was_running" == true ]]; then
  open "$fss_installed"
fi
print 'Built, verified, and installed Foxy Scout.app in /Applications and project copies.'
