export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role) {
  if (role === "user") {
    return "你";
  }
  if (role === "assistant") {
    return "AI";
  }
  return "?";
}

function rowClassName(message) {
  const classes = ["message-row", message.role];
  if (message.status === "streaming") {
    classes.push("streaming");
  }
  if (message.status === "error") {
    classes.push("error");
  }
  return classes.join(" ");
}

export function renderMessages(container, messages, { stickToBottom = true } = {}) {
  const wasAtBottom =
    stickToBottom &&
    container.scrollHeight - container.scrollTop - container.clientHeight < 80;

  container.innerHTML = "";

  for (const message of messages) {
    const row = document.createElement("article");
    row.className = rowClassName(message);
    row.dataset.messageId = message.id;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = roleLabel(message.role);

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const text = document.createElement("div");
    text.className = "bubble-text";
    text.textContent = message.content || (message.status === "streaming" ? "…" : "");

    const time = document.createElement("div");
    time.className = "time";
    time.textContent = formatTime(message.createdAt);

    bubble.append(text, time);
    row.append(avatar, bubble);
    container.appendChild(row);
  }

  if (wasAtBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

export function updateMessageContent(container, messageId, content, isStreaming) {
  const row = container.querySelector(`[data-message-id="${messageId}"]`);
  if (!row) {
    return;
  }
  const textEl = row.querySelector(".bubble-text");
  if (textEl) {
    textEl.textContent = content || (isStreaming ? "…" : "");
  }
  row.classList.toggle("streaming", isStreaming);
  container.scrollTop = container.scrollHeight;
}

export function setStatusBanner(bannerEl, text, { isError = false } = {}) {
  if (!text) {
    bannerEl.classList.remove("visible", "error");
    bannerEl.textContent = "";
    return;
  }
  bannerEl.textContent = text;
  bannerEl.classList.add("visible");
  bannerEl.classList.toggle("error", isError);
}
