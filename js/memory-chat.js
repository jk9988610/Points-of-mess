(function () {
  function buildFreeformSystem(archetype) {
    return `你是「${archetype.name || "锋利"}」。玩家在用自由输入做记忆测试。

【事实约束 — 优先于角色表演】
- 你只能根据本次请求里 messages 中**实际出现**的内容回答。
- 若玩家问「第 N 轮原话」等而 messages 里没有那些对白：直接说「我这次请求里看不到那段对白」，不要编造原话，不要用角色嘴硬糊弄过去。
- 若 messages 里**有**完整对白，则如实引用或复述。
- 不要声称「大模型自动存档」或「我这边完全没存」——你只知道自己这次收到了什么。

【角色】
${archetype.system}

【输出】
1～3 句，短，不要 JSON、不要 markdown。`;
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
