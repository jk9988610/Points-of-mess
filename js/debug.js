(function () {
  const MAX_ENTRIES = 120;
  const entries = [];
  const plainLines = [];

  /** @typedef {'ai-out'|'ai-in'|'local'|'local-warn'|'local-error'} Audience */

  function ts() {
    return new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function audienceLabel(audience) {
    if (audience === "ai-out") {
      return "发AI";
    }
    if (audience === "ai-in") {
      return "AI回";
    }
    if (audience === "local-error") {
      return "本地·错";
    }
    if (audience === "local-warn") {
      return "本地·警";
    }
    return "本地";
  }

  function appendEntry(audience, title, body) {
    const time = ts();
    const tag = audienceLabel(audience);
    const plain =
      body === undefined
        ? `[${time}] [${tag}] ${title}`
        : `[${time}] [${tag}] ${title}\n${body}`;
    plainLines.push(plain);
    entries.push({
      time,
      audience,
      title,
      body: body === undefined ? "" : String(body),
    });
    if (entries.length > MAX_ENTRIES) {
      entries.shift();
      plainLines.shift();
    }
    render();
  }

  function render() {
    const el = document.getElementById("debugLog");
    if (!el) {
      return;
    }
    el.innerHTML = entries
      .map((e) => {
        const bodyBlock = e.body
          ? `<pre class="dbg-body">${escapeHtml(e.body)}</pre>`
          : "";
        return (
          `<div class="dbg-entry dbg-${e.audience}">` +
          `<div class="dbg-head">` +
          `<span class="dbg-time">[${escapeHtml(e.time)}]</span> ` +
          `<span class="dbg-tag">${escapeHtml(audienceLabel(e.audience))}</span> ` +
          `<span class="dbg-title">${escapeHtml(e.title)}</span>` +
          `</div>${bodyBlock}</div>`
        );
      })
      .join("");
    el.scrollTop = el.scrollHeight;
  }

  window.PomDebug = {
    /** 仅本地 / 界面 / 程序逻辑，不原样发往 API 的日志 */
    logLocal(title, detail) {
      if (detail === undefined) {
        appendEntry("local", String(title));
        return;
      }
      const body =
        typeof detail === "string" ? detail : JSON.stringify(detail, null, 2);
      appendEntry("local", String(title), body);
    },
    logLocalWarn(title, detail) {
      const body =
        detail === undefined
          ? undefined
          : typeof detail === "string"
            ? detail
            : JSON.stringify(detail, null, 2);
      appendEntry("local-warn", String(title), body);
    },
    logLocalError(title, detail) {
      const body =
        detail === undefined
          ? undefined
          : typeof detail === "string"
            ? detail
            : JSON.stringify(detail, null, 2);
      appendEntry("local-error", String(title), body);
    },
    /** 兼容旧调用：默认本地 */
    log(title, detail) {
      this.logLocal(title, detail);
    },
    /** 发往 DeepSeek 的请求体 */
    logRequest(label, payload) {
      appendEntry(
        "ai-out",
        `→ ${label}`,
        typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)
      );
    },
    /** DeepSeek 返回的原始内容 */
    logResponse(label, text) {
      appendEntry("ai-in", `← ${label}`, String(text ?? ""));
    },
    clear() {
      entries.length = 0;
      plainLines.length = 0;
      const el = document.getElementById("debugLog");
      if (el) {
        el.innerHTML = "";
      }
    },
    copyAll() {
      const text = plainLines.join("\n");
      if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text);
      }
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return Promise.resolve();
    },
  };
})();
