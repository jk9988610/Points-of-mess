(function () {
  const MAX_ENTRIES = 120;
  const entries = [];
  const plainLines = [];

  const THEME = {
    "ai-out": {
      border: "3px solid #f59e0b",
      tagBg: "#b45309",
      tagFg: "#fffbeb",
      text: "#fde68a",
      bodyBg: "rgba(180, 83, 9, 0.25)",
    },
    "ai-in": {
      border: "3px solid #22c55e",
      tagBg: "#15803d",
      tagFg: "#ecfdf5",
      text: "#bbf7d0",
      bodyBg: "rgba(21, 128, 61, 0.25)",
    },
    local: {
      border: "3px solid #64748b",
      tagBg: "#475569",
      tagFg: "#f1f5f9",
      text: "#cbd5e1",
      bodyBg: "rgba(71, 85, 105, 0.35)",
    },
    "local-warn": {
      border: "3px solid #f97316",
      tagBg: "#c2410c",
      tagFg: "#fff7ed",
      text: "#fdba74",
      bodyBg: "rgba(194, 65, 12, 0.25)",
    },
    "local-error": {
      border: "3px solid #ef4444",
      tagBg: "#b91c1c",
      tagFg: "#fef2f2",
      text: "#fca5a5",
      bodyBg: "rgba(185, 28, 28, 0.25)",
    },
  };

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
        const t = THEME[e.audience] || THEME.local;
        const entryStyle = [
          "margin-bottom:8px",
          "padding:0 0 6px 8px",
          "border-left:" + t.border,
        ].join(";");
        const tagStyle = [
          "display:inline-block",
          "min-width:3em",
          "margin-right:4px",
          "padding:1px 5px",
          "border-radius:4px",
          "font-size:0.62rem",
          "font-weight:800",
          "background:" + t.tagBg,
          "color:" + t.tagFg,
        ].join(";");
        const titleStyle = "font-weight:700;color:" + t.text;
        const timeStyle = "color:#64748b";
        const bodyStyle = [
          "margin:4px 0 0",
          "padding:6px 8px",
          "border-radius:6px",
          "white-space:pre-wrap",
          "color:" + t.text,
          "background:" + t.bodyBg,
        ].join(";");
        const bodyBlock = e.body
          ? `<pre style="${bodyStyle}">${escapeHtml(e.body)}</pre>`
          : "";
        return (
          `<div class="dbg-entry" style="${entryStyle}">` +
          `<div>` +
          `<span style="${timeStyle}">[${escapeHtml(e.time)}]</span> ` +
          `<span style="${tagStyle}">${escapeHtml(audienceLabel(e.audience))}</span> ` +
          `<span style="${titleStyle}">${escapeHtml(e.title)}</span>` +
          `</div>${bodyBlock}</div>`
        );
      })
      .join("");
    el.scrollTop = el.scrollHeight;
  }

  window.PomDebug = {
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
    log(title, detail) {
      this.logLocal(title, detail);
    },
    logRequest(label, payload) {
      appendEntry(
        "ai-out",
        `→ ${label}`,
        typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)
      );
    },
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
    copyText(text) {
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
    copyAll() {
      return this.copyText(plainLines.join("\n"));
    },
    /** 从最近一次「玩家选择」起复制到末尾（报 bug 用） */
    copyCurrentTurn() {
      const version = window.POM_VERSION || "?";
      let start = Math.max(0, entries.length - 28);
      for (let i = entries.length - 1; i >= 0; i--) {
        if (String(entries[i].title).includes("玩家选择")) {
          start = i;
          break;
        }
      }
      const slice = plainLines.slice(start);
      const header = `版本：v${version}\n（以下为最近一轮起）\n`;
      return this.copyText(header + slice.join("\n"));
    },
  };
})();
