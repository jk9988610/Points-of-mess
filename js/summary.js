(function () {
  const SUMMARY_EVERY_OPTION_TURNS = 4;
  const SUMMARY_SYSTEM =
    "将对话压缩为不超过 80 字的中文摘要。保留人名、关键事实、未解决的问句。只输出摘要正文，不要 markdown。";

  function countOptionTurns(sessionMessages) {
    return sessionMessages.filter(
      (m) => m.role === "user" && m.intent && m.intent !== "freeform"
    ).length;
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
      : block;

    window.PomDebug?.logLocal("压缩剧情摘要", `第 ${optionTurns} 轮选项后，压缩 ${toSummarize.length} 条对白`);

    const summary = await window.ChatApi.completeChat({
      systemPrompt: SUMMARY_SYSTEM,
      messages: [{ role: "user", content: userContent }],
      temperature: 0.3,
      max_tokens: 120,
      signal,
    });

    session.plotSummary = String(summary || "").trim();
    session.lastSummaryAtOptionTurn = optionTurns;
    window.PomDebug?.logLocal("剧情摘要已更新", session.plotSummary);
    return true;
  }

  window.GameSummary = {
    SUMMARY_EVERY_OPTION_TURNS,
    maybeRefreshPlotSummary,
  };
})();
