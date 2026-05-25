import { streamChat } from "./api.js";
import {
  createId,
  createInitialState,
  getApiMessages,
  resetMessages,
  saveToStorage,
} from "./state.js";
import { renderMessages, setStatusBanner, updateMessageContent } from "./render.js";

const messagesEl = document.querySelector("#messages");
const formEl = document.querySelector("#chatForm");
const inputEl = document.querySelector("#messageInput");
const sendButtonEl = document.querySelector("#sendButton");
const clearButtonEl = document.querySelector("#clearChat");
const stopButtonEl = document.querySelector("#stopGeneration");
const statusBannerEl = document.querySelector("#statusBanner");

const state = createInitialState();
let abortController = null;

function persist() {
  saveToStorage(state.messages);
}

function setComposerEnabled(enabled) {
  inputEl.disabled = !enabled;
  sendButtonEl.disabled = !enabled || inputEl.value.trim().length === 0;
  clearButtonEl.disabled = !enabled;
  stopButtonEl.disabled = enabled;
}

function refreshUI({ stickToBottom = true } = {}) {
  renderMessages(messagesEl, state.messages, { stickToBottom });
  setStatusBanner(statusBannerEl, state.error, { isError: Boolean(state.error) });
  setComposerEnabled(!state.isStreaming);
}

function setSendButtonState() {
  sendButtonEl.disabled = state.isStreaming || inputEl.value.trim().length === 0;
}

async function sendMessage(text) {
  const userMessage = {
    id: createId(),
    role: "user",
    content: text,
    createdAt: Date.now(),
    status: "done",
  };

  const assistantMessage = {
    id: createId(),
    role: "assistant",
    content: "",
    createdAt: Date.now(),
    status: "streaming",
  };

  state.messages.push(userMessage, assistantMessage);
  state.isStreaming = true;
  state.error = null;
  refreshUI();
  persist();

  abortController = new AbortController();

  try {
    await streamChat({
      messages: getApiMessages(state.messages.slice(0, -1)),
      signal: abortController.signal,
      onDelta(chunk) {
        assistantMessage.content += chunk;
        updateMessageContent(
          messagesEl,
          assistantMessage.id,
          assistantMessage.content,
          true
        );
      },
    });

    assistantMessage.status = "done";
  } catch (error) {
    if (error.name === "AbortError") {
      assistantMessage.status = "done";
      if (!assistantMessage.content) {
        assistantMessage.content = "（已停止生成）";
      }
    } else {
      assistantMessage.status = "error";
      assistantMessage.content = error.message || "生成失败，请稍后重试。";
      state.error = assistantMessage.content;
    }
  } finally {
    state.isStreaming = false;
    abortController = null;
    refreshUI();
    persist();
    inputEl.focus();
  }
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.isStreaming) {
    return;
  }

  const text = inputEl.value.trim();
  if (!text) {
    return;
  }

  inputEl.value = "";
  inputEl.style.height = "auto";
  setSendButtonState();
  sendMessage(text);
});

inputEl.addEventListener("input", () => {
  setSendButtonState();
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 140)}px`;
});

inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    formEl.requestSubmit();
  }
});

stopButtonEl.addEventListener("click", () => {
  abortController?.abort();
});

clearButtonEl.addEventListener("click", () => {
  if (state.isStreaming) {
    abortController?.abort();
  }
  state.messages = resetMessages();
  state.error = null;
  persist();
  refreshUI();
  inputEl.focus();
});

refreshUI();
inputEl.focus();
