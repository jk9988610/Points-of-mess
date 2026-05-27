(function () {
  const SUMMARY_EVERY_OPTION_TURNS = 4;
  /** 摘要总字数上限（产品：尽量写满，专名只增不删） */
  const SUMMARY_MAX_CHARS = 1200;

  const SUMMARY_SYSTEM = `你是剧情摘要压缩助手。根据「已有摘要」与「新增对话」输出更新后的结构化摘要。

【输出格式】仅两段（- 列表，一行一事）：
【剧情档案】
- [已确认] …
- [待核实] …
（极少）[已推翻] …
【关系与态度】
- …

【核心规则】
0. 【本局目标】仅保留**一条**核心目标句，禁止拆成两个并列终局；子线写入 [待核实]。
1. 在已有摘要上递进更新；禁止整体变短；[已确认] 中的专名（人名、地点、物证）只增不删。
2. [待核实] 须**原子**、一事一问（可用 #1 #2a #2b）；禁止把位置/钥匙/接触捆成一条。玩家只答一部分时：已答写入 [已确认]，未答保留并收窄。
3. 全文 ≤ ${SUMMARY_MAX_CHARS} 字。只输出摘要正文，无 markdown、无说明。

【待核实 → 已确认】（最高优先级）
【新增对话】或玩家短句已明确回答某 [待核实]（是/否、职务、地点、人名、时间等）时：写入对应 [已确认]（陈述句），并删除或收窄该 [待核实]。**部分回答**：只删已答子项，其余改为更窄的 [待核实#…]。不得保留与 [已确认] 矛盾的 [待核实]。

【禁止幻觉】
仅依据「已有摘要」与「新增对话」；禁止训练记忆或示例专名。每条 [已确认] 须能在上述材料中找到依据。`;

  const SUMMARY_USER_PREFIX = `压缩前自检：已答 [待核实] 须迁入 [已确认]；[已确认] 专名须有依据。只输出两段摘要。

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
    const keepRecent = window.GameDialogue.HISTORY_TURNS * 2;
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
