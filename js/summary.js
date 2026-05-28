(function () {
  /** 每轮选项后压摘要，避免证官新事实长期不进 [已证] */
  const SUMMARY_EVERY_OPTION_TURNS = 1;
  const SUMMARY_PROTECT_MESSAGES = 4;
  const SUMMARY_MAX_CHARS = 1200;

  function buildSummarySystem(seed) {
    const maxOpen = window.GameOnion?.getMaxOpenClaims?.(seed) ?? 1;
    const depExample = window.GameOnion?.formatDependencyLine?.("G", "L1") || "- [依赖] 若要证 G，则需证 L1";
    const lemmaBlock =
      maxOpen === 1
        ? `- [待证#1] L1：…（开放引理，全篇至多 1 条）
${depExample}`
        : Array.from({ length: maxOpen }, (_, i) => {
            const n = i + 1;
            const dep =
              window.GameOnion?.formatDependencyLine?.("G", `L${n}`) ||
              `- [依赖] 若要证 G，则需证 L${n}`;
            return `- [待证#${n}] L${n}：…
${dep}`;
          }).join("\n") +
          `\n（开放引理至多 ${maxOpen} 条；拆子引理时用「- [依赖] 若要证 L1，则需证 L1.1」）`;

    return `你是证明席书记员。维护本局**数学证明体**格式的论证档案（论题 G / 前提 P / 引理 L / 推导步 S / 证毕）。

【输出】仅一段（不要输出【论证目标】，由程序保留）：
【证明席】
【前提集】
- [前提] P1：…（开局给定；专名只增不删）
【证明进程】
${lemmaBlock}
- [已证] S1：…（依据：证官供述/证辩者亮牌/对话，可注轮次）
- [证毕#1] L1：…（L1 得证后写此行，并删除对应 [待证#1] 及其 [依赖] 行）

【证明规则】
1. 论题 G 只在【论证目标】；证明席不写 G 标题。
2. 每个 [待证#k] 后须单独一行命题间依赖，格式：- [依赖] 若要证 A，则需证 B。A、B 为不同命题编号（G / Lk / Lk.j），**不写** Lk 全文或冒号后复述。
3. 拆分子引理时写 - [依赖] 若要证 Lk，则需证 Lk.1（仍为命题间依赖，非单句内因果）。
4. 对话说定 → 写入 [已证] Sk；引理 Lk 被推导步充分确立 → 删 [待证#k]、[依赖] 行 + 写 [证毕#k]。
5. **一轮摘要至多新增 1 条 [证毕#k]**；仍有 [待证#k] 时禁止写 [证毕] G（G 只在【论证目标】，证明席不写 G 证毕行）。
6. 证官最近一句若为纠错/「先证 Lk」/未接受，则**不得** [证毕#k]，[待证#k] 须保留。
7. 禁止「视为已确立」「无需推导」等跳步表述入 [证毕]。
8. 改口 → 旧 [已证] 标 [已推翻]；以最新供述为准（槽位单真值）。
9. [已证] 须可核对专名；禁止「可能/存疑/空换」入 [已证]。
10. 禁止用「无/待填」占 [待证]；全文 ≤ ${SUMMARY_MAX_CHARS} 字；无 markdown；**禁止**【关系与态度】段。
11. 证官明确指出跳步/错误的证辩者句**不得**入 [已证]；仅写入证官认可后的推导步。`;
  }

  function buildSummaryUserPrefix(seed) {
    const maxOpen = window.GameOnion?.getMaxOpenClaims?.(seed) ?? 1;
    return `自检：新事实进 [已证]；Lk 得证则 [证毕#k] 并删 [待证#k]（须与证官已接受一致）；一轮至多 1 个 [证毕#k]；禁止 [证毕] G；待证至多 ${maxOpen} 条。只输出【证明席】。

`;
  }

  /** 压缩后保留【论证目标】段（模型不输出论题 G） */
  function preserveGoalBlock(previousSummary, newSummary) {
    const prev = String(previousSummary || "").trim();
    const next = String(newSummary || "").trim();
    if (!next) {
      return next || prev;
    }
    if (next.includes("【论证目标】") || next.includes("【本局目标】")) {
      return window.GameOnion?.normalizeProofArchive?.(next) || next;
    }
    const goalBlock =
      prev.match(/【论证目标】[\s\S]*?(?=【|$)/)?.[0]?.trim() ||
      prev.match(/【本局目标】[\s\S]*?(?=【|$)/)?.[0]?.trim();
    if (!goalBlock) {
      return window.GameOnion?.normalizeProofArchive?.(next) || next;
    }
    const normalized = window.GameOnion?.normalizeProofArchive?.(next) || next;
    return `${goalBlock.replace(/【本局目标】/, "【论证目标】")}\n\n${normalized}`.trim();
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
    if (!body.includes("【证明席】") && !body.includes("【剧情档案】")) {
      window.PomDebug?.logLocalWarn(
        "摘要格式",
        "缺少【证明席】段；摘录将走旧格式回退",
        ["summary"]
      );
    }
    if (/【关系与态度】/.test(body)) {
      window.PomDebug?.logLocalWarn(
        "摘要格式",
        "仍含【关系与态度】，应由 normalize 剥离",
        ["summary"]
      );
    }
    const maxOpen = window.GameOnion?.getMaxOpenClaims?.(seed) ?? 1;
    const pendingCount = (body.match(/\[待证|\[待核实/gi) || []).length;
    if (pendingCount > maxOpen) {
      window.PomDebug?.logLocalWarn(
        "摘要格式",
        `[待证] 出现 ${pendingCount} 次，应为至多 ${maxOpen} 条`,
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
      return "证官回复尚未写入 session（须在 ①② 之后压摘要）";
    }
    const { toSummarize } = buildSummaryPayload(session);
    if (toSummarize.length === 0) {
      return "无可压缩对白";
    }
    return "";
  }

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

  function enforceOneLemmaProgressPerSummary(prev, next) {
    const prevText = String(prev || "").trim();
    let text = String(next || "").trim();
    if (!text || !prevText) {
      return text;
    }
    const prevPending = window.GameOnion?.extractPendingLines?.(prevText)?.length || 0;
    if (prevPending === 0) {
      return text;
    }
    const prevQed = window.GameOnion?.extractQedOrders?.(prevText)?.size || 0;
    const nextQed = window.GameOnion?.extractQedOrders?.(text)?.size || 0;
    if (nextQed - prevQed <= 1) {
      return text;
    }
    window.PomDebug?.logLocalWarn(
      "摘要越权",
      `一轮新增 ${nextQed - prevQed} 个 [证毕#k]，已裁剪为 1 个`,
      ["summary"]
    );
    let added = 0;
    const lines = [];
    for (const line of text.split("\n")) {
      if (/\[证毕#\d+\]/i.test(line)) {
        if (added >= 1) {
          continue;
        }
        added += 1;
      }
      lines.push(line);
    }
    return lines.join("\n").trim();
  }

  async function maybeRefreshPlotSummary(session, signal, seed) {
    const skip = summarySkipReason(session);
    if (skip) {
      window.PomDebug?.logLocal("摘要未执行", skip, ["summary-skip"]);
      return false;
    }

    const { optionTurns, toSummarize, mergedProtected, keepRecent } =
      buildSummaryPayload(session);

    const labels = window.GameOnion?.getRoleLabels?.(seed) || {
      prover: "证官",
      player: "证辩者",
    };
    const block = toSummarize
      .map(
        (m) =>
          `${m.role === "assistant" ? labels.prover : labels.player}: ${m.content}`
      )
      .join("\n");
    const body = session.plotSummary
      ? `【已有证明席】\n${session.plotSummary}\n\n【新增对话】\n${block}`
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
    text = enforceOneLemmaProgressPerSummary(session.plotSummary, text);
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
      window.PomDebug?.logLocal("③摘要 · reconcile", "引理 Lk 已证毕", ["summary"]);
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
