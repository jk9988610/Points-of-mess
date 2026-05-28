(function () {
  function formatTime(timestamp) {
    const t = Number(timestamp);
    if (!t || Number.isNaN(t)) {
      return "";
    }
    return new Date(t).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function displayText(message) {
    if (!message) {
      return "";
    }
    if (message.role === "user") {
      const line = String(
        message.displayLine || message.pickedLine || message.content || ""
      ).trim();
      return line.replace(/^\[intent:\w+\]\s*/i, "");
    }
    return String(message.content || "").trim();
  }

  function render(container, messages, labels) {
    if (!container) {
      return;
    }
    const playerLabel = labels?.playerLabel || "证辩者";
    const npcLabel = labels?.npcLabel || "证官";
    const stickToBottom = labels?.stickToBottom === true;
    const wasAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 48;

    const list = Array.isArray(messages)
      ? messages.filter((m) => {
          if (m.role !== "user" && m.role !== "assistant") {
            return false;
          }
          if (m.status === "streaming") {
            return true;
          }
          return Boolean(displayText(m));
        })
      : [];

    container.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "dialogue-log__empty";
      empty.textContent = labels?.emptyText || "尚无对白记录";
      container.appendChild(empty);
      if (stickToBottom || wasAtBottom) {
        container.scrollTop = container.scrollHeight;
      }
      return;
    }

    for (const message of list) {
      const isUser = message.role === "user";
      const row = document.createElement("article");
      row.className = `dialogue-log__row dialogue-log__row--${isUser ? "user" : "npc"}`;
      row.dataset.messageId = message.id || "";

      const meta = document.createElement("div");
      meta.className = "dialogue-log__meta";
      const name = document.createElement("span");
      name.className = "dialogue-log__name";
      name.textContent = isUser ? playerLabel : npcLabel;
      const time = document.createElement("time");
      time.className = "dialogue-log__time";
      time.dateTime = message.createdAt
        ? new Date(message.createdAt).toISOString()
        : "";
      time.textContent = formatTime(message.createdAt);
      meta.append(name, time);

      const bubble = document.createElement("div");
      bubble.className = "dialogue-log__bubble";
      const text = document.createElement("p");
      text.className = "dialogue-log__text";
      const body =
        message.status === "streaming" && !displayText(message)
          ? "…"
          : displayText(message);
      text.textContent = body;
      bubble.appendChild(text);

      if (message.status === "streaming") {
        row.classList.add("dialogue-log__row--streaming");
      }
      if (message.status === "error") {
        row.classList.add("dialogue-log__row--error");
      }

      row.append(meta, bubble);
      container.appendChild(row);
    }

    if (stickToBottom || wasAtBottom) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }

  window.GameDialogueLog = {
    formatTime,
    displayText,
    render,
  };
})();
