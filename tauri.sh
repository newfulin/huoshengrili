#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export RUSTUP_HOME="$ROOT/.rustup"
export CARGO_HOME="$ROOT/.cargo"
export CARGO_TARGET_DIR="$ROOT/src-tauri/target"
# shellcheck disable=SC1091
source "$CARGO_HOME/env"
cd "$ROOT"
exec node node_modules/@tauri-apps/cli/tauri.js "$@"
