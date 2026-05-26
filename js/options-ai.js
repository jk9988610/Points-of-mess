(function () {
  const OPTION_SCHEMA = [
    { id: 1, intent: "keypoint", label: "要点" },
    { id: 2, intent: "followup", label: "追问" },
    { id: 3, intent: "pivot", label: "换题" },
    { id: 4, intent: "close", label: "收束" },
  ];

  const OPTIONS_SYSTEM_DUO = `你是文字冒险游戏的选项撰稿人。根据对话上下文，只为玩家生成 2 条短句（要点、追问）。
必须严格只输出 JSON 对象（不要 markdown）：
{"options":[{"intent":"keypoint","line":"..."},{"intent":"followup","line":"..."}]}
要求：每条 line 为中文一句，≤35 字；followup 必须引用「角色上一句」中的具体词。
不要生成 pivot、close（换题与收束由程序提供）。`;

  function buildIntentHintsBlock() {
    return OPTION_SCHEMA.map((o) => `- ${o.intent}（${o.label}）`).join("\n");
  }

  function optionsSignature(options) {
    return (options || [])
      .map((o) => `${o.intent}:${String(o.line || "").trim()}`)
      .join("|");
  }

  function optionsUnchanged(prev, next) {
    if (!prev?.length || !next?.length) {
      return false;
    }
    return optionsSignature(prev) === optionsSignature(next);
  }

  /** 与上一轮 options 中 line 完全相同的条数 */
  function countOverlappingOptionLines(prev, next) {
    const prevLines = new Set(
      (prev || []).map((o) => String(o.line || "").trim()).filter(Boolean)
    );
    let count = 0;
    for (const o of next || []) {
      const line = String(o.line || "").trim();
      if (line && prevLines.has(line)) {
        count += 1;
      }
    }
    return count;
  }

  const AI_OPTION_INTENTS = ["keypoint", "followup"];

  function filterOptionsByIntents(options, intents) {
    return (options || []).filter((o) => intents.includes(o.intent));
  }

  function shouldRegenerateOptions(prev, next) {
    const prevAi = filterOptionsByIntents(prev, AI_OPTION_INTENTS);
    const nextAi = filterOptionsByIntents(next, AI_OPTION_INTENTS);
    if (optionsUnchanged(prevAi, nextAi)) {
      return { yes: true, reason: "要点+追问与上一轮完全相同" };
    }
    const overlap = countOverlappingOptionLines(prevAi, nextAi);
    if (overlap >= 2) {
      return { yes: true, reason: `要点/追问有 ${overlap} 条与上一轮相同` };
    }
    return { yes: false };
  }

  function pickFromPool(pool, avoidLines) {
    const lines = (pool || []).filter(Boolean);
    if (lines.length === 0) {
      return "";
    }
    const avoid = new Set((avoidLines || []).map((l) => String(l).trim()).filter(Boolean));
    const fresh = lines.filter((l) => !avoid.has(l.trim()));
    const pick = fresh.length > 0 ? fresh : lines;
    return pick[Math.floor(Math.random() * pick.length)].trim();
  }

  function programPoolsForArchetype(archetype) {
    const pivotPreset = archetype.options?.find((o) => o.intent === "pivot")?.line;
    const closePreset = archetype.options?.find((o) => o.intent === "close")?.line;
    return {
      pivotPool:
        archetype.pivotPool?.length > 0 ? archetype.pivotPool : pivotPreset ? [pivotPreset] : [],
      closePool:
        archetype.closePool?.length > 0 ? archetype.closePool : closePreset ? [closePreset] : [],
    };
  }

  function optionRow(meta, line) {
    const text = String(line || "").trim();
    return {
      ...meta,
      line: text,
      send: `[intent:${meta.intent}] ${text}`,
    };
  }

  function buildHybridOptions(archetype, duo, avoidLines) {
    const { pivotPool, closePool } = programPoolsForArchetype(archetype);
    const pivotLine = pickFromPool(pivotPool, avoidLines);
    const closeLine = pickFromPool(closePool, []);

    return OPTION_SCHEMA.map((meta) => {
      if (meta.intent === "keypoint") {
        return optionRow(meta, duo.keypoint);
      }
      if (meta.intent === "followup") {
        return optionRow(meta, duo.followup);
      }
      if (meta.intent === "pivot") {
        return optionRow(meta, pivotLine);
      }
      return optionRow(meta, closeLine);
    });
  }

  function parseDuoOptionsFromRaw(raw) {
    const obj = extractJsonObject(raw);
    const list = Array.isArray(obj.options) ? obj.options : [];
    let keypoint = "";
    let followup = "";
    for (const item of list) {
      if (item && typeof item === "object" && item.intent === "keypoint") {
        keypoint = lineFromOptionItem(item);
      }
      if (item && typeof item === "object" && item.intent === "followup") {
        followup = lineFromOptionItem(item);
      }
    }
    if (!keypoint && list[0]) {
      keypoint = lineFromOptionItem(list[0]);
    }
    if (!followup && list[1]) {
      followup = lineFromOptionItem(list[1]);
    }
    keypoint = keypoint.replace(/^「+/, "").replace(/」+$/, "");
    followup = followup.replace(/^「+/, "").replace(/」+$/, "");
    if (!keypoint || !followup) {
      throw new Error("缺少 keypoint 或 followup");
    }
    return { keypoint, followup };
  }

  function avoidLinesForAiOptions(options) {
    return filterOptionsByIntents(options, AI_OPTION_INTENTS).map((o) =>
      String(o.line || "").trim()
    );
  }

  function isWeakReply(text) {
    const t = String(text || "").trim();
    return !t || /^[.…·\s]+$/.test(t) || t.length < 2;
  }

  function buildCombinedSystem(archetype, turn) {
    const base = `你是文字冒险游戏的对话引擎：同时生成角色台词（reply）与下一轮玩家选项（options）。

【messages 规则】
messages 里只能是角色与玩家的对白原话（玩家句即其点击的台词），不要期待 [game]、[choices] 等标记出现在 messages 中。
根据 messages 全文理解剧情；最后一条 user 是玩家本轮原话。

【角色风格】（写入 reply 时遵守）
${archetype.system}

【重要】必须只输出一个合法 JSON 对象，无其它文字、无 markdown 代码块。`;

    if (!turn) {
      return `${base}

非收束轮示例（options 必须是对象数组，禁止字符串数组）：
{"reply":"嘴硬。等刀架脖子上再说。","options":[{"intent":"keypoint","line":"..."},{"intent":"followup","line":"..."},{"intent":"pivot","line":"..."},{"intent":"close","line":"..."}]}

收束轮示例：
{"reply":"慢走不送。"}`;
    }

    const closeBlock = turn.isClose
      ? "\n【收束轮】玩家 intent=close。只输出 {\"reply\":\"...\"}，不要 options。"
      : "";

    const summaryBlock = turn.plotSummary?.trim()
      ? `\n【剧情摘要】（较早对白已压缩，与 messages 最近原话一起理解）\n${turn.plotSummary.trim()}\n`
      : "";

    return `${base}
${summaryBlock}
【本轮】
角色：${turn.character.name}
玩家本轮 intent：${turn.pick.intent}
玩家本轮原话（应与 messages 最后一条 user 一致）：${turn.pick.line}

【四类行动类型 — 只作结构参考，勿把旧选项文字写进 reply】
${buildIntentHintsBlock()}

【输出】
${turn.isClose ? "只输出 {\"reply\":\"...\"}。" : '输出 {"reply":"...","options":[{"intent":"keypoint","line":"..."},...共四条]}。'}
reply：1～2 句，≤40 字。options 四项必须各含 intent 与 line；**四条 line 必须与玩家已点过的旧句不同**，followup 须引用本轮 reply 里的具体词。${closeBlock}`;
  }

  function presetOptions(archetype) {
    return OPTION_SCHEMA.map((meta) => {
      const preset = archetype.options.find((o) => o.intent === meta.intent);
      const line = preset?.line || meta.label;
      return {
        ...meta,
        line,
        send: preset?.send || `[intent:${meta.intent}] ${line}`,
      };
    });
  }

  function extractJsonObject(raw) {
    return window.PomJson.parseJsonObject(raw);
  }

  function lineFromOptionItem(item) {
    if (typeof item === "string") {
      return item.trim();
    }
    if (item && typeof item === "object") {
      return String(item.line || item.text || item.content || "").trim();
    }
    return "";
  }

  /** 兼容 options 为字符串数组（按顺序映射 keypoint→close） */
  function optionsFromArray(items) {
    const parsed = Array.isArray(items) ? items : [];
    if (parsed.length < 4) {
      throw new Error("options 不足 4 条");
    }
    const allStrings = parsed.every((p) => typeof p === "string");
    if (allStrings) {
      window.PomDebug?.logLocalWarn(
        "options 格式",
        "模型返回字符串数组，已按顺序映射为四类 intent"
      );
    }
    return OPTION_SCHEMA.map((meta, i) => {
      const item =
        parsed.find((p) => p && typeof p === "object" && p.intent === meta.intent) ||
        parsed[i];
      let line = lineFromOptionItem(item);
      line = line.replace(/^「+/, "").replace(/」+$/, "");
      if (!line) {
        throw new Error(`缺少 ${meta.intent} 的 line`);
      }
      return {
        ...meta,
        line,
        send: `[intent:${meta.intent}] ${line}`,
      };
    });
  }

  function tokenLimit(name, fallback) {
    return window.PomTokens?.[name] ?? fallback;
  }

  function parseCombinedResponse(raw, isClose) {
    if (!String(raw || "").trim()) {
      throw new Error("API 返回为空");
    }
    try {
      const obj = extractJsonObject(raw);
      const reply = String(obj.reply || "").trim();
      if (!reply || isWeakReply(reply)) {
        throw new Error("缺少有效 reply");
      }
      if (isClose) {
        return { reply, options: null };
      }
      return {
        reply,
        options: optionsFromArray(obj.options),
      };
    } catch (e) {
      const plain = replyFromRaw(raw);
      if (!plain || isWeakReply(plain)) {
        throw e;
      }
      window.PomDebug?.logLocalWarn("非 JSON 回复", "按纯文本解析 reply");
      if (isClose) {
        return { reply: plain, options: null };
      }
      throw new Error("非 JSON 且无 options，需拆分生成");
    }
  }

  function replyFromRaw(raw) {
    try {
      const obj = extractJsonObject(raw);
      const reply = String(obj.reply || "").trim();
      if (reply && !isWeakReply(reply)) {
        return reply;
      }
    } catch {
      /* fall through */
    }
    let text = String(raw || "")
      .trim()
      .replace(/^```[\s\S]*?```/gm, "")
      .trim();
    if (text.startsWith("{")) {
      return "";
    }
    const first = text.split("\n").find((l) => l.trim()) || text;
    const candidate = first.trim().slice(0, 120);
    if (candidate && !isWeakReply(candidate)) {
      return candidate;
    }
    return "";
  }

  function lastUsableAssistantLine(session, archetype) {
    const done = session.messages.filter(
      (m) => m.status !== "error" && (m.role === "user" || m.role === "assistant")
    );
    for (let i = done.length - 1; i >= 0; i--) {
      if (done[i].role !== "assistant") {
        continue;
      }
      const line = assistantLineForOptions(done[i].content);
      if (line && !isWeakReply(line)) {
        return line;
      }
    }
    return archetype.opening;
  }

  function assistantLineForOptions(content) {
    const text = String(content || "").trim();
    if (!text.startsWith("{")) {
      return text;
    }
    try {
      const obj = JSON.parse(text);
      const reply = String(obj.reply || "").trim();
      if (reply) {
        return reply;
      }
    } catch {
      /* use raw */
    }
    return text.slice(0, 80);
  }

  async function completeChatJson(params, options) {
    const preferPlain = options?.preferPlain !== false;
    const attempts = preferPlain
      ? [
          { label: "普通", extra: {} },
          { label: "json_object", extra: { response_format: { type: "json_object" } } },
        ]
      : [
          { label: "json_object", extra: { response_format: { type: "json_object" } } },
          { label: "普通", extra: {} },
        ];

    let lastError = null;
    for (const attempt of attempts) {
      try {
        const raw = await window.ChatApi.completeChat({ ...params, ...attempt.extra });
        if (String(raw || "").trim()) {
          return raw;
        }
        lastError = new Error("API 返回为空");
      } catch (e) {
        lastError = e;
        window.PomDebug?.logLocalWarn(
          `${attempt.label} 请求失败`,
          e.message || String(e)
        );
      }
    }
    throw lastError || new Error("API 返回为空");
  }

  function roleStyleFromSystem(systemPrompt) {
    const m = String(systemPrompt || "").match(
      /【角色风格】（写入 reply 时遵守）\n([\s\S]*?)(?=\n【|$)/
    );
    return m
      ? `【角色风格】\n${m[1].trim()}`
      : "你是角色「锋利」，短句、直接。";
  }

  function plotSummaryBlock(plotSummary) {
    const text = String(plotSummary || "").trim();
    if (!text) {
      return "";
    }
    return `\n【剧情摘要】（较早对白已压缩，与 messages 最近原话一起理解）\n${text}\n`;
  }

  async function requestReplyOnly({ systemPrompt, apiMessages, signal, plotSummary }) {
    const replySystem = `${roleStyleFromSystem(systemPrompt)}${plotSummaryBlock(plotSummary)}
只输出角色的一句台词：1～2 句中文，≤40 字。不要 JSON、不要 markdown、不要解释。`;

    const raw = await window.ChatApi.completeChat({
      systemPrompt: replySystem,
      messages: apiMessages,
      temperature: 0.45,
      max_tokens: tokenLimit("REPLY_ONLY", 768),
      signal,
    });

    const reply = replyFromRaw(raw);
    if (reply && !isWeakReply(reply)) {
      return reply;
    }
    throw new Error("无法解析角色回复");
  }

  async function generateOptions({
    character,
    archetype,
    session,
    signal,
    previousOptions,
    temperature = 0.5,
    logTag = "拆分·②选项",
  }) {
    const { lastLine, priorText } = window.GameDialogue.formatRecentDialogueForOptions(
      session.messages
    );
    const last =
      assistantLineForOptions(lastLine) || lastUsableAssistantLine(session, archetype);

    const prevOpts = previousOptions || [];
    const avoidForAi = avoidLinesForAiOptions(prevOpts);
    const avoidForPivot = prevOpts
      .filter((o) => o.intent === "pivot")
      .map((o) => o.line);

    const avoidBlock =
      avoidForAi.length > 0
        ? `\n【禁止重复】下列 keypoint/followup 不得原样出现：\n${avoidForAi.map((l) => `- ${l}`).join("\n")}\n`
        : "";

    const userContent = `角色名：${character.name}
角色上一句台词：${last}
${priorText ? `最近对话：\n${priorText}` : ""}

请生成 keypoint 与 followup 两条 JSON。${avoidBlock}`;

    window.PomDebug?.logRequest(`→ ${logTag}`, {
      system: OPTIONS_SYSTEM_DUO.slice(0, 60) + "…",
      user: userContent,
    });

    const raw = await completeChatJson(
      {
        systemPrompt: OPTIONS_SYSTEM_DUO,
        messages: [{ role: "user", content: userContent }],
        temperature,
        max_tokens: tokenLimit("OPTIONS", 640),
        signal,
      },
      { preferPlain: true }
    );

    window.PomDebug?.logResponse(`← ${logTag}`, raw);

    const duo = parseDuoOptionsFromRaw(raw);
    const merged = buildHybridOptions(archetype, duo, avoidForPivot);
    window.PomDebug?.logLocal(
      "选项组装",
      "①② AI 生成 · ③换题 ④收束 程序池（换题/收束不参与重复检测）"
    );
    return merged;
  }

  async function callCombinedOnce({ systemPrompt, apiMessages, isClose, signal }) {
    const raw = await completeChatJson(
      {
        systemPrompt,
        messages: apiMessages,
        temperature: 0.45,
        max_tokens: isClose
          ? tokenLimit("COMBINED_CLOSE", 768)
          : tokenLimit("COMBINED", 2048),
        signal,
      },
      { preferPlain: true }
    );
    return { raw, parsed: parseCombinedResponse(raw, isClose) };
  }

  async function requestSplitTurn({
    character,
    archetype,
    session,
    apiMessages,
    turn,
    signal,
  }) {
    const systemPrompt = buildCombinedSystem(archetype, {
      ...turn,
      plotSummary: session.plotSummary,
    });
    window.PomDebug?.logLocal("API 路径", "拆分优先 · ①reply → ②要点/追问(AI)+换题/收束(程序)");

    window.PomDebug?.logRequest("→ 拆分·①reply", {
      messages: apiMessages,
      plotSummary: session.plotSummary || null,
    });

    const reply = await requestReplyOnly({
      systemPrompt,
      apiMessages,
      signal,
      plotSummary: session.plotSummary,
    });
    window.PomDebug?.logResponse("← 拆分·①reply", reply);

    const sessionWithReply = {
      messages: [
        ...session.messages,
        { role: "assistant", content: reply, status: "done" },
      ],
    };

    let options = await generateOptions({
      character,
      archetype,
      session: sessionWithReply,
      signal,
      previousOptions: turn.options,
      logTag: "拆分·②选项",
    });

    const regen = shouldRegenerateOptions(turn.options, options);
    if (regen.yes) {
      window.PomDebug?.logLocalWarn("选项需重生成", regen.reason);
      options = await generateOptions({
        character,
        archetype,
        session: sessionWithReply,
        signal,
        previousOptions: turn.options,
        temperature: 0.62,
        logTag: "拆分·②选项(重试)",
      });
    }

    return { reply, options };
  }

  async function requestCombinedTurn({
    character,
    archetype,
    session,
    apiMessages,
    turn,
    isClose,
    signal,
  }) {
    const systemPrompt = buildCombinedSystem(archetype, {
      ...turn,
      plotSummary: session.plotSummary,
    });
    if (window.PomTokens?.USE_SPLIT_FIRST) {
      if (isClose) {
        window.PomDebug?.logLocal("API 路径", "收束 · 仅 拆分·①reply");
        window.PomDebug?.logRequest("→ 拆分·①reply（收束）", { messages: apiMessages });
        const reply = await requestReplyOnly({
          systemPrompt,
          apiMessages,
          signal,
          plotSummary: session.plotSummary,
        });
        window.PomDebug?.logResponse("← 拆分·①reply（收束）", reply);
        return { reply, options: null };
      }
      return requestSplitTurn({
        character,
        archetype,
        session,
        apiMessages,
        turn,
        signal,
      });
    }

    window.PomDebug?.logRequest(isClose ? "角色收束" : "角色回复+选项（合并）", {
      system: systemPrompt.slice(0, 80) + "…",
      messages: apiMessages,
    });

    let raw = "";
    let parsed = null;
    try {
      const first = await callCombinedOnce({ systemPrompt, apiMessages, isClose, signal });
      raw = first.raw;
      parsed = first.parsed;
    } catch (e1) {
      window.PomDebug?.logLocalWarn("合并请求失败，重试一次", e1.message);
      const second = await callCombinedOnce({
        systemPrompt,
        apiMessages,
        isClose,
        signal,
      });
      raw = second.raw;
      parsed = second.parsed;
    }

    window.PomDebug?.logResponse(isClose ? "角色收束" : "角色回复+选项", raw);

    if (isClose) {
      return parsed;
    }

    const regen = shouldRegenerateOptions(turn.options, parsed.options);
    if (regen.yes) {
      window.PomDebug?.logLocalWarn("选项需重生成", regen.reason);
      parsed.options = await generateOptions({
        character,
        archetype,
        session: {
          messages: [
            ...session.messages,
            { role: "assistant", content: parsed.reply, status: "done" },
          ],
        },
        signal,
        previousOptions: turn.options,
        temperature: 0.62,
        logTag: "合并后·选项(重试)",
      });
    }

    return parsed;
  }

  async function requestCombinedTurnWithFallback({
    character,
    archetype,
    session,
    apiMessages,
    turn,
    isClose,
    signal,
  }) {
    try {
      return await requestCombinedTurn({
        character,
        archetype,
        session,
        apiMessages,
        turn,
        isClose,
        signal,
      });
    } catch (e) {
      window.PomDebug?.logLocalWarn("主路径失败，走备用拆分", e.message);
      let reply = "";
      try {
        reply = await requestReplyOnly({
          systemPrompt: buildCombinedSystem(archetype, {
            ...turn,
            plotSummary: session.plotSummary,
          }),
          apiMessages,
          signal,
          plotSummary: session.plotSummary,
        });
      } catch {
        /* use empty */
      }

      if (isClose) {
        if (isWeakReply(reply)) {
          throw new Error("收束回复生成失败，请重试");
        }
        return { reply, options: null };
      }

      if (isWeakReply(reply)) {
        const last = lastUsableAssistantLine(session, archetype);
        reply = last;
        window.PomDebug?.logLocalWarn("回复无效，沿用上一句角色台词", reply);
      }

      const sessionWithReply = {
        messages: [
          ...session.messages,
          { role: "assistant", content: reply, status: "done" },
        ],
      };

      try {
        const options = await generateOptions({
          character,
          archetype,
          session: sessionWithReply,
          signal,
          previousOptions: turn.options,
          logTag: "备用·②选项",
        });
        return { reply, options };
      } catch (e2) {
        window.PomDebug?.logLocalWarn("备用选项 API 失败，仍用程序预设", e2.message);
        return { reply, options: presetOptions(archetype) };
      }
    }
  }

  window.GameOptionsAi = {
    OPTION_SCHEMA,
    presetOptions,
    generateOptions,
    requestCombinedTurn: requestCombinedTurnWithFallback,
  };
})();
