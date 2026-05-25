# Points-of-mess

纯静态网页 AI 对话，**无需安装 Node**。浏览器直连 DeepSeek API，适合平板本地自用。

## 在线访问（DeepSeek 分支）

安卓平板请用下面任一链接（**不要用 jsdelivr**，会把网页当成纯文本显示源码）：

1. **推荐（GitHub Pages）**  
   **https://jk9988610.github.io/Points-of-mess/**  
   仓库 Settings → Pages → Source 选 **Deploy from branch** → 分支 **gh-pages** → `/ (root)` → Save。  
   每次推送到 `cursor/deepseek-chat-d862` 会自动更新站点。

2. **备用（立即可用）**  
   **https://htmlpreview.github.io/?https://raw.githubusercontent.com/jk9988610/Points-of-mess/cursor/deepseek-chat-d862/index.html**

本分支：`cursor/deepseek-chat-d862`。

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

## 分支管理

本仓库只保留三个分支，分工如下：

| 分支 | 用途 | 谁改 |
|------|------|------|
| `cursor/deepseek-chat-d862` | 日常开发、改聊天功能 | 人 + Cursor Agent |
| `gh-pages` | 网站发布（GitHub Pages） | **仅** Actions 自动推送，不要手改 |
| `main` | 验收通过后的稳定记录 | 通过 PR 从 DeepSeek 分支合并 |

**协作流程**：在 Cursor 提需求 → Agent 改 `cursor/deepseek-chat-d862` 并 push → 平板用上方链接测试 → 满意后 PR 合并到 `main`。

**新功能分支命名**：`cursor/<做什么>-d862`（与当前任务无关时不要新建，继续在 DeepSeek 分支上改即可）。

**不要删**：`main`、`cursor/deepseek-chat-d862`、`gh-pages`。已合并或过期的 `cursor/*` 可在 GitHub → Branches 里删除。

**访问注意**：不要用 jsDelivr 直链 `.html`（会显示源码）；用 README 里的 htmlpreview 或 `github.io` 地址。

## 说明

- **不需要 Node**：已移除服务端代理；请求从浏览器直接发往 `api.deepseek.com`（DeepSeek 支持跨域）。
- **密钥在前端**：仅适合你自己玩；不要把带密钥的文件夹公开分享或上传到公开仓库。
- 部分浏览器对 `file://` 打开本地页有限制；若无法联网，可改用「在文件 App 里用 Safari/Chrome 打开」或把整个文件夹放到任意静态网站目录下通过 `https://` 访问。
