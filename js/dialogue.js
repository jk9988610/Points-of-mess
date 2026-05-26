(function () {
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

  /** 仅本轮：不含历史对白（由调用端/平台自动附带会话上下文） */
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

  /** 选项兜底 API 用；主流程合并请求不发送历史 */
  function formatRecentDialogueForOptions(sessionMessages, characterName) {
    const done = getDoneMessages(sessionMessages);
    if (done.length === 0) {
      return { lastLine: "", priorText: "" };
    }
    const lastAssistant = [...done].reverse().find((m) => m.role === "assistant");
    const lastLine = lastAssistant?.content?.trim() || "";
    const name = characterName || "角色";
    const priorText = done
      .map((m) => {
        if (m.role === "assistant") {
          return `${name}: ${m.content}`;
        }
        const tag = m.intent ? `[${m.intent}] ` : "";
        return `玩家${tag}: ${m.content}`;
      })
      .join("\n");
    return { lastLine, priorText };
  }

  window.GameDialogue = {
    stripIntentTag,
    buildGameUserMessage,
    formatRecentDialogueForOptions,
    getDoneMessages,
  };
})();
