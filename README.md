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

## 项目结构

```
index.html          # 页面壳
styles/chat.css     # 样式
js/state.js         # 状态与本地存储
js/render.js        # DOM 渲染
js/api.js           # 流式 API 客户端
js/app.js           # 应用逻辑与事件
server.js           # DeepSeek API 代理
```

## 安全说明

- **切勿**将 `DEEPSEEK_API_KEY` 写入前端代码或提交到 Git（`.env` 已在 `.gitignore` 中）。
- 若密钥曾在聊天或公开仓库中泄露，请在 DeepSeek 控制台轮换密钥。
