(function () {
  const MAX_LINES = 200;
  const lines = [];

  function ts() {
    return new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }

  function appendLine(text) {
    lines.push(`[${ts()}] ${text}`);
    if (lines.length > MAX_LINES) {
      lines.splice(0, lines.length - MAX_LINES);
    }
    const el = document.getElementById("debugLog");
    if (el) {
      el.textContent = lines.join("\n");
      el.scrollTop = el.scrollHeight;
    }
  }

  window.PomDebug = {
    log(title, detail) {
      if (detail === undefined) {
        appendLine(String(title));
        return;
      }
      const body =
        typeof detail === "string" ? detail : JSON.stringify(detail, null, 2);
      appendLine(`${title}\n${body}`);
    },
    logRequest(label, payload) {
      this.log(`→ ${label}`, payload);
    },
    logResponse(label, text) {
      this.log(`← ${label}`, text);
    },
    clear() {
      lines.length = 0;
      const el = document.getElementById("debugLog");
      if (el) {
        el.textContent = "";
      }
    },
    copyAll() {
      const text = lines.join("\n");
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
