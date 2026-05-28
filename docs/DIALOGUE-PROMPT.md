# 对峙对话 Prompt 体系（v0.5.37）

> 目标：玩家用 **推进（keypoint）** 亮牌换情报，能稳定逼近【本局目标】；**询问（followup）** 只作旁敲，不替代交换。

## 1. 为何会兜圈子（v0.5.36 日志归纳）

| 现象 | 根因 |
|------|------|
| 锋利「心里清楚」「去问陈四」 | 模型默认对峙模板；无硬拒 + 无兜底供述 |
| 玩家连点 followup | followup 不强制交换；摘要却把「互相猜疑」写进 [已确认] |
| keypoint 一直是「陈四…」 | 陈四已确认后仍重复同一 offer；程序未切下一筹码 |
| [已确认] 膨胀 | 摘要 prompt 未限条数、未禁「态度复述」当事实 |
| 待核实#1 永在 | 锋利未供述指使者；交换契约未写入 reply prompt |

## 2. 三层结构（3 推 1）

```
【本局目标】  唯一终局问句
【剧情档案】  3+ 条 [已确认] 前提 → 推导 → 1 条 [待核实#1]
【关系与态度】 最多 2 条短句（非事实库）
```

- **结局**：`[待核实#1]` 清空 + 双轨关键词 + 核心词 → 才进结局轮。
- **推进**：每轮 keypoint 应尽量让 #1 收窄或删除。

## 3. 三次 API 分工

| 步骤 | 职责 | 核心约束 |
|------|------|----------|
| ① reply | 锋利台词 | 只答不问；keypoint 须**交换兑现**；拒敷衍 |
| ② options | 玩家下一句 | keypoint 用未消耗 offer；followup 不碰核心 |
| ③ 摘要 | 档案维护 | ≤8 条 [已确认]；≤2 条关系；1 条 #1 |

摘录进 ① 的块：`compactPlotSummary` + `formatReplyHint`（含 **【交换·本回合】**）。

## 4. 交换契约（核心）

**当且仅当** `intent=keypoint` 且玩家亮牌（`playerConcreteReveal`）：

1. 玩家出价：【玩家可亮牌】中的 `offerLine`（陈四 / 刘老三…）
2. 锋利须兑现：**一条**可核对新事实  
   - 指使者 **2～4 字姓名**，或  
   - 账本 **现下落**（地点/经手人）
3. **禁止**：心里清楚、去问陈四、问太多可疑、随你、不护谁…

未兑现 → `filterCharacterReply` 拒收 → `pickProgramSharpReply` 兜底（预设 `sharpReveals`）。

## 5. 程序侧（不依赖模型自觉）

| 机制 | 文件 | 行为 |
|------|------|------|
| 拒问句 | `options-ai.js` | `isCharacterReplyQuestion` |
| 拒敷衍 | `onion.js` | `isDeflectReply` |
| 兜底供述 | `presets.sharpReveals` | 亮牌后仍空话 → 老九线 |
| keypoint 纠偏 | `pickKeypointOfferLine` | 优先未消耗 offer；否则逼主使 |
| 僵局 | `stallTurns≥2` | 强制未用 offer + 兜底供述 |
| followup 连点 | `countRecentFollowupStreak` | ≥2 时提示改走 keypoint |

## 6. Prompt 清单（维护时改这些）

| 位置 | 用途 |
|------|------|
| `presets.js` → `SHARP_SYSTEM` | 角色底色 + 交换 + 禁敷衍 |
| `onion.js` → `formatReplyHint` | 每轮 ① 动态规则 |
| `onion.js` → `formatOptionsBlock` | ② 态势 + 建议 keypoint 句 |
| `options-ai.js` → `buildOptionsSystemDuo` | ② 静态分工 |
| `summary.js` → `SUMMARY_SYSTEM` | ③ 档案格式与上限 |
| `presets.onionSeed` | 种子 3+1、亮牌池、兜底供述 |

## 7. 玩家操作指引（产品文案可引用）

1. **想推进目标**：点「推进」，用带专名的交换句（不要空喊「指使者是谁」）。
2. **想摸态度**：点「询问」，锋利可不送新料，但不应空话循环。
3. **卡关**：连续两轮推进无新 [已确认] → 程序会逼锋利供述或切换下一筹码句。

## 8. 验收

```bash
node scripts/verify-character-no-question.js
node scripts/verify-ending-ready.js
node scripts/verify-goal-driven.js
# 新局：keypoint 亮陈四 → 锋利须含「老九」或走兜底；[待核实#1]  eventually 清除
```

## 9. v0.5.39（节奏：两轮推进再结局）

- 不在玩家选选项时跳过 reply；**本轮回合 ①②③ 完成后**再判结局
- `endingMinKeypointTurns: 2` + `endingSpendAllKnowledge: true`
- keypoint 每轮只兑现**一条**新事实
- 结局台词：`刘老三？` 类改逗号兜底，避免「无法解析结局」

## 10. v0.5.38 补丁（赵爷已供仍卡 #1）

- `reconcilePlotSummary`：档案已写明指使者姓名 → **程序删除** `[待核实#1]`，禁止「是否赵爷」元问题
- `goalTracks` 增加 **赵爷**；兜底供述与种子一致
- 敷衍拒收后 **followup 也有陈述兜底**，避免主路径报错
- 锋利台词出现新指使者名 → 重置僵局计数

*版本以 `js/version.js` 为准。*
