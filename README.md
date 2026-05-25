# Points-of-mess

纯静态网页 AI 对话，**无需安装 Node**。浏览器直连 DeepSeek API，适合平板本地自用。

## 在线访问（DeepSeek 分支）

安卓平板浏览器打开：

**https://cdn.jsdelivr.net/gh/jk9988610/Points-of-mess@cursor/deepseek-chat-d862/index.html**

本分支：`cursor/deepseek-chat-d862`。推送到该分支后，刷新页面即可看到更新。

## 使用方式

1. 把整个项目文件夹拷到平板（或通过网盘/iCloud 同步）。
2. 用浏览器打开 **`index.html`** 即可开始聊天。
3. 若尚未配置密钥，编辑 **`js/config.js`**，填入 `apiKey`（可复制 `js/config.example.js` 作模板）。

## 功能

- DeepSeek 多轮对话与流式输出
- 停止生成、清空会话
- `localStorage` 自动保存对话（需浏览器允许本地存储）

## 文件结构

```
index.html
styles/chat.css
js/config.js      ← API 密钥（自用可写在这里）
js/state.js
js/render.js
js/api.js
js/app.js
```

## 说明

- **不需要 Node**：已移除服务端代理；请求从浏览器直接发往 `api.deepseek.com`（DeepSeek 支持跨域）。
- **密钥在前端**：仅适合你自己玩；不要把带密钥的文件夹公开分享或上传到公开仓库。
- 部分浏览器对 `file://` 打开本地页有限制；若无法联网，可改用「在文件 App 里用 Safari/Chrome 打开」或把整个文件夹放到任意静态网站目录下通过 `https://` 访问。
