# GitHub Pages 配置说明

## 你看到的是 0.2.5，但分支已是 0.2.6+？

请用这两个地址对比：

| 地址 | 含义 |
|------|------|
| https://raw.githubusercontent.com/jk9988610/Points-of-mess/gh-pages/js/version.js | **gh-pages 分支文件**（应对新版） |
| https://jk9988610.github.io/Points-of-mess/js/version.js | **线上 CDN**（只更新于 Pages **build 成功** 之后） |

若分支已是 `0.2.6` / `0.2.7`，而 `github.io` 仍是 `0.2.5`，说明：

- 最近把 `main` 强推到 `gh-pages` 后，Pages **build 失败**（`Page build failed`），或一直 **building**；
- 线上会继续用**上一次 build 成功**的旧提交（多为 `deploy: f11f988` 时代，即 0.2.5）。

---

## 推荐：改用 GitHub Actions 发布（请改 Settings 一次）

仓库已增加工作流：**GitHub Pages (official)**（`.github/workflows/github-pages.yml`）。

### 你必须做的一次设置

1. 打开 https://github.com/jk9988610/Points-of-mess/settings/pages  
2. **Build and deployment → Source** 选 **GitHub Actions**（不要选 Deploy from a branch → gh-pages）  
3. 保存  

### 触发部署

1. 打开 [Actions → GitHub Pages (official)](https://github.com/jk9988610/Points-of-mess/actions/workflows/github-pages.yml)  
2. **Run workflow** → 分支 **main** → Run  
3. 等绿色成功后，强刷 https://jk9988610.github.io/Points-of-mess/js/version.js  

验收：`POM_VERSION = "0.2.7"`（或当前 `main` 版本号）。

> 改 Source 后，旧「gh-pages 分支 + Jekyll build」不再决定线上内容；以 Actions 部署为准。

---

## 备选：继续用 gh-pages 分支

若坚持 **Deploy from a branch → gh-pages**：

1. 根目录需有 **`.nojekyll`**（已加入，避免 Jekyll 把站点 build 挂掉）  
2. 同步分支：
   ```bash
   ./scripts/sync-gh-pages.sh
   ```
3. 到仓库 **Actions** 或 **Environments → github-pages** 看 **Pages build** 是否 **built**（errored 则线上不会变）  
4. 也可用旧工作流 **Deploy to GitHub Pages**（peaceiris）在本机 push `main` 后运行  

---

## 代码在 main 上即可

- 功能合并进 **`main`** 即可；不必再依赖未合并的 PR。  
- Cloud Agent 的 push **常常不会触发** Actions，需你在 Actions 页 **Run workflow**，或本机 push。

---

## 验收版本（当前 main）

- https://jk9988610.github.io/Points-of-mess/js/version.js?v=0.2.7  
- 标题旁 **v0.2.7**

---

## 线上 API

`js/config.js` 不在仓库中。在线调 API 请本地用 `config.js`，或自行承担在部署分支放密钥的风险。
