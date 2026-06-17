#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/firmware/webhid"

if [[ ! -d "$ROOT/external/ch32fun/ch32fun" ]]; then
  echo "external/ch32fun がありません。先に ./scripts/setup-wsl.sh"
  exit 1
fi

make clean 2>/dev/null || true
make

echo ""
ls -la webhid.bin
echo "Flash: Chrome → https://yuukiumeta-uiap.github.io/rv003usb-webflasher/example.html"
echo "       Choose File → $ROOT/firmware/webhid/webhid.bin"
