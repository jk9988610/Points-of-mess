# Points-of-mess

个人专用的静态 Web 应用：在混乱宇宙地图上点击移动，靠近预设角色后通过选项对话。无需 Node，浏览器即可运行。

**日常说明（含安卓平板、GitHub 与本地区别、Pages 经验）：[docs/常用说明.md](docs/常用说明.md)**  

**产品定义见 [docs/PRODUCT.md](docs/PRODUCT.md)；v0 实现定稿见 [docs/DESIGN-v0.md](docs/DESIGN-v0.md)。**

## 如何访问

### 1. 本地（推荐，平板 / 电脑）

v0 地图对话在 **`main`**。任选一种方式打开页面：

| 方式 | 做法 |
|------|------|
| **直接打开文件** | 资源管理器中双击项目里的 `index.html` |
| **本地静态服务** | 在项目根目录执行 `python3 -m http.server 8080`，浏览器打开 `http://localhost:8080/` |

**首次必须配置 API 密钥**（否则点击底部选项时会提示未配置）：

```bash
cp js/config.example.js js/config.js
```

编辑 `js/config.js`，将 `apiKey` 换成你的 DeepSeek 密钥（不要用占位符 `你的_DeepSeek_API_密钥`）。保存后**刷新页面**。该文件已在 `.gitignore` 中，**不会提交到 Git**。

若打开页面顶部出现黄色配置说明，按其中三步操作即可。

**安卓平板**：见 [docs/常用说明.md](docs/常用说明.md) 第 3 节。简要：拷项目 → 建 `js/config.js` → Chrome 打开 `index.html`；或只开 Pages 看界面（线上默认无密钥）。

### 2. 在线（GitHub Pages）

**正式地址：** https://jk9988610.github.io/Points-of-mess/

线上更新（详见 [docs/PAGES-SETUP.md](docs/PAGES-SETUP.md)）：

1. 代码在 **`main`** 上  
2. **Settings → Pages → Source 选 `GitHub Actions`**（推荐，见新工作流 **GitHub Pages (official)**）  
3. [Actions → GitHub Pages (official)](https://github.com/jk9988610/Points-of-mess/actions/workflows/github-pages.yml) → **Run workflow**（main）→ 等成功  
4. 强刷站点  

若仍用 **gh-pages 分支** 发布：需 Pages build 为 **built**（强推 `main`→`gh-pages` 若 build **errored**，线上会一直是旧版 0.2.5）。

验收：线上 https://jk9988610.github.io/Points-of-mess/js/version.js 为 **`0.2.9`**（与 `main` 的 `POM_VERSION` 一致）。若仍是 **0.2.5**，见 [docs/PAGES-FIX.md](docs/PAGES-FIX.md)（分支已新、CDN 未更新）。

> **注意：** 线上**不会**包含本机 `js/config.js`（密钥在 `.gitignore`）。在线调 API 需在 `gh-pages` 单独放密钥（有风险），**推荐本地**测试。勿把密钥提交到 `main`。

**仅预览页面布局（无密钥、无法对话）** 可用 main 分支静态 HTML 预览：

**https://htmlpreview.github.io/?https://raw.githubusercontent.com/jk9988610/Points-of-mess/main/index.html**

### 3. 怎么用（v0）

1. 点击地图空白处 → 玩家移动  
2. 靠近橙色 **「锋利」** → 点击角色 → 气泡出现开场白  
3. 点击底部 **四条 AI 生成的句子**（最后一条为结束对话）→ 等待短回复；选结束句后对话收束  

## 快速开始（开发）

1. `cp js/config.example.js js/config.js` 并填写 `apiKey`  
2. 打开 `index.html` 或 `python3 -m http.server 8080`  
3. 在功能分支开发 → **合并 PR 到 `main`** → push 后 Actions 更新 Pages（见 [docs/PAGES-SETUP.md](docs/PAGES-SETUP.md)）  

## 当前功能

- 地图点击移动、点击角色交谈（平板触屏）
- 角色「锋利」：程序开场 + AI 生成四选项（仅显示台词；收束条弱红框）
- 漫画式文本框气泡、DeepSeek 流式短回复
- 地图位置写入 `localStorage`；**刷新页面会清空对话历史**（便于测试，见 `js/state.js` 中 `PERSIST_SESSIONS`）

## 文件结构

```
index.html
styles/map.css
js/config.js
js/presets.js
js/dialogue.js
js/state.js
js/map.js
js/api.js
js/app.js
docs/PRODUCT.md
docs/DESIGN-v0.md
```

## 说明

- 请求由浏览器直连 DeepSeek（支持 CORS）；密钥只放在本机或 `gh-pages` 的 `js/config.js`，不要提交到 `main`。
- 推送到 **`main`** 会通过 Actions 更新 **`gh-pages`** 供 Pages 发布（见上文 [在线访问](#在线github-pages)）。
