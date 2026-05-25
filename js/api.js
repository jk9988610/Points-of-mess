(function () {
  function getConfig() {
    const cfg = window.DEEPSEEK_CONFIG;
    if (!cfg?.apiKey || cfg.apiKey.includes("你的_")) {
      throw new Error("请先在 js/config.js 中填写 DeepSeek API 密钥。");
    }
    return cfg;
  }

  async function streamChat({ messages, onDelta, signal }) {
    const cfg = getConfig();

    const response = await fetch(cfg.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "system", content: cfg.systemPrompt }, ...messages],
        stream: true,
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
      throw new Error(message);
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

  window.ChatApi = { streamChat };
})();
