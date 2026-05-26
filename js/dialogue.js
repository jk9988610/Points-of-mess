(function () {
  const HISTORY_TURNS = 2;

  function stripIntentTag(send) {
    return send.replace(/^\[intent:\w+\]\s*/, "");
  }

  function getDoneMessages(sessionMessages) {
    return sessionMessages.filter(
      (m) => m.status !== "error" && (m.role === "user" || m.role === "assistant")
    );
  }

  function buildChoicesBlock(options) {
    return options
      .map((o) => `${o.intent} → ${o.line}`)
      .join("\n");
  }

  function buildGameUserMessage(character, options, pick, formatOpts) {
    const jsonMode = formatOpts?.jsonMode;
    const outputRule = jsonMode
      ? '只输出一个 JSON 对象：含 reply；非收束轮含 options（四条 intent 分别为 keypoint、followup、pivot、close）。禁止 markdown、禁止代码块。options 的 line 为玩家口语一句，不要外加「」引号；followup 须引用本条 reply 中的具体词。'
      : "只输出角色台词。短。禁止寒暄。收束轮禁止新问题。";

    return [
      "[game]",
      `character: ${character.name}`,
      "",
      "[choices]",
      buildChoicesBlock(options),
      "",
      "[player_pick]",
      `intent: ${pick.intent}`,
      `line: ${pick.line}`,
      "",
      "[output]",
      outputRule,
    ].join("\n");
  }

  function getHistoryForApi(sessionMessages) {
    const maxMessages = HISTORY_TURNS * 2;
    return getDoneMessages(sessionMessages)
      .slice(-maxMessages)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));
  }

  /** 与 getHistoryForApi 同窗口；最近对话不含「角色上一句」，避免重复送入选项 prompt */
  function formatRecentDialogueForOptions(sessionMessages) {
    const history = getHistoryForApi(sessionMessages);
    if (history.length === 0) {
      return { lastLine: "", priorText: "" };
    }
    const last = history[history.length - 1];
    if (last.role === "assistant") {
      const prior = history.slice(0, -1);
      return {
        lastLine: last.content.trim(),
        priorText: prior.map((m) => `${m.role}: ${m.content}`).join("\n"),
      };
    }
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
    return {
      lastLine: lastAssistant?.content?.trim() || "",
      priorText: history.map((m) => `${m.role}: ${m.content}`).join("\n"),
    };
  }

  window.GameDialogue = {
    HISTORY_TURNS,
    stripIntentTag,
    buildGameUserMessage,
    getHistoryForApi,
    formatRecentDialogueForOptions,
    getDoneMessages,
  };
})();
