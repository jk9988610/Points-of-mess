(function () {
  function getConfig() {
    const status = window.PomConfig?.getConfigStatus?.();
    if (status && !status.ok) {
      throw new Error(status.message);
    }
    const cfg = window.DEEPSEEK_CONFIG;
    const apiKey = window.PomAuth?.getApiKey?.() || cfg?.apiKey;
    if (!apiKey) {
      throw new Error(window.PomConfig?.getSetupMessage?.() || "请先登录并填写密钥。");
    }
    return { ...cfg, apiKey };
  }

  function isAuthErrorMessage(message, status) {
    const text = String(message || "").toLowerCase();
    return (
      status === 401 ||
      text.includes("authentication") ||
      text.includes("api key") ||
      text.includes("invalid") ||
      text.includes("unauthorized")
    );
  }

  function raiseApiError(status, message) {
    if (isAuthErrorMessage(message, status)) {
      window.PomAuth?.onApiKeyRejected?.(message);
    }
    throw new Error(message);
  }

  function buildMessageList(systemPrompt, messages) {
    const sys = String(systemPrompt ?? "").trim();
    if (sys) {
      return [{ role: "system", content: sys }, ...messages];
    }
    return [...messages];
  }

  async function streamChat({
    systemPrompt,
    messages,
    messagesOnly,
    onDelta,
    signal,
    temperature,
    max_tokens,
  }) {
    const cfg = getConfig();
    const messageList = messagesOnly
      ? [...messages]
      : buildMessageList(systemPrompt, messages);

    const response = await fetch(cfg.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: messageList,
        stream: true,
        temperature: temperature ?? cfg.temperature ?? 0.6,
        max_tokens: max_tokens ?? cfg.maxTokens ?? 80,
      }),
      signal,
    });

    if (!response.ok) {
      let message = `请求失败 (${response.status})`;
      try {
        const data = await response.json();
        message = data.error?.message || data.message || message;
      } catch {
        /* non-json */
      }
      raiseApiError(response.status, message);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          continue;
        }
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            onDelta(delta);
          }
        } catch {
          /* ignore malformed chunks */
        }
      }
    }
  }

  async function completeChat({
    systemPrompt,
    messages,
    signal,
    temperature,
    max_tokens,
    response_format,
  }) {
    const cfg = getConfig();

    const body = {
      model: cfg.model,
      messages: buildMessageList(systemPrompt, messages),
      stream: false,
      temperature: temperature ?? cfg.temperature ?? 0.6,
      max_tokens: max_tokens ?? cfg.maxTokens ?? 80,
    };
    if (response_format) {
      body.response_format = response_format;
    }

    const response = await fetch(cfg.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      let message = `请求失败 (${response.status})`;
      try {
        const data = await response.json();
        message = data.error?.message || data.message || message;
      } catch {
        /* non-json */
      }
      raiseApiError(response.status, message);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const content = String(choice?.message?.content ?? "").trim();
    if (!content) {
      const reason = choice?.finish_reason || "unknown";
      throw new Error(`API 返回为空 (finish_reason=${reason})`);
    }
    return content;
  }

  window.ChatApi = { streamChat, completeChat };
})();
