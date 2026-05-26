(function () {
  const OPTION_SCHEMA = [
    { id: 1, intent: "keypoint", label: "要点" },
    { id: 2, intent: "followup", label: "追问" },
    { id: 3, intent: "pivot", label: "换题" },
    { id: 4, intent: "close", label: "收束" },
  ];

  function buildCombinedSystem(archetype) {
    return `${archetype.system}

【输出格式】只输出一个 JSON 对象，不要 markdown 或其它说明。
玩家本轮未选收束时：
{"reply":"角色台词","options":[{"intent":"keypoint","line":"..."},{"intent":"followup","line":"..."},{"intent":"pivot","line":"..."},{"intent":"close","line":"..."}]}
玩家本轮选收束时：
{"reply":"角色落款"}（不要 options 字段）

reply：1～2 句，≤40 字。options 每条 line ≤35 字、带具体锚点；followup 必须引用你本条 reply 中的具体词。`;
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

  function fallbackOptions(archetype) {
    return presetOptions(archetype);
  }

  function extractJsonObject(raw) {
    const text = String(raw || "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error("未找到 JSON 对象");
    }
    return JSON.parse(text.slice(start, end + 1));
  }

  function optionsFromArray(items, archetype) {
    const parsed = Array.isArray(items) ? items : [];
    if (parsed.length < 4) {
      throw new Error("options 不足 4 条");
    }
    return OPTION_SCHEMA.map((meta, i) => {
      const item = parsed.find((p) => p.intent === meta.intent) || parsed[i];
      const line = String(item?.line || "").trim();
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

  function parseCombinedResponse(raw, archetype, isClose) {
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
      options: optionsFromArray(obj.options, archetype),
    };
  }

  async function requestCombinedTurn({
    archetype,
    apiMessages,
    isClose,
    signal,
  }) {
    const systemPrompt = buildCombinedSystem(archetype);
    window.PomDebug?.logRequest(isClose ? "角色收束" : "角色回复+选项", {
      system: systemPrompt.slice(0, 80) + "…",
      messages: apiMessages,
    });

    const raw = await window.ChatApi.completeChat({
      systemPrompt,
      messages: apiMessages,
      temperature: 0.6,
      max_tokens: isClose ? 80 : 380,
      signal,
    });

    window.PomDebug?.logResponse(isClose ? "角色收束" : "角色回复+选项", raw);

    try {
      return parseCombinedResponse(raw, archetype, isClose);
    } catch (e) {
      window.PomDebug?.log("合并 JSON 解析失败", e.message);
      if (isClose) {
        return { reply: raw.trim().slice(0, 80) || "……", options: null };
      }
      const reply = raw.trim().split("\n")[0].slice(0, 40) || "……";
      return { reply, options: fallbackOptions(archetype) };
    }
  }

  window.GameOptionsAi = {
    OPTION_SCHEMA,
    presetOptions,
    fallbackOptions,
    requestCombinedTurn,
  };
})();
