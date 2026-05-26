(function () {
  const MAX_ENTRIES = 120;
  const entries = [];
  const plainLines = [];

  function ts() {
    return new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function classify(title) {
    const t = String(title);
    if (t.startsWith("→ ")) {
      return "request";
    }
    if (t.startsWith("← ")) {
      return "response";
    }
    if (t.includes("错误")) {
      return "error";
    }
    if (
      t === "提示" ||
      t.includes("失败") ||
      t.includes("兜底") ||
      t.includes("解析")
    ) {
      return "warn";
    }
    if (t.includes("首轮选项")) {
      return "preset";
    }
    if (t.includes("玩家选择")) {
      return "player";
    }
    if (t.includes("选项已更新")) {
      return "options";
    }
    if (t.includes("开始对话") || t.includes("结束对话") || t.includes("停止")) {
      return "event";
    }
    if (t.includes("已加载") || t === "测试模式") {
      return "boot";
    }
    return "info";
  }

  function appendEntry(kind, title, body) {
    const time = ts();
    const plain =
      body === undefined
        ? `[${time}] ${title}`
        : `[${time}] ${title}\n${body}`;
    plainLines.push(plain);
    entries.push({
      time,
      kind: kind || classify(title),
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
          `<div class="dbg-entry dbg-${e.kind}">` +
          `<div class="dbg-head">` +
          `<span class="dbg-time">[${escapeHtml(e.time)}]</span> ` +
          `<span class="dbg-title">${escapeHtml(e.title)}</span>` +
          `</div>${bodyBlock}</div>`
        );
      })
      .join("");
    el.scrollTop = el.scrollHeight;
  }

  window.PomDebug = {
    log(title, detail, kind) {
      if (detail === undefined) {
        appendEntry(kind, String(title));
        return;
      }
      const body =
        typeof detail === "string" ? detail : JSON.stringify(detail, null, 2);
      appendEntry(kind || classify(title), String(title), body);
    },
    logRequest(label, payload) {
      this.log(`→ ${label}`, payload, "request");
    },
    logResponse(label, text) {
      this.log(`← ${label}`, text, "response");
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
