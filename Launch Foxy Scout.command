#!/bin/zsh
set -euo pipefail
fss_root="$(cd "$(dirname "$0")" && pwd)"
if [[ -d "$fss_root/Foxy Scout.app" ]]; then
  exec open "$fss_root/Foxy Scout.app"
fi
cd "$fss_root"
export PATH="$HOME/.cargo/bin:$PATH"
exec npm run tauri -- dev
