(function () {
  const OPTION_SCHEMA = [
    { id: 1, intent: "keypoint", label: "要点" },
    { id: 2, intent: "followup", label: "追问" },
    { id: 3, intent: "pivot", label: "换题" },
    { id: 4, intent: "close", label: "收束" },
  ];

  const OPTIONS_SYSTEM = `你是文字冒险游戏的选项撰稿人。根据对话上下文，为玩家生成 4 条可点击的短句。
必须严格只输出 JSON 数组，恰好 4 个元素，顺序与 intent 固定：
[
  {"intent":"keypoint","line":"..."},
  {"intent":"followup","line":"..."},
  {"intent":"pivot","line":"..."},
  {"intent":"close","line":"..."}
]
要求：
- 每条 line 为中文一句，不超过 35 字，带具体锚点，不要寒暄
- keypoint：要关键信息或立场；followup：必须引用「角色上一句」中的具体词；pivot：换到另一个具体议题；close：结束对话
- 只输出 JSON，不要 markdown 或其它说明`;

  function fallbackOptions(archetype) {
    return OPTION_SCHEMA.map((meta) => {
      const preset = archetype.options.find((o) => o.intent === meta.intent);
      return {
        ...meta,
        line: preset?.line || meta.label,
        send: preset?.send || `[intent:${meta.intent}] ${preset?.line || meta.label}`,
      };
    });
  }

  function parseOptionsJson(raw, archetype) {
    const text = String(raw || "").trim();
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) {
      throw new Error("未找到 JSON 数组");
    }
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed) || parsed.length < 4) {
      throw new Error("JSON 元素不足 4 条");
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

  async function generateOptions({ character, archetype, session, signal }) {
    const { lastLine: lastFromHistory, priorText } =
      window.GameDialogue.formatRecentDialogueForOptions(session.messages);
    const lastLine = lastFromHistory || archetype.opening;

    const userContent = `角色名：${character.name}
角色上一句台词：${lastLine}
${priorText ? `最近对话：\n${priorText}` : ""}

请生成四轮玩家选项 JSON。`;

    window.PomDebug?.logRequest("生成选项", {
      system: OPTIONS_SYSTEM.slice(0, 80) + "…",
      user: userContent,
    });

    const raw = await window.ChatApi.completeChat({
      systemPrompt: OPTIONS_SYSTEM,
      messages: [{ role: "user", content: userContent }],
      temperature: 0.65,
      max_tokens: 280,
      signal,
    });

    window.PomDebug?.logResponse("生成选项", raw);

    try {
      return parseOptionsJson(raw, archetype);
    } catch (e) {
      window.PomDebug?.log("选项 JSON 解析失败，使用预设兜底", e.message);
      return fallbackOptions(archetype);
    }
  }

  window.GameOptionsAi = {
    OPTION_SCHEMA,
    generateOptions,
    fallbackOptions,
  };
})();
