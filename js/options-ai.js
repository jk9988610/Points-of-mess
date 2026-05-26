(function () {
  const OPTION_SCHEMA = [
    { id: 1, intent: "keypoint", label: "要点" },
    { id: 2, intent: "followup", label: "追问" },
    { id: 3, intent: "pivot", label: "换题" },
    { id: 4, intent: "close", label: "收束" },
  ];

  const OPTIONS_SYSTEM = `你是文字冒险游戏的选项撰稿人。根据对话上下文，为玩家生成 4 条可点击的短句。
必须严格只输出 JSON 对象（不要 markdown）：
{"options":[{"intent":"keypoint","line":"..."},{"intent":"followup","line":"..."},{"intent":"pivot","line":"..."},{"intent":"close","line":"..."}]}
要求：每条 line 为中文一句，≤35 字；followup 必须引用「角色上一句」中的具体词。`;

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
    let text = String(raw || "").trim();
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error("未找到 JSON 对象");
    }
    return JSON.parse(text.slice(start, end + 1));
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

  function parseCombinedResponse(raw, isClose) {
    if (!String(raw || "").trim()) {
      throw new Error("API 返回为空");
    }
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
  }

  function replyFromRaw(raw) {
    try {
      const obj = extractJsonObject(raw);
      const reply = String(obj.reply || "").trim();
      if (reply) {
        return reply;
      }
    } catch {
      /* fall through */
    }
    const text = String(raw || "")
      .trim()
      .replace(/^```[\s\S]*?```/gm, "")
      .trim();
    const first = text.split("\n").find((l) => l.trim()) || text;
    const candidate = first.trim().slice(0, 80);
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

  async function requestReplyOnly({ systemPrompt, apiMessages, signal }) {
    const replySystem = systemPrompt.replace(
      /同时生成角色台词（reply）与下一轮玩家选项（options）。/,
      "只生成角色台词（reply），严格输出 JSON：{\"reply\":\"...\"}，不要 options。"
    );
    const raw = await completeChatJson(
      {
        systemPrompt: replySystem,
        messages: apiMessages,
        temperature: 0.45,
        max_tokens: 160,
        signal,
      },
      { preferPlain: true }
    );
    return parseCombinedResponse(raw, true).reply;
  }

  async function generateOptions({ character, archetype, session, signal, avoidLines }) {
    const { lastLine, priorText } = window.GameDialogue.formatRecentDialogueForOptions(
      session.messages
    );
    const last =
      assistantLineForOptions(lastLine) || lastUsableAssistantLine(session, archetype);
    const avoidBlock =
      avoidLines?.length > 0
        ? `\n【禁止重复】以下句子不得原样出现在 options 的 line 中：\n${avoidLines.map((l) => `- ${l}`).join("\n")}\n`
        : "";

    const userContent = `角色名：${character.name}
角色上一句台词：${last}
${priorText ? `最近对话：\n${priorText}` : ""}

请生成四轮玩家选项 JSON。${avoidBlock}`;

    window.PomDebug?.logRequest("生成选项（兜底）", {
      system: OPTIONS_SYSTEM.slice(0, 60) + "…",
      user: userContent,
    });

    const raw = await completeChatJson(
      {
        systemPrompt: OPTIONS_SYSTEM,
        messages: [{ role: "user", content: userContent }],
        temperature: 0.5,
        max_tokens: 320,
        signal,
      },
      { preferPlain: true }
    );

    window.PomDebug?.logResponse("生成选项（兜底）", raw);

    const obj = extractJsonObject(raw);
    const list = obj.options || obj;
    if (!Array.isArray(list)) {
      throw new Error("options 不是数组");
    }
    return optionsFromArray(list);
  }

  async function callCombinedOnce({ systemPrompt, apiMessages, isClose, signal }) {
    const raw = await completeChatJson(
      {
        systemPrompt,
        messages: apiMessages,
        temperature: 0.45,
        max_tokens: isClose ? 120 : 520,
        signal,
      },
      { preferPlain: true }
    );
    return { raw, parsed: parseCombinedResponse(raw, isClose) };
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
    const previousLines = (turn.options || []).map((o) => o.line).filter(Boolean);

    window.PomDebug?.logRequest(isClose ? "角色收束" : "角色回复+选项", {
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
      try {
        const second = await callCombinedOnce({
          systemPrompt,
          apiMessages,
          isClose,
          signal,
        });
        raw = second.raw;
        parsed = second.parsed;
      } catch (e2) {
        if (isClose) {
          throw e2;
        }
        window.PomDebug?.logLocalWarn("合并仍失败，拆成「先回复、再选项」", e2.message);
        const reply = await requestReplyOnly({ systemPrompt, apiMessages, signal });
        const options = await generateOptions({
          character,
          archetype,
          session: {
            messages: [
              ...session.messages,
              { role: "assistant", content: reply, status: "done" },
            ],
          },
          signal,
          avoidLines: previousLines,
        });
        raw = JSON.stringify({ reply, options: options.map((o) => ({ intent: o.intent, line: o.line })) });
        parsed = { reply, options };
      }
    }

    window.PomDebug?.logResponse(isClose ? "角色收束" : "角色回复+选项", raw);

    if (isClose) {
      return parsed;
    }

    if (optionsUnchanged(turn.options, parsed.options)) {
      window.PomDebug?.logLocalWarn(
        "选项与上一轮相同",
        "改走选项专生成"
      );
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
        avoidLines: previousLines,
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
      window.PomDebug?.logLocalWarn("合并 JSON 解析失败，尝试兜底", e.message);
      let reply = "";
      try {
        reply = await requestReplyOnly({
          systemPrompt: buildCombinedSystem(archetype, {
            ...turn,
            plotSummary: session.plotSummary,
          }),
          apiMessages,
          signal,
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

      const avoidLines = (turn.options || []).map((o) => o.line).filter(Boolean);
      try {
        const options = await generateOptions({
          character,
          archetype,
          session: sessionWithReply,
          signal,
          avoidLines,
        });
        return { reply, options };
      } catch (e2) {
        window.PomDebug?.logLocalWarn("选项兜底 API 失败，仍用程序预设", e2.message);
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
