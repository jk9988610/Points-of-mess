# Points-of-mess

个人专用的静态 Web 应用：在混乱宇宙中创建 **点**，为每个点设定角色性格，进入后由 AI 扮演该角色与你对话。无需 Node，浏览器即可运行。

**产品定义见 [docs/PRODUCT.md](docs/PRODUCT.md)；v0 实现定稿见 [docs/DESIGN-v0.md](docs/DESIGN-v0.md)。**

## 快速开始

1. 编辑 `js/config.js`，填入 DeepSeek `apiKey`（可参考 `js/config.example.js`）。
2. 用浏览器打开 `index.html`（平板可直接打开项目文件夹中的该文件）。
3. 在分支 **`main`** 上开发与发布稳定版。

## 在线访问

启用 GitHub Pages（Settings → Pages → 分支 **gh-pages** → `/ (root)`）后：

**https://jk9988610.github.io/Points-of-mess/**

未启用前可用备用预览（**main** 分支）：

**https://htmlpreview.github.io/?https://raw.githubusercontent.com/jk9988610/Points-of-mess/main/index.html**

## 当前功能

- 地图点击移动、点击角色交谈（平板触屏）
- 角色「锋利」：程序开场 + 四选项（要点 / 追问 / 换题 / 收束）
- 漫画式文本框气泡、DeepSeek 流式短回复
- 按角色 `localStorage` 保存对话

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

- 请求由浏览器直连 DeepSeek（支持 CORS）；个人自用可将密钥写在 `js/config.js`。
- 推送到 **`main`** 会通过 Actions 更新 **`gh-pages`** 供 Pages 发布。
