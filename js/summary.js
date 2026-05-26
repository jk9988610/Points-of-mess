(function () {
  const SUMMARY_EVERY_OPTION_TURNS = 4;
  /** 摘要总字数上限（产品：尽量写满，专名只增不删） */
  const SUMMARY_MAX_CHARS = 1200;

  const SUMMARY_SYSTEM = `你是剧情摘要压缩助手。根据「已有摘要」与「新增对话」，输出更新后的结构化摘要。

【输出格式】严格两段（每段用 - 列表，一行一事）：
【剧情档案】
- [已确认] …
- [待核实] …
（极少需要时）[已推翻] …

【关系与态度】
- …

【规则】
1. 在已有摘要基础上递进更新；禁止整体变短；禁止删除已有 [已确认] 行中的专名（人名、地点、物证）。
2. [待核实] 必须具体、可回答；禁止「是否会…」类元问题。
3. 新增对话中已明确回答的 [待核实]：从待办中删除，或将要点写入 [已确认]；部分回答则改写为更细的 [待核实]。
4. 新事实用 [已确认] 追加；不要单独写「本轮新增」段。
5. 全文不超过 ${SUMMARY_MAX_CHARS} 字；优先合并 [待核实] 条数，不删 [已确认] 专名。
6. 只输出摘要正文，不要 markdown 代码块或其它说明。

【示例】
【剧情档案】
- [已确认] 监控显示林晨凌晨三点离开厂区东门
- [待核实] 蓝色账本完整下落
【关系与态度】
- 锋利对玩家施压，回避直接点名`;

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
        "缺少【剧情档案】段（A+）；摘录将走旧格式回退"
      );
    }
  }

  async function maybeRefreshPlotSummary(session, signal) {
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

    const done = window.GameDialogue.getDoneMessages(session.messages);
    const keepRecent = window.GameDialogue.HISTORY_TURNS * 2;
    const toSummarize = done.slice(0, Math.max(0, done.length - keepRecent));
    if (toSummarize.length === 0) {
      return false;
    }

    const block = toSummarize
      .map((m) => `${m.role === "assistant" ? "锋利" : "玩家"}: ${m.content}`)
      .join("\n");
    const userContent = session.plotSummary
      ? `【已有摘要】\n${session.plotSummary}\n\n【新增对话】\n${block}`
      : `【新增对话】\n${block}`;

    window.PomDebug?.logLocal(
      "压缩剧情摘要（A+）",
      `第 ${optionTurns} 轮选项后，压缩 ${toSummarize.length} 条对白（上限 ${SUMMARY_MAX_CHARS} 字）`
    );

    const summary = await window.ChatApi.completeChat({
      systemPrompt: SUMMARY_SYSTEM,
      messages: [{ role: "user", content: userContent }],
      temperature: 0.3,
      max_tokens: window.PomTokens?.SUMMARY ?? 2048,
      signal,
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
      "剧情摘要已更新（A+）",
      `${session.plotSummary.length} 字\n${session.plotSummary}`
    );
    return true;
  }

  window.GameSummary = {
    SUMMARY_EVERY_OPTION_TURNS,
    SUMMARY_MAX_CHARS,
    maybeRefreshPlotSummary,
  };
})();
