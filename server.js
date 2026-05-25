import "dotenv/config";
import express from "express";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

const SYSTEM_PROMPT = `你是一个友好、专业的 AI 助手。请用简洁清晰的中文回答用户问题。
若用户用其他语言提问，可沿用该语言回复。不确定时请诚实说明，不要编造事实。`;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "未配置 DEEPSEEK_API_KEY，请在 .env 中设置。" });
    return;
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages 不能为空。" });
    return;
  }

  const payload = {
    model: MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    stream: true,
  };

  let upstream;
  try {
    upstream = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: req.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      res.status(499).end();
      return;
    }
    res.status(502).json({ error: "无法连接 DeepSeek API。" });
    return;
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    res.status(upstream.status).json({
      error: "DeepSeek API 返回错误。",
      detail: detail.slice(0, 500),
    });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  req.on("close", () => {
    reader.cancel().catch(() => {});
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(502).json({ error: "流式传输中断。" });
      return;
    }
    res.end();
  }
});

function getLanAddresses() {
  const addresses = new Set();
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const iface of interfaces || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.add(iface.address);
      }
    }
  }
  return [...addresses];
}

app.listen(PORT, HOST, () => {
  console.log(`Chat server listening on ${HOST}:${PORT}`);
  console.log("");
  console.log("【Pad 测试】请在 Safari 打开（不要从「文件」点 index.html）：");
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  说明页: http://localhost:${PORT}/pad-help.html`);
  const lan = getLanAddresses();
  if (lan.length > 0) {
    console.log("");
    console.log("同一 Wi‑Fi 下其他设备可访问:");
    for (const ip of lan) {
      console.log(`  http://${ip}:${PORT}`);
    }
  }
  console.log("");
  console.log("首次使用请看项目根目录：打开我.md");
});
