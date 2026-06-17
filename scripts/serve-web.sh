#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/web"

PORT="${1:-8080}"
echo "Serving web/ on http://localhost:$PORT"
echo "Open in Windows Chrome (WebHID requires host browser + USB)"
exec python3 -m http.server "$PORT"
