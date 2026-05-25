const STORAGE_KEY = "points-of-mess-chat-v1";

export function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const starterMessages = [
  {
    id: createId(),
    role: "assistant",
    content: "你好！我是基于 DeepSeek 的 AI 助手。有什么想聊的，直接输入即可。",
    createdAt: Date.now(),
    status: "done",
  },
];

export function createInitialState() {
  const saved = loadFromStorage();
  return {
    messages: saved?.messages?.length ? saved.messages : [...starterMessages],
    isStreaming: false,
    error: null,
  };
}

export function getApiMessages(messages) {
  return messages
    .filter((m) => m.status === "done" && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: m.content }));
}

export function loadFromStorage() {
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

export function saveToStorage(messages) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages: messages.filter((m) => m.status !== "error"),
        savedAt: Date.now(),
      })
    );
  } catch {
    /* quota or private mode */
  }
}

export function resetMessages() {
  return [...starterMessages.map((m) => ({ ...m, id: createId(), createdAt: Date.now() }))];
}
