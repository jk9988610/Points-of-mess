# GitHub Pages 配置说明

## 不需要「Add a verified domain」

仓库若使用默认地址：

**https://jk9988610.github.io/Points-of-mess/**

**不必**添加自定义域名，也**不必**填写 Verified domain。  
「Add a verified domain」仅在你使用自己的域名（如 `game.example.com`）时才需要。

---

## 正确开启 Pages（必做一次）

1. 打开仓库 **Settings** → **Pages**
2. **Build and deployment** → **Source** 选 **GitHub Actions**（不要选错成仅更新 `gh-pages` 分支却不发布）
3. 保存后，到 **Actions** 运行 **Deploy to GitHub Pages**（或推送 `main` 触发）
4. 等几分钟，访问：https://jk9988610.github.io/Points-of-mess/

---

## 如何确认线上已是新版本

打开调试日志，第一行应为：

```text
Points-of-mess v0.1 已加载（首轮程序选项 + 合并 API）
```

开聊后应出现 **「首轮选项（程序预设）」**，且**没有** `→ 生成选项`。

或在浏览器打开（强制绕过缓存）：

`https://jk9988610.github.io/Points-of-mess/js/app.js`

搜索 `presetOptions` — 有则为新版；仅有 `generateOptions` 则为旧缓存或 Pages 未更新。

---

## 线上 API 密钥

`js/config.js` 默认不会从 `main` 部署到公开站。若要在 Pages 上对话：

- 仅在 **GitHub Actions 部署产物** 或 **私密方式** 配置密钥；或
- **推荐**：本地打开 `index.html` + 本机 `js/config.js` 测试。

切勿把真实 API 密钥提交到公开 `main`。
