(function () {
  const OPTION_SCHEMA = [
    { id: 1, intent: "keypoint", label: "深挖" },
    { id: 2, intent: "followup", label: "推进" },
    { id: 3, intent: "pause", label: "待会" },
  ];

  /** Phase A+：优先 [待核实] 行；兼容旧【未解问题】段 */
  function extractPendingVerification(plotSummary) {
    const text = String(plotSummary || "").trim();
    if (!text) {
      return "";
    }

    const pendingLines = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      if (/^[-*•]\s*\[待核实\]/.test(trimmed) || /^\[待核实\]/.test(trimmed)) {
        pendingLines.push(trimmed.replace(/^[-*•]\s*/, ""));
      }
    }
    if (pendingLines.length > 0) {
      return pendingLines.join("\n").slice(0, 400);
    }

    const legacy = text.match(/【未解问题】([\s\S]*?)(?=【|$)/);
    if (legacy) {
      return legacy[1].trim().slice(0, 400);
    }

    if (text.includes("【剧情档案】") && !/\[待核实\]/.test(text)) {
      window.PomDebug?.logLocalWarn("摘要摘录", "剧情档案中无 [待核实] 行");
    }

    return text.slice(0, 400);
  }

  function plotSummaryForOptions(plotSummary) {
    const excerpt = extractPendingVerification(plotSummary);
    if (!excerpt) {
      return "";
    }
    return `当前剧情摘要（待核实事项，供推进型选项参考）：\n${excerpt}`;
  }

  function buildOptionsSystemDuo(characterName) {
    const name = String(characterName || "锋利").trim() || "锋利";
    return `你是文字冒险游戏的选项撰稿人。玩家是与「${name}」对峙的调查者。

【阶段】纯对话，无行动场景。选项必须是玩家说的话（问句或祈使），禁止陈述句断言（如「真相是…」「你就是内鬼」）。

【分工】
- keypoint（深挖）：针对「${name}」上一句中某一具体名词/事实追问——要信息、澄清矛盾；勿复述对方刚提出的条件句（如「你先告诉我…」）。
- followup（推进）：不纠缠当前细节；引向更核心问题、换质问角度、或态度+催促（如「别绕圈子，直接说名字」）。

【禁止】两条都是深挖或都是推进；两条 line 完全相同。
【软提示】尽量避免与上一轮两条选项高度雷同（不做程序相似度检测）。

必须严格只输出 JSON 对象（不要 markdown）：
{"options":[{"intent":"keypoint","line":"..."},{"intent":"followup","line":"..."}]}
每条 line 为中文一句，≤35 字。不要生成 close（收束由程序固定）。`;
  }

  function buildIntentHintsBlock() {
    return OPTION_SCHEMA.map((o) => `- ${o.intent}（${o.label}）`).join("\n");
  }

  function fixedPauseLine(archetype) {
    const preset = archetype.options?.find(
      (o) => o.intent === "pause" || o.intent === "close"
    )?.line;
    return String(archetype.pauseLine || preset || "待会再来找你。").trim();
  }

  function optionRow(meta, line) {
    const text = String(line || "").trim();
    return {
      ...meta,
      line: text,
      send: `[intent:${meta.intent}] ${text}`,
    };
  }

  function buildHybridOptions(archetype, duo) {
    const pauseLine = fixedPauseLine(archetype);

    return OPTION_SCHEMA.map((meta) => {
      if (meta.intent === "keypoint") {
        return optionRow(meta, duo.keypoint);
      }
      if (meta.intent === "followup") {
        return optionRow(meta, duo.followup);
      }
      return optionRow(meta, pauseLine);
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
{"reply":"嘴硬。等刀架脖子上再说。","options":[{"intent":"keypoint","line":"..."},{"intent":"followup","line":"..."},{"intent":"close","line":"..."}]}

收束轮示例：
{"reply":"慢走不送。"}`;
    }

    const closeBlock = turn.isClose
      ? "\n【收束轮】玩家 intent=close。只输出 {\"reply\":\"...\"}，不要 options。"
      : "";

    const summaryBlock = turn.plotSummary?.trim()
      ? `\n【剧情摘要】（长程记忆；已写明的事实勿在 reply 里重复追问）\n${turn.plotSummary.trim()}\n`
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
${turn.isClose ? "只输出 {\"reply\":\"...\"}。" : '输出 {"reply":"...","options":[{"intent":"keypoint","line":"..."},{"intent":"followup","line":"..."},{"intent":"close","line":"..."}]}。'}
reply：1～2 句，≤40 字。options 三项须含 intent 与 line；**keypoint/followup 不得照抄旧句**，followup 须引用本轮 reply；close 由程序固定。${closeBlock}`;
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
    if (parsed.length < OPTION_SCHEMA.length) {
      throw new Error(`options 不足 ${OPTION_SCHEMA.length} 条`);
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
    return `\n【剧情摘要】（长程记忆；事实以此为准。reply 接最近一轮对白，勿重复摘要已写明的内容。）\n${text}\n`;
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

  async function requestOptionsJson({
    systemPrompt,
    userContent,
    temperature,
    signal,
    logTag,
  }) {
    window.PomDebug?.logRequest(`→ ${logTag}`, {
      system: systemPrompt.slice(0, 80) + "…",
      user: userContent,
    });

    const raw = await completeChatJson(
      {
        systemPrompt,
        messages: [{ role: "user", content: userContent }],
        temperature,
        max_tokens: tokenLimit("OPTIONS", 1280),
        signal,
      },
      { preferPlain: true }
    );

    window.PomDebug?.logResponse(`← ${logTag}`, raw);
    return raw;
  }

  function buildOptionsUserContent({ character, last, priorText, plotSummary }) {
    const summaryBlock = plotSummaryForOptions(plotSummary);
    const parts = [
      `角色名：${character.name}`,
      `角色上一句台词：${last}`,
    ];
    if (priorText) {
      parts.push(`最近对话：（不含上一句；最多 ${window.GameDialogue.OPTIONS_HISTORY_TURNS} 轮）\n${priorText}`);
    }
    if (summaryBlock) {
      parts.push(summaryBlock);
    }
    parts.push("请按 system 要求只输出 JSON。");
    return parts.join("\n\n");
  }

  async function generateOptions({
    character,
    archetype,
    session,
    signal,
    temperature = 0.5,
    logTag = "拆分·②选项",
    plotSummary = "",
  }) {
    const { lastLine, priorText } = window.GameDialogue.formatRecentDialogueForOptions(
      session.messages,
      {
        maxTurns: window.GameDialogue.OPTIONS_HISTORY_TURNS,
        characterName: character.name,
      }
    );
    const last =
      assistantLineForOptions(lastLine) || lastUsableAssistantLine(session, archetype);

    const systemPrompt = buildOptionsSystemDuo(character.name);
    const userContent = buildOptionsUserContent({
      character,
      last,
      priorText,
      plotSummary,
    });

    let raw = await requestOptionsJson({
      systemPrompt,
      userContent,
      temperature,
      signal,
      logTag,
    });

    let duo;
    try {
      duo = parseDuoOptionsFromRaw(raw);
    } catch (e) {
      window.PomDebug?.logLocalWarn("选项 JSON 解析失败，重试一次", e.message);
      raw = await requestOptionsJson({
        systemPrompt,
        userContent,
        temperature,
        signal,
        logTag: `${logTag}（重试）`,
      });
      duo = parseDuoOptionsFromRaw(raw);
    }

    if (duo.keypoint === duo.followup) {
      window.PomDebug?.logLocalWarn("选项重复", "keypoint 与 followup 相同，重试一次");
      raw = await requestOptionsJson({
        systemPrompt,
        userContent,
        temperature,
        signal,
        logTag: `${logTag}（去重）`,
      });
      duo = parseDuoOptionsFromRaw(raw);
    }

    const merged = buildHybridOptions(archetype, duo);
    window.PomDebug?.logLocal(
      "选项组装",
      `①深挖/②推进 AI · ③待会固定「${fixedPauseLine(archetype)}」`
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
    window.PomDebug?.logLocal("API 路径", "拆分优先 · ①reply → ②深挖/推进(AI)+③收束(固定)");

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

    const options = await generateOptions({
      character,
      archetype,
      session: sessionWithReply,
      signal,
      plotSummary: session.plotSummary,
      logTag: "拆分·②选项",
    });

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
          plotSummary: session.plotSummary,
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
