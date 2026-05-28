(function () {
  /** 每轮选项后压摘要，避免锋利新事实长期不进 [已确认] */
  const SUMMARY_EVERY_OPTION_TURNS = 1;
  /** 压缩时保留最近若干条对白不进入「待压缩区」（与 API messages 是否全量无关） */
  const SUMMARY_PROTECT_MESSAGES = 4;
  /** 摘要总字数上限（产品：尽量写满，专名只增不删） */
  const SUMMARY_MAX_CHARS = 1200;

  function buildSummarySystem(seed) {
    const maxOpen = window.GameOnion?.getMaxOpenClaims?.(seed) ?? 1;
    const pendingLines =
      maxOpen === 1
        ? "- [待核实#1] …（全篇最多 1 条）"
        : Array.from(
            { length: maxOpen },
            (_, i) => `- [待核实#${i + 1}] …`
          ).join("\n") + `\n（全篇最多 ${maxOpen} 条）`;
    const skeleton =
      maxOpen === 1
        ? "三条件推一问"
        : `${maxOpen + 2} 条件推 ${maxOpen} 问`;
    return `你是剧情档案维护员。结构像论证题：**一个本局目标 + 已确认前提 + 开放论断**（${skeleton}；对局过程中 [已确认] 可增多，[待核实] 始终至多 ${maxOpen} 条）。

【输出】仅两段（不要输出【本局目标】，由程序保留）：
【剧情档案】
- [已确认] …
${pendingLines}
【关系与态度】
- …

【规则】
1. 递进更新；[已确认] 专名只增不删；全文 ≤ ${SUMMARY_MAX_CHARS} 字；无 markdown。
2. [已确认] 最多 8 条；合并同义；禁止「可能/存疑/意在掩护」等猜测写入 [已确认]。
3. 对话已说清的人名/去向 → [已确认]（可标「锋利供述：」）；玩家亮牌 → 仅写玩家原话中的可核对事实，勿写推断。
4. 已解答的 [待核实] 须删除；锋利称「唯一主使/没有别人」或已供指使者姓名 → **不得**保留「是否还有更高层」类待核实。
5. 仅旁询/态度、无新专名 → 勿增待核实；勿扩写关系段；禁止写「无」「待填」占待核实行。
6. 【关系与态度】最多 2 条，每条 ≤45 字，只写当前信任/戒备。
7. 只依据已有摘要与新增对话，禁止幻觉。`;
  }

  function buildSummaryUserPrefix(seed) {
    const maxOpen = window.GameOnion?.getMaxOpenClaims?.(seed) ?? 1;
    return `自检：说清的事实进 [已确认]；待核实至多 ${maxOpen} 条且已答必删/收窄。只输出【剧情档案】【关系与态度】两段。

`;
  }

  /** 压缩后保留种子里的【本局目标】段（模型不输出目标） */
  function preserveGoalBlock(previousSummary, newSummary) {
    const prev = String(previousSummary || "").trim();
    const next = String(newSummary || "").trim();
    if (!prev || !next) {
      return next || prev;
    }
    if (next.includes("【本局目标】")) {
      return next;
    }
    const goalBlock = prev.match(/【本局目标】[\s\S]*?(?=【|$)/)?.[0]?.trim();
    if (!goalBlock) {
      return next;
    }
    return `${goalBlock}\n\n${next}`.trim();
  }

  function countOptionTurns(sessionMessages) {
    return sessionMessages.filter(
      (m) => m.role === "user" && m.intent && m.intent !== "freeform"
    ).length;
  }

  function warnIfSummaryFormatUnexpected(text, seed) {
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
    const maxOpen = window.GameOnion?.getMaxOpenClaims?.(seed) ?? 1;
    const pendingCount = (body.match(/\[待核实/gi) || []).length;
    if (pendingCount > maxOpen) {
      window.PomDebug?.logLocalWarn(
        "摘要格式",
        `[待核实] 出现 ${pendingCount} 次，应为至多 ${maxOpen} 条`,
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

  async function maybeRefreshPlotSummary(session, signal, seed) {
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
    const userContent = buildSummaryUserPrefix(seed) + body;

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
      systemPrompt: buildSummarySystem(seed),
      messages: [{ role: "user", content: userContent }],
      temperature: window.PomTokens?.TEMP_SUMMARY ?? 0.2,
      max_tokens: window.PomTokens?.SUMMARY ?? 2048,
      signal,
      debugLabel: "拆分·③摘要",
    });

    let text = preserveGoalBlock(
      session.plotSummary,
      String(summary || "").trim()
    );
    if (text.length > SUMMARY_MAX_CHARS) {
      window.PomDebug?.logLocalWarn(
        "摘要超长已截断",
        `${text.length} 字 → ${SUMMARY_MAX_CHARS} 字`,
        ["summary"]
      );
      text = text.slice(0, SUMMARY_MAX_CHARS);
    }

    warnIfSummaryFormatUnexpected(text, seed);

    const beforeReconcile = text;
    if (window.GameOnion?.reconcilePlotSummary) {
      text = window.GameOnion.reconcilePlotSummary(text, seed);
    }
    if (
      window.GameOnion?.extractPendingLines?.(beforeReconcile)?.length &&
      !window.GameOnion?.extractPendingLines?.(text)?.length
    ) {
      window.PomDebug?.logLocal("③摘要 · reconcile", "已清除待核实#1", ["summary"]);
    }

    session.plotSummary = text;
    session.lastSummaryAtOptionTurn = optionTurns;
    const onionNote = window.GameOnion?.formatLayersDebug?.(text, seed) || "";
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
    preserveGoalBlock,
    shouldRefreshPlotSummary,
    willRefreshPlotSummaryThisPick,
    maybeRefreshPlotSummary,
  };
})();
