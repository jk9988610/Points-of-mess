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
        content: "你好！我是基于 DeepSeek 的 AI 助手。直接打开本页面即可聊天，无需安装 Node。",
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
