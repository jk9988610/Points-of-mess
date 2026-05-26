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

  function buildChoicesBlock(options) {
    return options
      .map((o) => `${o.intent} → ${o.line}`)
      .join("\n");
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

非收束轮示例：
{"reply":"嘴硬。等刀架脖子上再说。","options":[{"intent":"keypoint","line":"..."},...]}

收束轮示例：
{"reply":"慢走不送。"}`;
    }

    const closeBlock = turn.isClose
      ? "\n【收束轮】玩家 intent=close。只输出 {\"reply\":\"...\"}，不要 options。"
      : "";

    return `${base}

【本轮】
角色：${turn.character.name}
玩家本轮 intent：${turn.pick.intent}
玩家本轮原话（应与 messages 最后一条 user 一致）：${turn.pick.line}

【四类可选行动 — 仅用于生成 options，勿写入 reply 正文】
${buildChoicesBlock(turn.options)}

【输出】
${turn.isClose ? "只输出 {\"reply\":\"...\"}。" : '输出 {"reply":"...","options":[四条 keypoint/followup/pivot/close]}。'}
reply：1～2 句，≤40 字。options 的 line ≤35 字，不要外包「」；followup 须引用本条 reply 中的具体词。${closeBlock}`;
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

  function optionsFromArray(items) {
    const parsed = Array.isArray(items) ? items : [];
    if (parsed.length < 4) {
      throw new Error("options 不足 4 条");
    }
    return OPTION_SCHEMA.map((meta, i) => {
      const item = parsed.find((p) => p.intent === meta.intent) || parsed[i];
      let line = String(item?.line || "").trim();
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
    const obj = extractJsonObject(raw);
    const reply = String(obj.reply || "").trim();
    if (!reply) {
      throw new Error("缺少 reply");
    }
    if (isClose) {
      return { reply, options: null };
    }
    return {
      reply,
      options: optionsFromArray(obj.options),
    };
  }

  function plainTextReply(raw) {
    const text = String(raw || "")
      .trim()
      .replace(/^```[\s\S]*?```/gm, "")
      .trim();
    const first = text.split("\n").find((l) => l.trim()) || text;
    return first.trim().slice(0, 80) || "……";
  }

  async function completeChatJson(params) {
    try {
      return await window.ChatApi.completeChat({
        ...params,
        response_format: { type: "json_object" },
      });
    } catch (e) {
      window.PomDebug?.logLocalWarn("json_object 模式失败，改普通请求", e.message);
      return window.ChatApi.completeChat(params);
    }
  }

  async function generateOptions({ character, archetype, session, signal }) {
    const { lastLine, priorText } = window.GameDialogue.formatRecentDialogueForOptions(
      session.messages,
      character.name
    );
    const last = lastLine || archetype.opening;

    const userContent = `角色名：${character.name}
角色上一句台词：${last}
${priorText ? `最近对话：\n${priorText}` : ""}

请生成四轮玩家选项 JSON。`;

    window.PomDebug?.logRequest("生成选项（兜底）", {
      system: OPTIONS_SYSTEM.slice(0, 60) + "…",
      user: userContent,
    });

    const raw = await completeChatJson({
      systemPrompt: OPTIONS_SYSTEM,
      messages: [{ role: "user", content: userContent }],
      temperature: 0.65,
      max_tokens: 280,
      signal,
    });

    window.PomDebug?.logResponse("生成选项（兜底）", raw);

    const obj = extractJsonObject(raw);
    const list = obj.options || obj;
    if (!Array.isArray(list)) {
      throw new Error("options 不是数组");
    }
    return optionsFromArray(list);
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
    window.PomDebug?.logRequest(isClose ? "角色收束" : "角色回复+选项", {
      system: systemPrompt.slice(0, 80) + "…",
      messages: apiMessages,
    });

    const raw = await completeChatJson({
      systemPrompt,
      messages: apiMessages,
      temperature: 0.55,
      max_tokens: isClose ? 120 : 420,
      signal,
    });

    window.PomDebug?.logResponse(isClose ? "角色收束" : "角色回复+选项", raw);

    try {
      return parseCombinedResponse(raw, isClose);
    } catch (e) {
      window.PomDebug?.logLocalWarn("合并 JSON 解析失败，尝试兜底", e.message);
      const reply = plainTextReply(raw);

      if (isClose) {
        return { reply, options: null };
      }

      const sessionWithReply = {
        messages: [
          ...session.messages,
          {
            role: "assistant",
            content: reply,
            status: "done",
          },
        ],
      };

      try {
        const options = await generateOptions({
          character,
          archetype,
          session: sessionWithReply,
          signal,
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
    requestCombinedTurn,
  };
})();
