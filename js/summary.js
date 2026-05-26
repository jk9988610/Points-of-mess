(function () {
  const SUMMARY_EVERY_OPTION_TURNS = 4;
  /** 摘要总字数上限（产品：尽量写满，专名只增不删） */
  const SUMMARY_MAX_CHARS = 1200;

  const SUMMARY_SYSTEM = `你是剧情档案员。把对话合并为中文剧情摘要，供后续 AI 记住已揭露事实。

【输入】可能含「已有摘要」与「新增对话」。必须在已有摘要基础上递进合并，禁止重写变短，禁止删除旧专名。

【输出结构】严格使用以下四段标题（每段可多行）：
【已确认事实】人名、地点、物证、时间线、已说定的因果关系；只增不删。
【未解问题】玩家仍未得到答案的疑问。
【关系与态度】角色与玩家之间的张力；无新变化可写「暂无变化」。
【本轮新增】本段「新增对话」中的新信息；若无则写「无」。

【篇幅】全文不超过 ${SUMMARY_MAX_CHARS} 字；在限制内尽量写全、用尽篇幅，不要压成几句笼统话。
【禁止】删掉【已确认事实】里已出现的人名/地点/物证；不要用 markdown 代码块。
只输出摘要正文，不要其它说明。`;

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
      : `【新增对话】\n${block}`;

    window.PomDebug?.logLocal(
      "压缩剧情摘要",
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

    session.plotSummary = text;
    session.lastSummaryAtOptionTurn = optionTurns;
    window.PomDebug?.logLocal(
      "剧情摘要已更新",
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
