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
1. 在已有摘要上递进更新；禁止整体变短；[已确认] 中的专名（人名、地点、物证）只增不删。
2. [待核实] 须具体可答；禁止「是否会…」类元问题。新事实用 [已确认] 追加。
3. 全文 ≤ ${SUMMARY_MAX_CHARS} 字。只输出摘要正文，无 markdown、无说明。

【待核实 → 已确认】（最高优先级）
【新增对话】或玩家短句已明确回答某 [待核实]（是/否、职务、地点、人名、时间等）时：写入对应 [已确认]（陈述句），并删除该 [待核实]。部分回答则收窄待办、已出现的线索写入 [已确认]。不得保留与 [已确认] 矛盾的 [待核实]。

【禁止幻觉】
仅依据「已有摘要」与「新增对话」；禁止训练记忆或示例专名。每条 [已确认] 须能在上述材料中找到依据。`;

  const SUMMARY_USER_PREFIX = `压缩前自检：已答 [待核实] 须迁入 [已确认]；[已确认] 专名须有依据。只输出两段摘要。

`;

  function countOptionTurns(sessionMessages) {
    return sessionMessages.filter(
      (m) => m.role === "user" && m.intent && m.intent !== "freeform"
    );
  }

  function warnIfSummaryFormatUnexpected(text) {
    const body = String(text || "").trim();
    if (!body) {
      return;
    }
    if (!body.includes("【剧情档案】")) {
      window.PomDebug?.logLocalWarn(
        "摘要格式",
        "缺少【剧情档案】段（A+）；摘录将走旧格式回退"
      );
    }
  }

  function shouldRefreshPlotSummary(session, opts = {}) {
    const optionTurns = countOptionTurns(session.messages);
    if (optionTurns < SUMMARY_EVERY_OPTION_TURNS) {
      return false;
    }
    if (optionTurns % SUMMARY_EVERY_OPTION_TURNS !== 0) {
      return false;
    }
    if (session.lastSummaryAtOptionTurn === optionTurns) {
      return false;
    }
    const { toSummarize } = buildSummaryPayload(session, opts);
    return toSummarize.length > 0;
  }

  function buildSummaryPayload(session, opts = {}) {
    const optionTurns = countOptionTurns(session.messages);
    let messages = session.messages;
    if (opts.afterReply && opts.assistantReply) {
      messages = [
        ...messages,
        {
          role: "assistant",
          content: String(opts.assistantReply).trim(),
          status: "done",
        },
      ];
    }
    const done = window.GameDialogue.getDoneMessages(messages);
    const keepRecent = window.GameDialogue.HISTORY_TURNS * 2;
    let toSummarize = done.slice(0, Math.max(0, done.length - keepRecent));
    let mergedProtected = 0;

    if (opts.afterReply) {
      const protectedTail = done.slice(Math.max(0, done.length - keepRecent));
      if (
        protectedTail.length > 0 &&
        protectedTail[protectedTail.length - 1]?.role === "assistant"
      ) {
        toSummarize = [...toSummarize, ...protectedTail];
        mergedProtected = protectedTail.length;
      }
    }

    return { optionTurns, toSummarize, mergedProtected, keepRecent };
  }

  async function maybeRefreshPlotSummary(session, signal, opts = {}) {
    if (!shouldRefreshPlotSummary(session, opts)) {
      return false;
    }

    const { optionTurns, toSummarize, mergedProtected, keepRecent } =
      buildSummaryPayload(session, opts);

    const block = toSummarize
      .map((m) => `${m.role === "assistant" ? "锋利" : "玩家"}: ${m.content}`)
      .join("\n");
    const body = session.plotSummary
      ? `【已有摘要】\n${session.plotSummary}\n\n【新增对话】\n${block}`
      : `【新增对话】\n${block}`;
    const userContent = SUMMARY_USER_PREFIX + body;

    const modeLabel = opts.afterReply
      ? "并行 · ① 完成后与 ②选项 同时"
      : "串行 · ①② 完成后";
    const scopeNote =
      mergedProtected > 0
        ? ` · 含短上下文保护区 ${mergedProtected} 条（本轮完整对白已齐）`
        : ` · 保护区外 ${toSummarize.length} 条`;
    window.PomDebug?.logLocal(
      "触发剧情摘要压缩",
      `${modeLabel} · 第 ${optionTurns} 轮选项 · ${toSummarize.length} 条对白入模 · 保留最近 ${keepRecent / 2} 轮供 API${scopeNote} · 上限 ${SUMMARY_MAX_CHARS} 字`
    );

    const summary = await window.ChatApi.completeChat({
      systemPrompt: SUMMARY_SYSTEM,
      messages: [{ role: "user", content: userContent }],
      temperature: window.PomTokens?.TEMP_SUMMARY ?? 0.2,
      max_tokens: window.PomTokens?.SUMMARY ?? 2048,
      signal,
      debugLabel: "压缩剧情摘要",
    });

    let text = String(summary || "").trim();
    if (text.length > SUMMARY_MAX_CHARS) {
      window.PomDebug?.logLocalWarn(
        "摘要超长已截断",
        `${text.length} 字 → ${SUMMARY_MAX_CHARS} 字`
      );
      text = text.slice(0, SUMMARY_MAX_CHARS);
    }

    warnIfSummaryFormatUnexpected(text);

    session.plotSummary = text;
    session.lastSummaryAtOptionTurn = optionTurns;
    window.PomDebug?.logLocal(
      "剧情摘要已写入 session",
      `${session.plotSummary.length} 字（下一轮起注入 reply/选项 system）`
    );
    return true;
  }

  window.GameSummary = {
    SUMMARY_EVERY_OPTION_TURNS,
    SUMMARY_MAX_CHARS,
    shouldRefreshPlotSummary,
    maybeRefreshPlotSummary,
  };
})();
