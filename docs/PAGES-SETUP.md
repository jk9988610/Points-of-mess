# GitHub Pages 配置说明

## 线上为什么还是旧版本号？

Pages **不会**自动拉取未合并进 `main` 的功能分支。流程是：

```text
功能分支开发 → 合并到 main → push main → Actions 部署到 gh-pages → 浏览器强刷
```

若只改了 `cursor/...` 分支、**未合并 `main`**，则 https://jk9988610.github.io/Points-of-mess/ 会一直显示旧版（例如仍显示 v0.1.5）。

---

## 当前问题（已诊断过）

仓库 Pages **发布源曾指错分支**：

| 项目 | 错误配置 | 应改为 |
|------|----------|--------|
| Source branch | `cursor/map-sharp-touch-a1c8`（**已删除**） | **`gh-pages`** |
| 结果 | 线上长期是旧 JS | 与 Actions 推送到 `gh-pages` 一致 |

默认地址：**https://jk9988610.github.io/Points-of-mess/**  
**不需要**「Add a verified domain」。

---

## 让线上更新到新版本（完整步骤）

### A. 代码进 `main`（必须）

1. 在 GitHub 上 **合并 PR** 到 `main`，或本地：
   ```bash
   git checkout main
   git pull origin main
   git merge <你的功能分支>
   git push origin main
   ```
2. 打开 **Actions** → 工作流 **Deploy to GitHub Pages** 应为绿色成功。  
   失败则看日志；成功会把当前仓库根目录推到 **`gh-pages` 分支**。

### B. Pages 源指向 `gh-pages`（只需改一次）

1. https://github.com/jk9988610/Points-of-mess/settings/pages  
2. **Source**：**Deploy from a branch**  
3. **Branch**：**`gh-pages`**，目录 **`/ (root)`**  
4. **Save**

> 若 Source 仍指向已删除的 `cursor/...` 分支，无论 Actions 多新，线上都不会变。

### C. 浏览器强刷（必须）

- Windows/Linux：**Ctrl+Shift+R**  
- macOS：**Cmd+Shift+R**  
- 或无痕窗口打开站点  

静态资源带 `?v=0.1.8` 等查询参数；强刷可避免旧 `app.js` 缓存。

### D. 可选：直接核对 `gh-pages` 上的文件

合并并部署成功后，在浏览器打开（把版本号换成你期望的）：

https://jk9988610.github.io/Points-of-mess/js/version.js?v=0.1.8

应能看到 `POM_VERSION = "0.1.8"`。  
或打开：

https://jk9988610.github.io/Points-of-mess/js/app.js

搜索 `POM_VERSION` / `记忆探测` / `v0.1.8`。

---

## Actions 在做什么

推送 **`main`** 时，`.github/workflows/pages.yml` 用 `peaceiris/actions-gh-pages` 把整个项目（除 `.github`）推到 **`gh-pages`**。  
**Pages 必须从 `gh-pages` 读**，线上才会与 `main` 一致。

`workflow_dispatch` 支持在 Actions 页手动 **Run workflow** 重新部署（仍需 `main` 上已是新代码）。

---

## 如何确认已是 v0.1.8

1. 标题栏：**Points-of-mess `v0.1.8`**（标题旁灰色小字）  
2. 调试区首行：`Points-of-mess v0.1.8 已加载（调试分色=内联样式）`  
3. 调试栏有 **「测记忆」** 按钮；开聊后有 **「记忆探测」** 与本局暗号  

旧版对照：v0.1.5 无 `version.js`、无「测记忆」、日志写 `v0.1.5 已加载`。

---

## 本地 vs 线上

| 环境 | 如何看到最新代码 |
|------|------------------|
| **本地** | 拉最新 `main` 或功能分支，硬刷 `index.html` |
| **GitHub Pages** | 必须 **合并 `main` + Actions 成功 + Pages 源 `gh-pages` + 强刷** |

**htmlpreview**（`raw.githubusercontent.com/.../main/index.html`）读的是 **main 分支源码**，不是 `gh-pages` 部署结果；且容易缓存，**不能**代替 Pages 验收。

---

## 线上 API

公开 Pages **默认没有**你的 `js/config.js` 密钥。要在线对话需在 **`gh-pages` 分支**单独放一份 `config.js`（勿把密钥提交到 `main`），**推荐本地** `index.html` + 本机 `config.js` 测试。
