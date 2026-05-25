# 安卓平板 + Termux 手把手教程

面向：**从未用过命令行**的安卓平板用户。

---

## 一、终端在哪里？

在安卓平板上，**没有**系统自带的「终端」应用。你需要安装：

| 名称 | 作用 | 如何安装 |
|------|------|----------|
| **Termux** | 平板上的终端，输入 `npm start` 等命令 | [F-Droid 上的 Termux](https://f-droid.org/zh_Hans/packages/com.termux/) |

安装后：

1. 在应用抽屉里找到 **Termux**（黑色图标）
2. 点开 → 黑底绿字界面 = 这就是「终端」
3. 输入命令的地方就是闪动的光标那一行，末尾通常有 `$`

```
┌─────────────────────────────┐
│  Termux                     │
│  ~/Points-of-mess $ _       │  ← 在这里打字，回车执行
│                             │
│  [平板软键盘]               │
└─────────────────────────────┘
```

**不要**在「文件管理器」里找终端；**不要**在 Chrome 地址栏输入 `sh pad-start.sh`（那是网页地址栏，不是终端）。

---

## 二、命令怎么输入？

1. 用手指点一下 Termux 黑色区域，弹出键盘
2. **长按粘贴**：从教程复制的命令，在 Termux 里长按 → 粘贴
3. 点键盘 **回车**（Enter 或 ↵）执行
4. 等上一行命令跑完，再输入下一行（不要一次粘太多行除非你知道在做什么）

Termux 特殊键：

- **CTRL**：屏幕上方工具栏里的 `CTRL`，先点它再点 `C` = 停止正在运行的程序
- **TAB**：可补全文件名
- 上下箭头：历史命令（部分键盘支持）

---

## 三、完整流程（第一次）

### 3.1 允许访问存储

```bash
termux-setup-storage
```

允许权限后，Termux 可通过 `~/storage/shared/` 访问「内部存储」里的下载、文档等。

### 3.2 进入项目目录

假设你把项目解压到了 **下载/Download/Points-of-mess**：

```bash
cd ~/storage/shared/Download/Points-of-mess
pwd
ls
```

- `pwd` 应显示当前路径含 `Points-of-mess`
- `ls` 应列出 `pad-start.sh`、`server.js`、`index.html`

**路径对照表（常见）：**

| 你在文件管理器里看到的位置 | Termux 里 cd 的路径 |
|---------------------------|---------------------|
| 内部存储/Download/Points-of-mess | `~/storage/shared/Download/Points-of-mess` |
| 内部存储/Documents/Points-of-mess | `~/storage/shared/Documents/Points-of-mess` |
| SD 卡 | `~/storage/shared/` 下对应目录 |

查找项目：

```bash
find ~/storage/shared -maxdepth 4 -type d -name "Points-of-mess" 2>/dev/null
```

### 3.3 安装 Node.js（一次性）

```bash
pkg update -y && pkg install -y nodejs git
node -v
npm -v
```

两条都应输出版本号。

### 3.4 配置 `.env`

```bash
cp -n .env.example .env
nano .env
```

把 `your_deepseek_api_key_here` 换成你的密钥，保存退出 nano：

- Termux 常见：保存 **Ctrl+O** 然后回车，退出 **Ctrl+X**（均先点工具栏 **CTRL**）

### 3.5 启动

```bash
sh pad-start.sh
```

成功标志：

```text
Chat server listening on 0.0.0.0:3000
  → http://localhost:3000
```

### 3.6 浏览器打开

用 **Chrome** 访问：

```text
http://127.0.0.1:3000
```

不要用 `https://`，不要选「文件」里的 html。

---

## 四、每次开发测试（重复流程）

```bash
# 1. 打开 Termux
cd ~/storage/shared/Download/Points-of-mess   # 路径按你的实际修改
sh pad-start.sh

# 2. 切到 Chrome 打开 http://127.0.0.1:3000
# 3. 改代码用「MT 管理器」「Acode」「QuickEdit」等打开项目文件夹编辑
# 4. 改完保存 → Chrome 下拉刷新；若改了 server.js → Termux Ctrl+C 后重新 sh pad-start.sh
```

开发模式（改代码自动重启服务，可选）：

```bash
npm run dev
```

---

## 五、用哪款 App 改代码？

| App | 说明 |
|-----|------|
| **Acode** | 免费代码编辑器，可打开整个文件夹 |
| **MT 管理器** | 可编辑文本文件 |
| **QuickEdit** | 轻量文本编辑 |

在编辑器里打开 **整个 `Points-of-mess` 文件夹**，不要只打开一个 html。

---

## 六、报错怎么办？

### `Permission denied`

```bash
chmod +x pad-start.sh
sh pad-start.sh
```

### `npm: command not found` 或 `node: command not found`

说明 Node 没装好，重新执行：

```bash
pkg install -y nodejs
```

### `EACCES` / 网络超时

检查 Wi‑Fi；换网络后 `npm install` 再试。

### 浏览器「无法连接」

1. Termux 是否还在运行且没有报错？
2. 服务是否被系统杀掉？设置 → 应用 → Termux → 电池 → **无限制**
3. 地址是否为 `http://127.0.0.1:3000`（本机，不是电脑的 IP）

### 想用电脑跑、平板只当浏览器

在**电脑**上 `npm start`，记下电脑 IP，平板 Chrome 打开 `http://电脑IP:3000`（需同一 Wi‑Fi）。见 README「局域网」章节。

---

## 七、一键命令清单（复制用）

**首次（在项目目录内逐段执行）：**

```bash
termux-setup-storage
cd ~/storage/shared/Download/Points-of-mess
pkg update -y && pkg install -y nodejs git
cp .env.example .env
nano .env
sh pad-start.sh
```

**以后每次：**

```bash
cd ~/storage/shared/Download/Points-of-mess
sh pad-start.sh
```

然后在 Chrome 打开：`http://127.0.0.1:3000`
