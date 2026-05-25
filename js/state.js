(function () {
  const STORAGE_KEY = "points-of-mess-chat-v1";

  function createId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function buildStarterMessages() {
    return [
      {
        id: createId(),
        role: "assistant",
        content:
          "欢迎来到 Points-of-mess。\n\n这里专门收留乱糟糟的想法——你不用先整理，直接把碎片、吐槽、没想清楚的问题扔进来。我会帮你从中捞出几条说得清的「要点」。\n\n发点什么吧，越乱越好。",
        createdAt: Date.now(),
        status: "done",
      },
    ];
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  window.ChatState = {
    createId,
    buildStarterMessages,
    createInitialState() {
      const saved = loadFromStorage();
      return {
        messages: saved?.messages?.length ? saved.messages : buildStarterMessages(),
        isStreaming: false,
        error: null,
      };
    },
    getApiMessages(messages) {
      return messages
        .filter((m) => m.status === "done" && (m.role === "user" || m.role === "assistant"))
        .map((m) => ({ role: m.role, content: m.content }));
    },
    saveToStorage(messages) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            messages: messages.filter((m) => m.status !== "error"),
            savedAt: Date.now(),
          })
        );
      } catch {
        /* private mode or quota */
      }
    },
    resetMessages() {
      return buildStarterMessages();
    },
  };
})();
