# 计划：目标驱动选项（keypoint / followup 重构）

> 状态：**v0.5.32**（prompt 去「洋葱」、亮牌兑现、摘要待核实≤2）· v0.5.31 起 `playerKnowledge` + 双轨结局  
> 前置：v0.5.30 交易先亮牌、每轮摘要、回避#1 强制结束

---

## 1. 问题（为何又死锁）

| 现象 | 根因 |
|------|------|
| 一直点「推进」问账本，#1 警号/失败 | **双 pending 并行**，回避只盯 #1，但选项允许只推 #2 |
| 双方「若我说…你就…」 | 玩家**没有可消耗的事实库**，选项全是向锋利索取 |
| 对白里已有陈四/老九，档案不动 | 摘要滞后；`stallTurns` 涨 → 体感卡死 |
| 深挖/推进文案同质 | intent 绑 #1/#2 **问法**，不是**行动类型** |

**结论**：在「唯一目标」下，选项应是**会改变目标状态的玩家行动**，而不是两条不同角度的逼问。

---

## 2. 设计原则

1. **一个本局目标**（已有 `【本局目标】`）
2. **子轨 goalTracks**（指使链 / 账本链）——结局看两条轨是否都有 `[已确认]` 依据，**不要求** `[待核实]` 全删
3. **玩家已知事实 `playerKnowledge`**——可亮牌、可消耗，消灭空头交易
4. **intent 语义重绑**（UI 可仍叫 keypoint/followup）：
   - **keypoint → 亮牌**：陈述玩家已知事实 / 确认锋利上一句 / 带具体信息的交换
   - **followup → 施压**：限时、逼供、换角度；**不**附带空头「若我说…」
5. **僵局兜底**：`stallTurns ≥ 2` 时，keypoint 由程序填入下一条未用的 `offerLine`

---

## 3. 数据（preset / session）

### 3.1 `onionSeed.playerKnowledge`

```js
playerKnowledge: [
  {
    id: "blocker",
    match: "陈四",
    text: "阻拦者名叫陈四（玩家亲眼所见）",
    offerLine: "阻拦的是陈四，换你说他背后是谁",
  },
  {
    id: "ledger",
    match: "刘老三",
    text: "账本最后经手人是刘老三",
    offerLine: "账本在刘老三手里，换你说指使者是谁",
  },
],
goalTracks: {
  mastermind: { keywords: ["指使", "幕后", "老九", "主使", "陈四"] },
  ledger: { keywords: ["账本", "刘老三", "经手", "保管"] },
},
```

### 3.2 session

- `spentPlayerKnowledge: string[]` — 已消耗的 `id`
- 开局 `startTalking` / `resetSessionProgressFlags` 时清空

---

## 4. 程序行为（v0.5.31）

| 模块 | 行为 |
|------|------|
| `GameOnion.pickProgramRevealLine` | 取下一条未用 `offerLine` |
| `GameOnion.markKnowledgeSpent` | 玩家台词含 `match` 时标记消耗 |
| `GameOnion.isReadyForEnding` | **须无 [待核实]**（3 推 1）；且 `goalTracks` 双轨齐备 + `endingCoreKeywords` + `endingMinConfirmed` |
| `bumpNeglectBeforeReply` | 若 `goalTracks`：仅推账本线 / 亮牌**不**累加回避 #1 |
| `formatOptionsBlock` | 写明亮牌/施压分工 + 可用 `playerKnowledge` 列表 |
| `generateOptions` 后 | `applyGoalDrivenOptions`：僵局或空头 keypoint → 替换为程序亮牌句 |

---

## 5. 未做（下一迭代）

- [ ] **单轨 pending**：#2 仅在 #1 收窄后出现（减少并行卡死）
- [ ] **第三对话钮 `confirm`**：「所以你承认老九是指使者？」
- [ ] **第二 NPC**（刘老三）— 切换信息源，同一 `goal`
- [ ] **storyState / needFromPlayer** 显式字段进 session（现用 goalTracks 隐式推断）

---

## 6. 验收

1. 首轮可见一条含「陈四」的亮牌向选项（预设或第二轮起程序注入）
2. 连续只问账本不应触发回避失败（v0.5.31 `goalTracks`）
3. `[已确认]` 同时含指使链与账本链关键词时可进结局（待核实可残留）
4. `stall ≥ 2` 时 keypoint 变为 `offerLine` 之一

```bash
node scripts/verify-goal-driven.js
node scripts/verify-ending-ready.js
node scripts/verify-trade-onion.js
```

---

## 7. 选项数量

**维持 2 对话 + 挂起**。防死锁靠**行动分型 + 玩家 knowledge 池**，不靠加到 4～5 个按钮。

## 8. v0.5.32（prompt 大修）

- API 约束块改称【本局态势】【本局规则·本轮】，**不出现「洋葱」**
- `isPlayerLineConcrete`：预设亮牌「阻拦的是陈四…」不再误报空头
- 玩家已亮牌 → reply 必须**兑现交换**，禁「你心里清楚」
- 锋利已点名指使者 → 选项程序注入「XX就是指使者，账本在哪？」
- 摘要：待核实最多 2 条；禁止用更空泛问题替换已得到姓名的待核实

## 9. v0.5.33（推进 / 询问分工）

- **keypoint = 推进**：唯一推动本局目标；须亮牌或确认专名
- **followup = 询问**：来意/态度/关系；**禁止**指使者、账本、互怼
- 询问轮：不累加回避#1、不累加僵局；reply 走【旁询】规则
- 选项程序校正：followup 若写成逼供 → 替换为 `inquireLines` 池
- `detectPlayerNamesMastermind`：问句不再误触发

## 10. v0.5.34（3 推 1 · prompt 简化）

- 种子摘要：**1 目标 + 3 [已确认] + 1 [待核实#1]**（论证题式）
- 摘要 prompt：待核实至多 1 条；示例专名用字母 A/B/X；不输出【本局目标】
- 压摘要后程序 **preserveGoalBlock** 保留目标段
- API 约束块示例去真实人名（玩法仍用预设专名）

## 11. v0.5.35（修复开局误进结局）

- `isReadyForEnding`：**有待核实#1 一律不结局**（goalTracks 不再绕过）
- `goalTracks` 去掉陈四/刘老三（玩家筹码≠锋利供述）
- `extractGoal` 只读 `-` 条，不再把「（唯一，仅此一条）」拼进 API

## 12. v0.5.37（交换契约 · 反兜圈）

- 详见 `docs/DIALOGUE-PROMPT.md`
- 交换：`formatExchangeContract` + `sharpReveals` 程序兜底
- 拒敷衍：`isDeflectReply`；keypoint 纠偏：`pickKeypointOfferLine`
- 摘要：[已确认]≤8，关系≤2 条

*最后更新：2026-05 · v0.5.37*
