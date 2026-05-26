#!/usr/bin/env bash
# 将 main 当前内容推到 gh-pages（Pages 源为 gh-pages /(root) 时立即生效）
# 用法：./scripts/sync-gh-pages.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch origin main
git push origin "origin/main:gh-pages" --force
echo "已同步 origin/main → gh-pages。请强刷 https://jk9988610.github.io/Points-of-mess/"
