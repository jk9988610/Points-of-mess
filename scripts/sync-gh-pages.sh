#!/usr/bin/env bash
# 发布到 gh-pages（排除 .github，避免 Pages Jekyll build 失败）
# 用法：在仓库根目录 ./scripts/sync-gh-pages.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
git fetch origin main
REF="$(git rev-parse origin/main)"
SHORT="$(git rev-parse --short origin/main)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git archive "$REF" | tar -x -C "$TMP"
rm -rf "$TMP/.github"
touch "$TMP/.nojekyll"

cd "$TMP"
git init -q
git config user.email "deploy@points-of-mess"
git config user.name "Points-of-mess deploy"
git add -A
git commit -q -m "deploy: ${SHORT}"

git push -f "$(git -C "$ROOT" remote get-url origin)" HEAD:gh-pages

echo "已发布 ${SHORT} → gh-pages（无 .github 目录）"
echo "等 1～3 分钟 Pages build 变 built 后访问："
echo "https://jk9988610.github.io/Points-of-mess/js/version.js"
