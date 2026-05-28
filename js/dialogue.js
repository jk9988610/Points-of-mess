(function () {
  /** 仅用于调试文案；发给 API 的 messages 不再按轮次/字数裁剪 */
  const HISTORY_TURNS = 2;
  const OPTIONS_HISTORY_TURNS = 3;

  function stripIntentTag(send) {
    return send.replace(/^\[intent:\w+\]\s*/, "");
  }

  function getDoneMessages(sessionMessages) {
    return sessionMessages.filter(
      (m) =>
        m.status !== "error" &&
        (m.role === "user" || m.role === "assistant") &&
        m.intent !== "pause" &&
        m.intent !== "suspend"
    );
  }

  /** 本局全部已完成对白（发给 ①reply / 合并路径，不裁剪） */
  function getHistoryForApi(sessionMessages) {
    return getDoneMessages(sessionMessages).map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  function getHistorySliceForOptions(sessionMessages) {
    return getDoneMessages(sessionMessages);
  }

  function formatDialogueLine(m, characterName) {
    const label = m.role === "user" ? "证辩者" : characterName;
    return `${label}: ${m.content}`;
  }

  /**
   * 与 getHistoryForApi 分离窗口；最近对话不含「角色上一句」，避免重复送入选项 prompt。
   * @param {object} [opts]
   * @param {number} [opts.maxTurns]
   * @param {string} [opts.characterName]
   */
  function formatRecentDialogueForOptions(sessionMessages, opts = {}) {
    const characterName = opts.characterName ?? "证官";
    const history = getHistorySliceForOptions(sessionMessages);
    if (history.length === 0) {
      return { lastLine: "", priorText: "" };
    }
    const last = history[history.length - 1];
    if (last.role === "assistant") {
      const prior = history.slice(0, -1);
      return {
        lastLine: last.content.trim(),
        priorText: prior.map((m) => formatDialogueLine(m, characterName)).join("\n"),
      };
    }
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
    return {
      lastLine: lastAssistant?.content?.trim() || "",
      priorText: history.map((m) => formatDialogueLine(m, characterName)).join("\n"),
    };
  }

  window.GameDialogue = {
    HISTORY_TURNS,
    OPTIONS_HISTORY_TURNS,
    stripIntentTag,
    getHistoryForApi,
    formatRecentDialogueForOptions,
    getDoneMessages,
  };
})();
