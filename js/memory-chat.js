(function () {
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
    formatLocalTranscript,
  };
})();
