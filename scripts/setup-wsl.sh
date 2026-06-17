#!/usr/bin/env bash
# WSL 初回セットアップ: 依存 clone + apt パッケージ
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Project root: $ROOT"

if ! command -v git >/dev/null; then
  echo "git が見つかりません。sudo apt install -y git"
  exit 1
fi

mkdir -p external

if [[ ! -d external/ch32fun/.git ]]; then
  echo "==> clone ch32fun"
  git clone --depth 1 https://github.com/cnlohr/ch32fun.git external/ch32fun
else
  echo "==> ch32fun already exists"
fi

if [[ ! -d external/rv003usb/.git ]]; then
  echo "==> clone rv003usb"
  git clone --depth 1 https://github.com/cnlohr/rv003usb.git external/rv003usb
else
  echo "==> rv003usb already exists"
fi

if command -v apt-get >/dev/null; then
  echo "==> apt packages (sudo)"
  sudo apt-get update -qq
  sudo apt-get install -y \
    make \
    gcc-riscv64-unknown-elf \
    binutils-riscv64-unknown-elf \
    picolibc-riscv64-unknown-elf \
    python3
else
  echo "==> apt-get なし — 手動で RISC-V GCC を PATH に追加してください"
fi

echo ""
echo "Done. Next:"
echo "  ./scripts/build-firmware.sh"
echo "  ./scripts/serve-web.sh"
