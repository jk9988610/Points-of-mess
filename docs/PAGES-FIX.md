# Pages 一直显示 0.2.5（分支已是 0.2.8+）

## 原因（已确认）

| 位置 | `version.js` |
|------|----------------|
| **gh-pages 分支** / **main** | 新版（如 `0.2.9`） |
| **https://jk9988610.github.io/Points-of-mess/** | 常卡在 **0.2.5** |

**不是网址错了**，而是 **GitHub Pages 的 CDN 没有用上最新的成功部署**。  
`gh-pages` 文件更新了，但 **Pages 构建失败或未完成** 时，线上会继续用**上一次 build 成功**的旧包（多为 `0.2.5`）。

自检：

- 分支：https://raw.githubusercontent.com/jk9988610/Points-of-mess/gh-pages/js/version.js → 应为新版  
- 线上：https://jk9988610.github.io/Points-of-mess/js/version.js → 若仍是 `0.2.5`，说明 **CDN 未更新**

---

## 推荐做法（一次搞定）

### 1. 改 Pages 源（必做）

1. 打开 https://github.com/jk9988610/Points-of-mess/settings/pages  
2. **Build and deployment → Source** 选 **GitHub Actions**（不要选 Deploy from a branch → gh-pages）  
3. 保存

### 2. 手动重发（必做）

1. 打开 https://github.com/jk9988610/Points-of-mess/actions/workflows/republish-pages.yml  
2. **Run workflow** → 选 **main** → Run  
3. 打开 https://github.com/jk9988610/Points-of-mess/deployments  
4. 等 **github-pages** 这一条为 **Success**（不要只看 workflow 绿勾，要看 Deployments）

### 3. 验收

无痕或强刷：

https://jk9988610.github.io/Points-of-mess/js/version.js?v=check

应看到 `POM_VERSION = "0.2.9"`（或更高）。  
可选：https://jk9988610.github.io/Points-of-mess/DEPLOY.txt 应有时间戳与 commit。

---

## 备选：继续用 gh-pages 分支

若 **Settings** 仍选 **Deploy from branch → gh-pages**：

1. 本机：`./scripts/sync-gh-pages.sh`（会去掉 `.github`、写 `DEPLOY.txt`）  
2. Actions → **Deploy to GitHub Pages** → Run workflow（`pages.yml` 已 `force_orphan: true`）  
3. 在 **Settings → Pages** 看最近一次 build 是否为 **built**（不是 **errored** / 一直 **building**）

---

## 仍不行时

- **Deployments** 里最新一条是否 **Failed**？点进去看日志。  
- 是否只跑了 `pages.yml` 但没把 Source 改成 **GitHub Actions**？（两种源不要混着以为已经生效）  
- 浏览器无痕再开一次（排除本地缓存）。
