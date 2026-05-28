#!/usr/bin/env bash
# 只改 js/version.js 中的 POM_VERSION；index 由 boot.js 自动带 ?v=
# 用法：./scripts/bump-version.sh 0.5.4
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VER="${1:?用法: bump-version.sh <x.y.z>}"
FILE="$ROOT/js/version.js"
if ! grep -q 'POM_VERSION' "$FILE"; then
  echo "未找到 POM_VERSION: $FILE" >&2
  exit 1
fi
sed -i "s/window.POM_VERSION = \"[^\"]*\"/window.POM_VERSION = \"${VER}\"/" "$FILE"
echo "POM_VERSION → ${VER}（index 经 boot.js 自动同步；请改 refresh.html 展示文案若需要）"
