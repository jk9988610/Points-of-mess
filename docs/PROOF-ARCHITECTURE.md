# 证明题论证架构（v0.5.49）

本文描述「证官·理证」对论游戏的**程序 + AI** 分工，以及选项如何驱动证明进程。

## 1. 分层结构

```
┌─────────────────────────────────────────────────────────┐
│  玩家 UI：4 钮（推证 A / 推证 B / 题意 / 证法）          │
└───────────────────────────┬─────────────────────────────┘
                            │ pickOption
┌───────────────────────────▼─────────────────────────────┐
│  app.js：回合编排 · 摘要触发 · 结局/换题                   │
└─────┬───────────────┬───────────────┬───────────────────┘
      │               │               │
      ▼               ▼               ▼
 options-ai.js   summary.js     proof-bootstrap.js
 ① reply         ③ 证明席压缩    开局 AI 生成
 ② 四轮选项
      │               │
      └───────┬───────┘
              ▼
         onion.js（证明席格式 · 摘录 · 规则注入 · 结局门）
              │
              ▼
         proof-pool.js（数学家 + 题目蓝本随机池）
```

**原则**：论题 G、前提 P、引理 L、推导步 S 的**真值**以 `session.plotSummary`（证明席）为准；AI 只负责自然语言表述，程序负责格式归一与规则约束。

## 2. 证明席档案（plotSummary）

| 标记 | 含义 |
|------|------|
| `【论证目标】` | 论题 G（程序保留，摘要模型不覆盖） |
| `[前提] Pk` | 开局给定前提 |
| `[待证#k] Lk` | 开放引理 |
| `[依赖] 若要证 A，则需证 B` | **命题间**推导依赖（A/B 为 G 或 L 编号，不写引理全文） |
| `[已证] Sk` | 对局内确立的推导步 |
| `[证毕#k] Lk` | 引理得证；对应 `[待证#k]` 与 `[依赖]` 行删除 |

**禁止** `【关系与态度】`：程序 `normalizeProofArchive` 会剥离；摘要/开局 prompt 亦禁止模型输出。

## 3. 选项模型（三推证辨伪）

每轮 **3 条**，均为推证口吻：

| intent | 数量 | 作用 |
|--------|------|------|
| `advance` | 1 | **正确**推证，推进当前 Lk |
| `decoy` | 2 | **误推**，似真但不可推进 Lk |

`attachOptionIds` **随机排列**三钮位置。

## 4. 单回合 API 流水线

1. **① reply**（`options-ai.requestReplyOnly`）  
   - 注入 `formatReplyHint`：按 intent 约束证官须兑现推导步或纠错  
   - 注入 `compactPlotSummaryForApi` 摘录，禁止重复追问已写入事实  

2. **② options**（`generateOptions`）  
   - AI 生成 advance/decoy/clarify/explore 四句 JSON  
   - 校验 → 随机 A/B → 渲染按钮  

3. **③ summary**（每 N 轮，`summary.maybeRefreshPlotSummary`）  
   - 书记员模型把新对白写入 `[已证]` / `[证毕]`  
   - `reconcilePlotSummary` 裁剪超长、删空待证  

## 5. 开局与换题

1. `proof-pool.createTopicBlueprint()` 从池抽取数学家 + 题目蓝本（`topicHint`）  
2. `proof-bootstrap.bootstrapProofSession` 一次 AI 调用生成 `opening` + `plotSummary` + 首轮 4 选项  
3. `buildSeedFromSummary` 从摘要提取 G，写入 `onionSeed`（`aiDriven: true`）  

**证毕或失败后**：`finishEpisodeAfterClose/Failure` 清空会话 → `initSession` 重新抽池 → 自动 `startTalking` 发起新 bootstrap（玩家仍在橙圈内时无需再点证官）。

## 6. 结局门（程序判定，非 AI）

`GameOnion.isReadyForEnding` 需同时满足：

- 开放引理为空（`isArgumentClosed`）  
- `[已证]` + `[前提]` 条数 ≥ `minPremisesForEnding`  
- `keypointTurnCount` ≥ `endingMinKeypointTurns`（默认 2，**仅正确 advance 计数**）  

达成后：`requestEndingSequence` → 证官宣布证毕 → 2 条 close 离场白 → 自动换题。

## 7. 文件索引

| 文件 | 职责 |
|------|------|
| `js/proof-pool.js` | 数学家/题目池、`createTopicBlueprint` |
| `js/proof-bootstrap.js` | AI 开局 JSON |
| `js/proof-intents.js` | 四 intent 校验、A/B 洗牌 |
| `js/onion.js` | 证明席解析、API 摘录、reply/选项规则块 |
| `js/summary.js` | ③ 摘要 prompt（仅【证明席】） |
| `js/options-ai.js` | ①② 生成、结局/失败台词 |
| `js/app.js` | 会话生命周期、自动换题 |
