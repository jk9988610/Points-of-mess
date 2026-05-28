# Points-of-mess

个人专用的静态 Web 应用：在混乱宇宙地图上点击移动，靠近**证官**后通过**三推证**选项完成逻辑论证题。无需 Node，浏览器即可运行。

**日常说明（含安卓平板、GitHub 与本地区别、Pages 经验）：[docs/常用说明.md](docs/常用说明.md)**  

**产品定义见 [docs/PRODUCT.md](docs/PRODUCT.md)；论证架构见 [docs/PROOF-ARCHITECTURE.md](docs/PROOF-ARCHITECTURE.md)。**

## 如何访问

### 1. 本地（推荐，平板 / 电脑）

在 **`main`** 分支任选一种方式打开页面：

| 方式 | 做法 |
|------|------|
| **直接打开文件** | 资源管理器中双击项目里的 `index.html` |
| **本地静态服务** | 在项目根目录执行 `python3 -m http.server 8080`，浏览器打开 `http://localhost:8080/` |

**首次须登录**（否则无法调 AI）：

- **账号**：`jk9988610`
- **密钥**：你的 DeepSeek API Key（可勾选「在本机记住」，由浏览器保存，**不会**出现在 Git 仓库里）

**安卓平板**：见 [docs/常用说明.md](docs/常用说明.md) 第 3 节。

### 2. 在线（GitHub Pages）

**正式地址：** https://jk9988610.github.io/Points-of-mess/

线上更新（详见 [docs/PAGES-SETUP.md](docs/PAGES-SETUP.md)）：

1. 代码在 **`main`** 上  
2. **Settings → Pages → Source 选 `GitHub Actions`**（工作流 **GitHub Pages (official)**）  
3. push 到 `main` 后 Actions 自动部署，或手动 Run workflow  
4. 强刷站点  

验收：线上 https://jk9988610.github.io/Points-of-mess/js/version.js 与 `main` 的 `POM_VERSION` 一致（当前 **0.6.2**）。缓存问题见 [docs/PAGES-FIX.md](docs/PAGES-FIX.md)。

> **注意：** 仓库与 Pages **不含** API 密钥；登录后密钥仅存本机浏览器。

### 3. 怎么用

1. 点击地图空白处 → 移动  
2. 靠近 **证官** → 点击交谈 → 证官开场  
3. 点击底部 **三条推证句**（1 正 2 误，位置随机）→ 证官短回复；证毕后选离场句结束本局，靠近证官可换下一题  

## 快速开始（开发）

1. 打开 `index.html` 或 `python3 -m http.server 8080`  
2. 登录（账号 `jk9988610`，密钥填 DeepSeek API Key）  
3. 合并到 `main` 并 push → Actions 更新 Pages  

## 当前功能

- 地图点击移动、点击证官对论（平板触屏）
- 逻辑推理论题池随机抽题 + AI 开局（证明席 + 首轮三选项）
- 每轮：① 证官 reply → ② 三推证选项 → ③ 证明席摘要压缩
- 漫画式气泡、DeepSeek 流式短回复
- 地图位置写入 `localStorage`；**刷新页面会清空对话历史**（见 `js/state.js` 中 `PERSIST_SESSIONS`）

## 文件结构

```
index.html
styles/map.css
js/version.js
js/boot.js
js/proof-pool.js
js/proof-bootstrap.js
js/onion.js
js/options-ai.js
js/summary.js
js/app.js
docs/PROOF-ARCHITECTURE.md
```

## 说明

- 请求由浏览器直连 DeepSeek（支持 CORS）；API 密钥仅在登录后存于本机浏览器，不进 Git。
- 推送到 **`main`** 由 **GitHub Pages (official)** 工作流发布静态站点。
