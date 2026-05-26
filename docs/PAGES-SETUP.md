# GitHub Pages 配置说明

## 发布原理（必读）

本仓库线上地址：**https://jk9988610.github.io/Points-of-mess/**

| 环节 | 说明 |
|------|------|
| **源码** | `main` 分支 |
| **发布分支** | `gh-pages`（由 Actions 或脚本写入） |
| **Pages 设置** | Settings → Pages → **Deploy from a branch** → 分支 **`gh-pages`** → **`/ (root)`** |

**不要**把 Pages 源设成已删除的 `cursor/...` 分支，也不要指望 htmlpreview 代表线上版本。

---

## 让线上更新（任选一种）

### 方式 1：GitHub Actions（推荐，在你本机 push 到 main 后）

1. 代码已 **merge 并 push 到 `main`**
2. 打开 [Actions → Deploy to GitHub Pages](https://github.com/jk9988610/Points-of-mess/actions/workflows/pages.yml)
3. 应出现绿色成功的 **push** 记录；若没有，点 **Run workflow** → 分支 **main** → **Run workflow**
4. 等约 1 分钟，强刷站点（Ctrl+Shift+R）

### 方式 2：手动同步脚本（Actions 没跑时用这个）

部分环境（如 Cloud Agent）的 `git push` **不会触发** Actions，需要手动同步：

```bash
git fetch origin main
git push origin origin/main:gh-pages --force
```

或：

```bash
chmod +x scripts/sync-gh-pages.sh
./scripts/sync-gh-pages.sh
```

### 方式 3：Settings 检查（只需做一次）

1. https://github.com/jk9988610/Points-of-mess/settings/pages  
2. **Build and deployment → Source**：**Deploy from a branch**  
3. **Branch**：**`gh-pages`**，文件夹 **`/ (root)`**  
4. **Save**

---

## 如何确认已是 v0.2.6

1. 打开（可加随机参数防缓存）：  
   https://jk9988610.github.io/Points-of-mess/js/version.js?v=0.2.6  
   应看到：`POM_VERSION = "0.2.6"`
2. 站点标题旁：**v0.2.6**
3. 调试首行：`Points-of-mess v0.2.6 已加载…`

---

## Actions 在做什么

`.github/workflows/pages.yml` 用 `peaceiris/actions-gh-pages` 把仓库根目录（除 `.github`）推到 **`gh-pages`**。

若 **push main 后 Actions 列表没有新任务**，常见原因：

- 使用 `GITHUB_TOKEN` 在其它 workflow 里推 main（不会连锁触发）
- 使用部分自动化账号推送

**处理**：用上面 **方式 2** 脚本，或 Actions 页 **Run workflow**。

---

## 线上 API

公开 Pages **没有** `js/config.js`（在 `.gitignore`）。在线调 API 需在 `gh-pages` 单独放密钥（有风险），**推荐本地** `index.html` + 本机 `config.js`。
