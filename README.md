# Points-of-mess

基于 DeepSeek API 的网页 AI 对话应用。前端为模块化静态页面，通过本地 Node 服务代理 API（密钥仅保存在服务端 `.env`，不会暴露给浏览器）。

## 功能

- 与 DeepSeek `deepseek-chat` 模型进行多轮文本对话
- 流式输出（打字机效果）
- 停止生成、清空会话
- 浏览器 `localStorage` 自动保存对话记录

## 快速开始

1. 复制环境变量模板并填入 API Key：

```bash
cp .env.example .env
# 编辑 .env，设置 DEEPSEEK_API_KEY=你的密钥
```

2. 安装依赖并启动：

```bash
npm install
npm start
```

3. 在浏览器打开 [http://localhost:3000](http://localhost:3000)

开发时可用 `npm run dev`（文件变更自动重启服务）。

## 在 Pad / 平板上使用（局域网）

本应用在电脑上跑 Node 服务，Pad 通过 **同一 Wi‑Fi** 用浏览器访问，API 密钥仍只保存在电脑端的 `.env`。

### 1. 在电脑上启动

```bash
cd /workspace   # 或你的项目目录
cp .env.example .env   # 首次克隆时
# 编辑 .env，填入 DEEPSEEK_API_KEY
npm install
npm start
```

启动后终端会打印类似：

```text
Pad / 平板（同一 Wi‑Fi）可访问:
  http://192.168.1.23:3000
```

### 2. 在 Pad 上打开

1. 确保 Pad 与电脑连接 **同一无线网络**。
2. 在 Pad 的 Safari / Chrome 地址栏输入终端里显示的 `http://<电脑IP>:3000`。
3. （可选）**添加到主屏幕**：Safari → 分享 →「添加到主屏幕」，可像 App 一样全屏打开。

### 3. 常见问题

| 现象 | 处理 |
|------|------|
| Pad 打不开页面 | 确认电脑防火墙允许入站 **3000** 端口；Windows 可在「专用网络」放行 Node。 |
| 只有 localhost 没有局域网 IP | 电脑未连 Wi‑Fi 或仅有虚拟网卡；用 `ipconfig`（Windows）或 `ip addr`（Linux）查本机局域网 IP 手动输入。 |
| 克隆到新机器 | 复制 `.env.example` 为 `.env` 并重新填入密钥。 |

`.env` 中 `HOST=0.0.0.0`（默认）表示监听所有网卡，供 Pad 访问；仅本机调试可改为 `127.0.0.1`。

## 项目结构

```
index.html          # 页面壳
styles/chat.css     # 样式
js/state.js         # 状态与本地存储
js/render.js        # DOM 渲染
js/api.js           # 流式 API 客户端
js/app.js           # 应用逻辑与事件
server.js           # DeepSeek API 代理
manifest.webmanifest # PWA 清单（Pad 添加到主屏幕）
icons/              # 应用图标
```

## 安全说明

- **切勿**将 `DEEPSEEK_API_KEY` 写入前端代码或提交到 Git（`.env` 已在 `.gitignore` 中）。
- 若密钥曾在聊天或公开仓库中泄露，请在 DeepSeek 控制台轮换密钥。
