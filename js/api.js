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

  function inferApiTags(label, direction) {
    const s = String(label || "");
    const tags = [direction === "out" ? "api-out" : "api-in"];
    if (/reply|①|角色回复|结束对话|结局·①|失败·①/.test(s)) {
      tags.push("api-reply");
      tags.push(direction === "out" ? "api-reply-out" : "api-reply-in");
    } else if (/选项|②|结局·②/.test(s)) {
      tags.push("api-options");
      tags.push(direction === "out" ? "api-options-out" : "api-options-in");
    } else if (/摘要|③/.test(s)) {
      tags.push("api-summary");
      tags.push(direction === "out" ? "api-summary-out" : "api-summary-in");
    } else if (/输入框/.test(s)) {
      tags.push("api-freeform");
      tags.push(direction === "out" ? "api-freeform-out" : "api-freeform-in");
    } else if (/合并/.test(s)) {
      tags.push("api-combined");
      tags.push(direction === "out" ? "api-combined-out" : "api-combined-in");
    } else {
      tags.push("api-other");
      tags.push(direction === "out" ? "api-other-out" : "api-other-in");
    }
    return tags;
  }

  function formatRequestLog(cfg, messageList, extra) {
    return JSON.stringify(
      {
        model: cfg.model,
        apiUrl: cfg.apiUrl,
        stream: extra.stream ?? false,
        temperature: extra.temperature,
        max_tokens: extra.max_tokens,
        response_format: extra.response_format ?? null,
        messages: messageList,
      },
      null,
      2
    );
  }

  async function streamChat({
    systemPrompt,
    messages,
    messagesOnly,
    onDelta,
    signal,
    temperature,
    max_tokens,
    debugLabel = "输入框→AI",
    debugAttempt,
  }) {
    const cfg = getConfig();
    const messageList = messagesOnly
      ? [...messages]
      : buildMessageList(systemPrompt, messages);
    const temp = temperature ?? cfg.temperature ?? 0.6;
    const maxTok = max_tokens ?? cfg.maxTokens ?? 80;
    const logTitle = debugAttempt ? `${debugLabel} · ${debugAttempt}` : debugLabel;

    window.PomDebug?.logRequest(
      logTitle,
      formatRequestLog(cfg, messageList, {
        stream: true,
        temperature: temp,
        max_tokens: maxTok,
      }),
      inferApiTags(debugLabel, "out")
    );

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
        temperature: temp,
        max_tokens: maxTok,
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
      window.PomDebug?.logLocalWarn(`API 失败 · ${logTitle}`, message, ["ui-warn", "api"]);
      raiseApiError(response.status, message);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

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
          window.PomDebug?.logResponse(
            logTitle,
            fullText,
            inferApiTags(debugLabel, "in")
          );
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onDelta(delta);
          }
        } catch {
          /* ignore malformed chunks */
        }
      }
    }

    window.PomDebug?.logResponse(logTitle, fullText, inferApiTags(debugLabel, "in"));
  }

  async function completeChat({
    systemPrompt,
    messages,
    signal,
    temperature,
    max_tokens,
    response_format,
    debugLabel = "API",
    debugAttempt,
  }) {
    const cfg = getConfig();
    const messageList = buildMessageList(systemPrompt, messages);
    const temp = temperature ?? cfg.temperature ?? 0.6;
    const maxTok = max_tokens ?? cfg.maxTokens ?? 80;
    const logTitle = debugAttempt ? `${debugLabel} · ${debugAttempt}` : debugLabel;

    window.PomDebug?.logRequest(
      logTitle,
      formatRequestLog(cfg, messageList, {
        stream: false,
        temperature: temp,
        max_tokens: maxTok,
        response_format: response_format || null,
      }),
      inferApiTags(debugLabel, "out")
    );

    const body = {
      model: cfg.model,
      messages: messageList,
      stream: false,
      temperature: temp,
      max_tokens: maxTok,
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
      window.PomDebug?.logLocalWarn(`API 失败 · ${logTitle}`, message, ["ui-warn", "api"]);
      raiseApiError(response.status, message);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const content = String(choice?.message?.content ?? "").trim();
    if (!content) {
      const reason = choice?.finish_reason || "unknown";
      const err = new Error(`API 返回为空 (finish_reason=${reason})`);
      window.PomDebug?.logLocalWarn(`API 空返回 · ${logTitle}`, err.message, [
        "ui-warn",
        "api",
      ]);
      throw err;
    }

    window.PomDebug?.logResponse(logTitle, content, inferApiTags(debugLabel, "in"));
    return content;
  }

  window.ChatApi = { streamChat, completeChat, inferApiTags };
})();
