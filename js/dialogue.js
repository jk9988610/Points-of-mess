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

  /** 完整对白写入 [dialogue]；当前轮玩家句已在 [player_pick]，故默认排除最后一条 user */
  function buildDialogueHistoryBlock(sessionMessages, characterName, { excludeCurrentPick } = {}) {
    let done = getDoneMessages(sessionMessages);
    if (
      excludeCurrentPick &&
      done.length > 0 &&
      done[done.length - 1].role === "user"
    ) {
      done = done.slice(0, -1);
    }
    if (done.length === 0) {
      return "";
    }
    return done
      .map((m) => {
        if (m.role === "assistant") {
          return `${characterName}: ${m.content}`;
        }
        const tag = m.intent ? `[${m.intent}] ` : "";
        return `玩家${tag}: ${m.content}`;
      })
      .join("\n");
  }

  function buildGameUserMessage(character, sessionMessages, options, pick, formatOpts) {
    const jsonMode = formatOpts?.jsonMode;
    const dialogue = buildDialogueHistoryBlock(sessionMessages, character.name, {
      excludeCurrentPick: true,
    });
    const outputRule = jsonMode
      ? '只输出一个 JSON 对象：含 reply；非收束轮含 options（四条 intent 分别为 keypoint、followup、pivot、close）。禁止 markdown、禁止代码块。options 的 line 为玩家口语一句，不要外加「」引号；followup 须引用本条 reply 中的具体词。'
      : "只输出角色台词。短。禁止寒暄。收束轮禁止新问题。";

    const parts = [
      "[game]",
      `character: ${character.name}`,
      "",
    ];

    if (dialogue) {
      parts.push("[dialogue]", dialogue, "");
    }

    parts.push(
      "[choices]",
      buildChoicesBlock(options),
      "",
      "[player_pick]",
      `intent: ${pick.intent}`,
      `line: ${pick.line}`,
      "",
      "[output]",
      outputRule
    );

    return parts.join("\n");
  }

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
    buildDialogueHistoryBlock,
    formatRecentDialogueForOptions,
    getDoneMessages,
  };
})();
