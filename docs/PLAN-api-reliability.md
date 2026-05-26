# 计划：对话 API 稳定性（Plan 模式文档）

> 写法对照 Cursor **Plan 模式**：先对齐问题与目标，再列方案与阶段，最后验收。实现时按阶段勾选，避免边做边改方向。

---

## 1. 背景（Context）

- 产品：Points-of-mess v0，地图 + 四选项 + DeepSeek 流式/非流式。
- 现象（用户调试日志）：
  - `API 返回为空`
  - `未找到 JSON 对象`（模型返回纯中文，无 `{...}`）
  - 兜底后「回复无效，沿用上一句」→ 气泡重复、体验断裂
- **不是** Chrome 缓存问题（已 v0.3.6）；**不是**温度过高为主因（空返回 / 非 JSON 更常见）。

---

## 2. 目标（Goals）

| 必须 | 说明 |
|------|------|
| G1 | 每轮点选项后，**尽量**得到新 reply + 4 条新 options |
| G2 | **尽量不截断**模型输出（提高 `max_tokens`，输出仍由 prompt 限制字数） |
| G3 | JSON 失败时 **不** 用「……」或重复上一句糊弄；走可读兜底 |
| G4 | 调试面板能区分：合并成功 / 拆分 / 纯文本回复 |

## 3. 非目标（Non-goals）

- 不改「最近 2 轮 messages」窗口（成本可控，另案）。
- 不做服务端代理（仍浏览器直连 DeepSeek）。
- 不保证 100% 不失败（依赖模型与网络）。

---

## 4. 根因假设（按优先级）

1. **合并任务过重**：一条请求同时要 `reply` + 4×`options` 的 JSON，易格式错误或空包。
2. **`json_object` / 纯文本混用**：有时返回无 `{}` 的短句 → `extractJsonObject` 失败。
3. **`max_tokens` 过小**：JSON 写到一半被 `finish_reason=length` 截断（需日志确认）。
4. **兜底链路过严**：`requestReplyOnly` 仍强制 JSON → 拆分路径也失败。

---

## 5. 方案对比（Options）

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| A | 仅提高 `max_tokens` | 改动小 | 不解决非 JSON 返回 |
| B | 合并失败 → 拆分（先 reply 再 options） | 已成功过（日志） | 多 1 次 API，成本略高 |
| C | **默认拆分**，合并作优化 | 最稳 | 每轮固定 2 次请求 |
| D | 回复允许纯文本，选项仍 JSON | 贴合模型习惯 | 需改解析 |

**选定：A + B + D（v0.3.7）**  
提高 token 上限；拆分作自动兜底；`replyFromRaw` 接受无 JSON 的短句。

---

## 6. 实施阶段（Phases）

### Phase 1 — Token 预算（本次）

- [x] 新增 `js/tokens.js` 集中配置（合并 2048、选项 1024 等）。
- [x] `config.js` 默认 `maxTokens` 提高到 512。
- [ ] 部署后看调试是否仍出现 `finish_reason=length`。

### Phase 2 — 解析与兜底（本次）

- [x] `requestReplyOnly`：允许 **纯中文一句**，不强制 JSON。
- [x] `replyFromRaw`：无 `{` 时整段作 reply（去掉 80 字硬截断或放宽）。
- [x] 合并失败 → 自动拆分（已有，修复 reply 步）。

### Phase 3 — 可选优化（未做）

- [ ] 默认 `USE_SPLIT_FIRST` 开关（配置项）。
- [ ] 调试里打印 `finish_reason`、返回字数。
- [ ] 合并成功率高后再尝试降回 1 次请求。

---

## 7. 验收标准（Acceptance）

1. 连续点 5 轮选项，**至少 4 轮** 出现**新** reply 文本（非重复开场白）。
2. 调试中 `未找到 JSON 对象` **偶发可接受**；连续 3 轮则不合格。
3. 无 `API 返回为空` 连击（偶发 1 次可重试）。
4. `js/version.js` 与标题版本一致（当前目标 **v0.3.7**）。

---

## 8. 风险与成本（Risks）

| 风险 | 缓解 |
|------|------|
| `max_tokens` 增大 → 单轮更贵 | 仍限制 reply≤40 字；仅放大输出上限防截断 |
| 每轮 2 次 API（拆分） | 仅合并失败时触发 |
| 用户密钥泄露历史 | 继续登录门 + 文档提醒轮换 |

---

## 9. 相关文件

```
js/tokens.js      # max_tokens 常量
js/options-ai.js  # 合并 / 拆分 / 解析
js/api.js         # 空返回与 finish_reason
js/config.js
docs/PLAN-api-reliability.md  # 本文
```

---

*文档版本随实现更新；以 `js/version.js` 为准。*
