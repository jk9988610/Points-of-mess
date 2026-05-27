(function () {
  const HISTORY_TURNS = 2;
  /** 选项 API 专用：比 reply 多 1 轮上下文，不抬高 HISTORY_TURNS */
  const OPTIONS_HISTORY_TURNS = 3;
  /** 最近对白总字数上限（约估 token；中文可粗算 1 字 ≈ 1 token） */
  const HISTORY_MAX_CHARS = 1400;

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

  function historyCharCount(messages) {
    return messages.reduce((n, m) => n + String(m.content || "").length, 0);
  }

  /** 最近 N 轮原话；超出字数则从最早一条裁掉（不发明细全文） */
  function getHistoryForApi(sessionMessages) {
    const maxMessages = HISTORY_TURNS * 2;
    let slice = getDoneMessages(sessionMessages).slice(-maxMessages);
    while (slice.length > 2 && historyCharCount(slice) > HISTORY_MAX_CHARS) {
      slice = slice.slice(1);
    }
    return slice.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  function getHistorySliceForOptions(sessionMessages, maxTurns) {
    const maxMessages = maxTurns * 2;
    let slice = getDoneMessages(sessionMessages).slice(-maxMessages);
    while (slice.length > 2 && historyCharCount(slice) > HISTORY_MAX_CHARS) {
      slice = slice.slice(1);
    }
    return slice;
  }

  function formatDialogueLine(m, characterName) {
    const label = m.role === "user" ? "玩家" : characterName;
    return `${label}: ${m.content}`;
  }

  /**
   * 与 getHistoryForApi 分离窗口；最近对话不含「角色上一句」，避免重复送入选项 prompt。
   * @param {object} [opts]
   * @param {number} [opts.maxTurns]
   * @param {string} [opts.characterName]
   */
  function formatRecentDialogueForOptions(sessionMessages, opts = {}) {
    const maxTurns = opts.maxTurns ?? OPTIONS_HISTORY_TURNS;
    const characterName = opts.characterName ?? "锋利";
    const history = getHistorySliceForOptions(sessionMessages, maxTurns);
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
    HISTORY_MAX_CHARS,
    stripIntentTag,
    getHistoryForApi,
    formatRecentDialogueForOptions,
    getDoneMessages,
  };
})();
