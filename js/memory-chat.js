(function () {
  function buildFreeformSystem(archetype) {
    return `${archetype.system}

【自由输入 / 记忆测试】
玩家用自由文字提问（可能问及本局更早轮次）。你只输出角色口吻的短答，1～3 句，不要 JSON、不要 markdown。
若你实际上看不到此前对白，而玩家问的是「第几轮说了什么」类问题，必须先明确一句「我这边看不到之前的对话」，再简短回应。`;
  }

  function formatLocalTranscript(sessionMessages) {
    const done = sessionMessages.filter(
      (m) => m.status !== "error" && (m.role === "user" || m.role === "assistant")
    );
    if (done.length === 0) {
      return "（尚无记录）";
    }
    return done
      .map((m, i) => {
        const who = m.role === "assistant" ? "锋利" : "玩家";
        const tag = m.intent === "freeform" ? " [自由输入]" : "";
        return `${i + 1}. ${who}${tag}: ${m.content}`;
      })
      .join("\n");
  }

  window.GameMemoryChat = {
    buildFreeformSystem,
    formatLocalTranscript,
  };
})();
