(function () {
  const HISTORY_TURNS = 2;

  function stripIntentTag(send) {
    return send.replace(/^\[intent:\w+\]\s*/, "");
  }

  function buildChoicesBlock(options) {
    return options
      .map((o) => `${o.id} ${o.label} → 「${o.line}」`)
      .join("\n");
  }

  function buildGameUserMessage(character, options, pick) {
    return `[game]
character: ${character.name}

[choices]
${buildChoicesBlock(options)}

[player_pick]
id: ${pick.id}
intent: ${pick.intent}
line: 「${pick.line}」

[reply_rule]
只输出角色台词。短。禁止寒暄。收束轮禁止新问题。`;
  }

  function getHistoryForApi(sessionMessages) {
    const done = sessionMessages.filter(
      (m) => m.status !== "error" && (m.role === "user" || m.role === "assistant")
    );
    const maxMessages = HISTORY_TURNS * 2;
    return done.slice(-maxMessages).map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  window.GameDialogue = {
    HISTORY_TURNS,
    stripIntentTag,
    buildGameUserMessage,
    getHistoryForApi,
  };
})();
