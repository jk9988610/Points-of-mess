(function () {
  /** 每轮选项后赋予证辩者一条可出示引理（AI 生成，比 seed 硬编码更灵活） */

  function countOptionTurns(messages) {
    return (messages || []).filter(
      (m) => m.role === "user" && m.intent && m.intent !== "freeform"
    ).length;
  }

  function existingEvidenceTexts(session) {
    return (session?.playerEvidence || [])
      .map((e) => `${e.text}\n${e.offerLine}`)
      .join("\n");
  }

  function buildEvidenceGrantSystem(seed) {
    const goal = String(seed?.goal || "").trim();
    const hints = (seed?.evidenceSeedHints || seed?.playerKnowledge || [])
      .map((h) => (typeof h === "string" ? h : h?.text || h?.offerLine || ""))
      .filter(Boolean)
      .slice(0, 4);
    const hintBlock = hints.length
      ? `\n【背景线索（可改写为证辩者视角，勿照抄）】\n${hints.map((h) => `- ${h}`).join("\n")}`
      : "";
    return `你是证明席外的「引理授予官」。根据本局对话与证明席，赋予证辩者**恰好一条**新获得的、可核对观测引理（来自对白、证明席或题设前提）。

【论证目标】${goal || "闭合论题 G"}${hintBlock}

【输出】只输出 JSON：
{"text":"观测引理：…（≤40字）","offerLine":"…，换你说…（advance 出示原句，≤35字；格式：先亮引理，再换推导步）","match":"专名片段（2～6字）"}

【规则】
1. 每轮仅一条；须含专名；offerLine 须指向当前待证引理 Lk。
2. 勿重复【已有引理】（同 match 视为重复）；勿与【证明席】[已证] 矛盾。
3. 若本轮无新事实，输出 {"skip":true}。`;
  }

  function parseEvidenceGrant(raw) {
    const obj = window.PomJsonParse?.extractJsonObject?.(raw);
    if (!obj || obj.skip) {
      return null;
    }
    const text = String(obj.text || "").trim();
    const offerLine = String(obj.offerLine || "").trim();
    let match = String(obj.match || "").trim();
    if (!text || !offerLine) {
      return null;
    }
    if (!match) {
      const m = offerLine.match(/[\u4e00-\u9fa5]{2,6}/);
      match = m?.[0] || offerLine.slice(0, 4);
    }
    if (text.length > 60 || offerLine.length > 40) {
      return null;
    }
    return { text, offerLine, match };
  }

  function isDuplicateEvidence(session, item) {
    return (session?.playerEvidence || []).some(
      (e) =>
        e.match === item.match ||
        (e.offerLine && item.offerLine && e.offerLine.slice(0, 10) === item.offerLine.slice(0, 10))
    );
  }

  function pushEvidence(session, item, turn) {
    if (!session) {
      return false;
    }
    if (!Array.isArray(session.playerEvidence)) {
      session.playerEvidence = [];
    }
    if (isDuplicateEvidence(session, item)) {
      return false;
    }
    const poolId = item.id && !String(item.id).startsWith("ev-") ? item.id : null;
    const id = poolId || `ev-${turn}-${session.playerEvidence.length + 1}`;
    session.playerEvidence.push({
      id,
      text: item.text,
      offerLine: item.offerLine,
      match: item.match,
      grantedAtTurn: turn,
    });
    return true;
  }

  function buildGrantUserContent(session, seed) {
    const plot = String(session?.plotSummary || "").trim();
    const done = window.GameDialogue?.getDoneMessages?.(session?.messages || []) || [];
    const recent = done.slice(-6);
    const labels = window.GameOnion?.getRoleLabels?.(seed) || {
      prover: "证官",
      player: "证辩者",
    };
    const dialogue = recent
      .map(
        (m) =>
          `${m.role === "assistant" ? labels.prover : labels.player}: ${m.content}`
      )
      .join("\n");
    const parts = [];
    if (plot) {
      parts.push(`【证明席】\n${plot}`);
    }
    if (dialogue) {
      parts.push(`【最近对白】\n${dialogue}`);
    }
    const existing = existingEvidenceTexts(session);
    if (existing) {
      parts.push(`【已有引理】\n${existing}`);
    }
    const pending = window.GameOnion?.extractPendingLines?.(plot)?.[0];
    if (pending) {
      parts.push(`【当前待证 Lk】${pending}`);
    }
    return parts.join("\n\n");
  }

  function usesPoolLemmaGrant(seed) {
    return Boolean(seed?.poolLemmaGrant && (seed?.lemmaPool?.length || 0) > 0);
  }

  /** 从 proof-pool lemmaPool 按序授予引理（不调用 AI） */
  function grantPoolLemma(session, seed, { bootstrap = false } = {}) {
    const pool = seed?.lemmaPool || [];
    if (!pool.length) {
      return false;
    }
    const turn = countOptionTurns(session?.messages || []);
    const grantKey = bootstrap ? "bootstrap" : turn;
    if (session.lastEvidenceGrantKey === grantKey) {
      return false;
    }
    const grantedIds = new Set((session?.playerEvidence || []).map((e) => e.id));
    let next = null;
    if (bootstrap) {
      next = pool.find((l) => !grantedIds.has(l.id));
    } else {
      const idx = (session?.playerEvidence || []).length;
      if (idx >= pool.length) {
        session.lastEvidenceGrantKey = grantKey;
        return false;
      }
      next = pool[idx];
      if (next && grantedIds.has(next.id)) {
        next = pool.find((l) => !grantedIds.has(l.id));
      }
    }
    if (!next || grantedIds.has(next.id)) {
      session.lastEvidenceGrantKey = grantKey;
      return false;
    }
    const item = {
      id: next.id,
      text: next.text,
      offerLine: next.offerLine,
      match: next.match,
    };
    if (pushEvidence(session, item, turn)) {
      session.lastEvidenceGrantKey = grantKey;
      window.PomDebug?.logLocal(
        bootstrap ? "④引理 · 池赋予（开局）" : "④引理 · 池赋予",
        `${item.text} → 「${item.offerLine}」`,
        ["evidence-out"]
      );
      return true;
    }
    session.lastEvidenceGrantKey = grantKey;
    return false;
  }

  async function grantPlayerEvidence(session, seed, signal, { bootstrap = false } = {}) {
    if (!session || !window.GameOnion?.usesDynamicPlayerEvidence?.(seed)) {
      return false;
    }
    if (usesPoolLemmaGrant(seed)) {
      return grantPoolLemma(session, seed, { bootstrap });
    }
    const turn = countOptionTurns(session.messages);
    const grantKey = bootstrap ? "bootstrap" : turn;
    if (session.lastEvidenceGrantKey === grantKey) {
      return false;
    }

    const userContent = buildGrantUserContent(session, seed);
    if (!userContent.trim()) {
      return false;
    }

    window.PomDebug?.logLocal(
      bootstrap ? "④引理 · 开局赋予" : "④引理 · 即将请求",
      bootstrap ? "首条引理" : `第 ${turn} 轮 · 见黄条 →拆分·④引理`,
      ["evidence"]
    );

    const raw = await window.ChatApi.completeChat({
      systemPrompt: buildEvidenceGrantSystem(seed),
      messages: [
        {
          role: "user",
          content: bootstrap
            ? `${userContent}\n\n【任务】开局：赋予证辩者第一条可出示引理（基于背景线索与档案）。`
            : `${userContent}\n\n【任务】根据本轮最新对白，赋予证辩者一条**新**观测引理。`,
        },
      ],
      temperature: window.PomTokens?.TEMP_EVIDENCE ?? 0.35,
      max_tokens: window.PomTokens?.EVIDENCE ?? 512,
      signal,
      debugLabel: bootstrap ? "拆分·④引理·开局" : "拆分·④引理",
    });

    const item = parseEvidenceGrant(raw);
    if (!item || isDuplicateEvidence(session, item)) {
      session.lastEvidenceGrantKey = grantKey;
      window.PomDebug?.logLocal("④引理 · 跳过", "无新引理或重复", ["evidence-skip"]);
      return false;
    }

    if (pushEvidence(session, item, turn)) {
      session.lastEvidenceGrantKey = grantKey;
      window.PomDebug?.logLocal(
        "④引理 · 已赋予",
        `${item.text} → 「${item.offerLine}」`,
        ["evidence-out"]
      );
      return true;
    }
    return false;
  }

  /** 新局开局：异步赋予首条引理（不阻塞 UI） */
  function bootstrapPlayerEvidence(session, seed) {
    if (!window.GameOnion?.usesDynamicPlayerEvidence?.(seed)) {
      return Promise.resolve(false);
    }
    if ((session?.playerEvidence || []).length > 0) {
      return Promise.resolve(false);
    }
    if (usesPoolLemmaGrant(seed)) {
      return Promise.resolve(grantPoolLemma(session, seed, { bootstrap: true }));
    }
    const ac = new AbortController();
    return grantPlayerEvidence(session, seed, ac.signal, { bootstrap: true }).catch(
      (e) => {
        window.PomDebug?.logLocalWarn("④引理 · 开局失败", e.message, ["evidence"]);
        return false;
      }
    );
  }

  window.GameEvidence = {
    grantPlayerEvidence,
    bootstrapPlayerEvidence,
    grantPoolLemma,
    usesPoolLemmaGrant,
    parseEvidenceGrant,
    buildEvidenceGrantSystem,
  };
})();
