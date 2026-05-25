/**
 * 流式调用后端 /api/chat，解析 DeepSeek SSE。
 * @param {object} options
 * @param {Array<{role: string, content: string}>} options.messages
 * @param {function(string): void} options.onDelta
 * @param {AbortSignal} [options.signal]
 */
export async function streamChat({ messages, onDelta, signal }) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!response.ok) {
    let message = `请求失败 (${response.status})`;
    try {
      const data = await response.json();
      message = data.error || message;
    } catch {
      /* non-json body */
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
