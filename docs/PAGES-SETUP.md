# GitHub Pages 配置说明

## 当前问题（已诊断）

仓库 Pages **发布源指错了分支**：

| 项目 | 当前错误配置 | 应改为 |
|------|----------------|--------|
| Source branch | `cursor/map-sharp-touch-a1c8`（**已删除**） | **`gh-pages`** |
| 结果 | 线上长期是旧 JS；新 workflow 也可能失败 | 与 Actions 推送到 `gh-pages` 一致 |

默认地址仍是：**https://jk9988610.github.io/Points-of-mess/**  
**不需要**「Add a verified domain」（仅自定义域名才要）。

---

## 请你手动改一次（约 1 分钟）

1. 打开：https://github.com/jk9988610/Points-of-mess/settings/pages  
2. **Build and deployment**  
3. **Source** 选 **Deploy from a branch**（不要选 GitHub Actions，除非你已单独配好）  
4. **Branch** 选 **`gh-pages`**，文件夹 **`/ (root)`**  
5. 点 **Save**  
6. 等 1～3 分钟，访问：https://jk9988610.github.io/Points-of-mess/  
7. **强制刷新**：Ctrl+Shift+R（或清缓存）

---

## Actions 在做什么

推送 **`main`** 后，workflow **Deploy to GitHub Pages** 会用 `peaceiris/actions-gh-pages` 把站点文件推到 **`gh-pages` 分支**。  
Pages 必须从 **`gh-pages`** 读，线上才会更新。

若 Actions 失败，到 **Actions** 页看红色任务日志。

---

## 如何确认已是 v0.1

调试区第一行应为：

```text
Points-of-mess v0.1 已加载（首轮程序选项 + 合并 API）
```

开聊后出现 **「首轮选项（程序预设）」**，且**没有** `→ 生成选项`。

或打开：

https://jk9988610.github.io/Points-of-mess/js/app.js?v=0.1.1

搜索 **`presetOptions`**（有 = 新版；只有 `generateOptions` = 旧版）。

---

## 线上 API

公开 Pages **默认没有**你的 `js/config.js` 密钥。要在线对话需在 `gh-pages` 单独放密钥（有风险），**推荐本地**打开 `index.html` + 本机 `config.js` 测试。
