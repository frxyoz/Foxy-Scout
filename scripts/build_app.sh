#!/bin/zsh
set -euo pipefail
fss_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$fss_root"
export PATH="$HOME/.cargo/bin:$PATH"
npm ci
npm run tauri -- build
codesign --force --deep --sign - 'src-tauri/target/release/bundle/macos/Foxy Scout.app'
mkdir -p dist
ditto 'src-tauri/target/release/bundle/macos/Foxy Scout.app' 'dist/Foxy Scout.app'
ditto 'dist/Foxy Scout.app' 'Foxy Scout.app'
codesign --verify --deep --strict 'Foxy Scout.app'
