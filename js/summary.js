(function () {
  /** 每轮选项后压摘要，避免锋利新事实长期不进 [已确认] */
  const SUMMARY_EVERY_OPTION_TURNS = 1;
  /** 压缩时保留最近若干条对白不进入「待压缩区」（与 API messages 是否全量无关） */
  const SUMMARY_PROTECT_MESSAGES = 4;
  /** 摘要总字数上限（产品：尽量写满，专名只增不删） */
  const SUMMARY_MAX_CHARS = 1200;

  const SUMMARY_SYSTEM = `你是剧情档案维护员。根据「已有摘要」与「新增对话」更新档案，服务**单一本局目标**。

【输出格式】仅两段：
【剧情档案】
- [已确认] …
- [待核实] …（全篇最多 **2 条**）
【关系与态度】
- …

【硬性规则】
1. 递进更新；[已确认] 专名只增不删；全文 ≤ ${SUMMARY_MAX_CHARS} 字。只输出摘要，无 markdown。
2. 锋利台词中已明确的人名、指使者、账本去向/经手人 → 必须写入 [已确认]（可标「锋利供述：」），并**删掉或收窄**已被回答的 [待核实]。
3. 玩家亮牌/供述 → [已确认] 玩家供述：…
4. **禁止**用更空泛的问题替换已得到姓名的待核实（例：已确认「指使者是赵家老二」后，勿把待核实改成「赵家老二身份及动机」；应收窄为「账本现下落」等仍缺的事实）。
5. [待核实] 最多保留 2 条，且必须是 [已确认] 中仍无法回答的问题。
6. 仅依据已有摘要与新增对话，禁止幻觉。`;

  const SUMMARY_USER_PREFIX = `自检：锋利/玩家已说清的人名与去向须进 [已确认]；已解答的待核实须删或收窄；待核实≤2条。只输出两段摘要。

`;

  function countOptionTurns(sessionMessages) {
    return sessionMessages.filter(
      (m) => m.role === "user" && m.intent && m.intent !== "freeform"
    ).length;
  }

  function warnIfSummaryFormatUnexpected(text) {
    const body = String(text || "").trim();
    if (!body) {
      return;
    }
    if (!body.includes("【剧情档案】")) {
      window.PomDebug?.logLocalWarn(
        "摘要格式",
        "缺少【剧情档案】段（A+）；摘录将走旧格式回退",
        ["summary"]
      );
    }
  }

  function summarySkipReason(session) {
    const optionTurns = countOptionTurns(session.messages);
    if (optionTurns < SUMMARY_EVERY_OPTION_TURNS) {
      return `未满 ${SUMMARY_EVERY_OPTION_TURNS} 轮选项（当前 ${optionTurns}）`;
    }
    if (optionTurns % SUMMARY_EVERY_OPTION_TURNS !== 0) {
      return `非压缩轮（每 ${SUMMARY_EVERY_OPTION_TURNS} 轮一次）`;
    }
    if (session.lastSummaryAtOptionTurn === optionTurns) {
      return `第 ${optionTurns} 轮已压过摘要`;
    }
    const last = session.messages[session.messages.length - 1];
    if (!last || last.role !== "assistant" || last.status === "error") {
      return "锋利回复尚未写入 session（须在 ①② 之后压摘要）";
    }
    const { toSummarize } = buildSummaryPayload(session);
    if (toSummarize.length === 0) {
      return "无可压缩对白";
    }
    return "";
  }

  /** 本局本轮是否会压摘要（仅看选项轮次；执行在 ①② 与 assistant 写入之后） */
  function willRefreshPlotSummaryThisPick(session) {
    const optionTurns = countOptionTurns(session.messages);
    if (optionTurns < SUMMARY_EVERY_OPTION_TURNS) {
      return false;
    }
    if (optionTurns % SUMMARY_EVERY_OPTION_TURNS !== 0) {
      return false;
    }
    return session.lastSummaryAtOptionTurn !== optionTurns;
  }

  function shouldRefreshPlotSummary(session) {
    return !summarySkipReason(session);
  }

  function buildSummaryPayload(session) {
    const optionTurns = countOptionTurns(session.messages);
    const done = window.GameDialogue.getDoneMessages(session.messages);
    const keepRecent = SUMMARY_PROTECT_MESSAGES;
    let toSummarize = done.slice(0, Math.max(0, done.length - keepRecent));
    let mergedProtected = 0;

    const protectedTail = done.slice(Math.max(0, done.length - keepRecent));
    if (
      protectedTail.length > 0 &&
      protectedTail[protectedTail.length - 1]?.role === "assistant"
    ) {
      toSummarize = [...toSummarize, ...protectedTail];
      mergedProtected = protectedTail.length;
    }

    return { optionTurns, toSummarize, mergedProtected, keepRecent };
  }

  async function maybeRefreshPlotSummary(session, signal) {
    const skip = summarySkipReason(session);
    if (skip) {
      window.PomDebug?.logLocal("摘要未执行", skip, ["summary-skip"]);
      return false;
    }

    const { optionTurns, toSummarize, mergedProtected, keepRecent } =
      buildSummaryPayload(session);

    const block = toSummarize
      .map((m) => `${m.role === "assistant" ? "锋利" : "玩家"}: ${m.content}`)
      .join("\n");
    const body = session.plotSummary
      ? `【已有摘要】\n${session.plotSummary}\n\n【新增对话】\n${block}`
      : `【新增对话】\n${block}`;
    const userContent = SUMMARY_USER_PREFIX + body;

    const scopeNote =
      mergedProtected > 0
        ? ` · 保护区 ${mergedProtected} 条`
        : "";
    window.PomDebug?.logLocal(
      "③摘要 · 即将请求",
      `第 ${optionTurns} 轮 · ${toSummarize.length} 条对白入模${scopeNote} · 全文见黄条 →拆分·③摘要`,
      ["summary"]
    );

    const summary = await window.ChatApi.completeChat({
      systemPrompt: SUMMARY_SYSTEM,
      messages: [{ role: "user", content: userContent }],
      temperature: window.PomTokens?.TEMP_SUMMARY ?? 0.2,
      max_tokens: window.PomTokens?.SUMMARY ?? 2048,
      signal,
      debugLabel: "拆分·③摘要",
    });

    let text = String(summary || "").trim();
    if (text.length > SUMMARY_MAX_CHARS) {
      window.PomDebug?.logLocalWarn(
        "摘要超长已截断",
        `${text.length} 字 → ${SUMMARY_MAX_CHARS} 字`,
        ["summary"]
      );
      text = text.slice(0, SUMMARY_MAX_CHARS);
    }

    warnIfSummaryFormatUnexpected(text);

    session.plotSummary = text;
    session.lastSummaryAtOptionTurn = optionTurns;
    const onionNote = window.GameOnion?.formatLayersDebug?.(text) || "";
    window.PomDebug?.logLocal(
      "③摘要 · 已写入 session",
      `${text.length} 字 · ${onionNote} · 正文见绿条 ←拆分·③摘要`,
      ["summary-out"]
    );
    return true;
  }

  window.GameSummary = {
    SUMMARY_EVERY_OPTION_TURNS,
    SUMMARY_MAX_CHARS,
    shouldRefreshPlotSummary,
    willRefreshPlotSummaryThisPick,
    maybeRefreshPlotSummary,
  };
})();
