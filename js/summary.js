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
3. 新事实用 [已确认] 追加；不要单独写「本轮新增」段。
4. 全文不超过 ${SUMMARY_MAX_CHARS} 字；优先合并 [待核实] 条数，不删 [已确认] 专名。
5. 只输出摘要正文，不要 markdown 代码块或其它说明。

【待核实 → 已确认 — 最高优先级】
当某个 [待核实] 在本轮【新增对话】中已被明确回答（锋利直接给事实、或玩家确认、或双方短句已构成肯定/否定），必须：
1. 在【剧情档案】写入对应的 [已确认]（陈述事实，不是问句）；
2. 从 [待核实] 中删除该条（不得继续挂着已答问题）。

判定「已明确回答」包括：是/否、仍在/已离职、具体地点、具体职务、具体人名、具体时间等短句事实。
示例（结构示范，勿照抄专名）：待办「某人是否仍在职」+ 对话「还在，坐办公室」→ 输出 [已确认] 某人仍在职（坐办公室），并删除原 [待核实]。

【待核实核对 — 必须执行】
压缩前逐条阅读【已有摘要】中每一个 [待核实]：
- 已明确回答 → 按上一节迁入 [已确认] 并删除该 [待核实]（含同义表述，如「曾经的搭档」可回答「与父亲关系」）。
- 仅部分回答 → 删除原条，改写为更细的一条 [待核实]；同时将已出现的线索（对家、上头、指使、收钱等）写入至少一条 [已确认]。
- 禁止保留与 [已确认] 矛盾的 [待核实]。
错误示例：对话已确认「还在，坐办公室」，仍保留 [待核实]「是否仍在职」。

【禁止幻觉 — 必须执行】
- 只能依据【已有摘要】与【新增对话】更新；禁止引入训练记忆、示例人设或其它会话内容。
- 每一条 [已确认] 必须能在【新增对话】或【已有摘要】的 [已确认] 中找到依据。
- 禁止写入上述两栏中均未出现的人名、地点、物证（勿照抄本说明里的示例专名）。

【示例格式（专名仅示范结构，勿照抄进输出）】
【剧情档案】
- [已确认] 对方承认存在中间人代号「X」
- [待核实] 收据上签字者真实姓名
【关系与态度】
- 对峙中，一方施压、一方追问`;

  const SUMMARY_USER_CHECKLIST = `【压缩前请自检】
1. 逐条对照【新增对话】：哪些 [待核实] 已被明确回答？→ 必须写入 [已确认] 并从未解列表删除。
2. 哪些 [待核实] 仅部分回答？→ 收窄为更细待办 + 补 [已确认]。
3. 拟写入的每个 [已确认] 专名/事实是否已在【新增对话】或【已有摘要】中出现？若否，不得写入。
（心中核对即可；最终输出仍只含两段摘要正文。）

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
    const body = session.plotSummary
      ? `【已有摘要】\n${session.plotSummary}\n\n【新增对话】\n${block}`
      : `【新增对话】\n${block}`;
    const userContent = SUMMARY_USER_CHECKLIST + body;

    window.PomDebug?.logLocal(
      "压缩剧情摘要（A++·待核实迁已确认）",
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
      "剧情摘要已更新（A++）",
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
