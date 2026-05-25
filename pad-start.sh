#!/bin/sh
# Pad / 平板一键启动：安装依赖并启动本地服务
set -e
cd "$(dirname "$0")"

printf '%s\n' "=========================================="
printf '%s\n' "  Points-of-mess · Pad 一键启动"
printf '%s\n' "=========================================="
printf '\n'

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "未找到 node。请在 Pad 上安装："
  printf '%s\n' "  · iPad：iSH 或 a-Shell 后执行 apk install nodejs npm"
  printf '%s\n' "  · Android：Termux 后执行 pkg install nodejs"
  printf '%s\n' "详见 docs/PAD-开发指南.md"
  exit 1
fi

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    printf '%s\n' "已创建 .env —— 请用编辑器填入 DEEPSEEK_API_KEY，保存后再运行："
    printf '%s\n' "  sh pad-start.sh"
    exit 1
  fi
  printf '%s\n' "缺少 .env，请复制 .env.example 并填入 DEEPSEEK_API_KEY。"
  exit 1
fi

if [ ! -d node_modules ]; then
  printf '%s\n' "首次运行，正在安装依赖（npm install）…"
  npm install
  printf '\n'
fi

printf '%s\n' "重要：请不要在「文件」里点开 index.html。"
printf '%s\n' "请在 Safari 打开终端下方显示的 http:// 地址。"
printf '\n'

exec npm start
