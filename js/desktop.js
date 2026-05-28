(function () {
  const DESKTOP_DOCS = [
    {
      id: "plan-api",
      title: "PLAN·API",
      path: "docs/PLAN-api-reliability.md",
      x: 0.14,
      y: 0.28,
      color: "#6366f1",
    },
    {
      id: "plan-desktop",
      title: "PLAN·桌面",
      path: "docs/PLAN-map-desktop.md",
      x: 0.14,
      y: 0.48,
      color: "#8b5cf6",
    },
    {
      id: "plan-narrative",
      title: "PLAN·叙事",
      path: "docs/PLAN-narrative-next.md",
      x: 0.14,
      y: 0.68,
      color: "#ec4899",
    },
    {
      id: "guide",
      title: "常用说明",
      path: "docs/常用说明.md",
      x: 0.86,
      y: 0.32,
      color: "#10b981",
    },
  ];

  let openDocId = null;

  function mdToHtml(md) {
    const lines = String(md || "").split("\n");
    const parts = [];
    let inPre = false;
    for (const line of lines) {
      if (line.startsWith("```")) {
        inPre = !inPre;
        if (inPre) {
          parts.push("<pre>");
        } else {
          parts.push("</pre>");
        }
        continue;
      }
      if (inPre) {
        parts.push(escapeHtml(line));
        continue;
      }
      if (/^### /.test(line)) {
        parts.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      } else if (/^## /.test(line)) {
        parts.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      } else if (/^# /.test(line)) {
        parts.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      } else if (line.startsWith("- ")) {
        parts.push(`<p>• ${escapeHtml(line.slice(2))}</p>`);
      } else if (line.trim() === "") {
        parts.push("<br>");
      } else {
        parts.push(`<p>${escapeHtml(line)}</p>`);
      }
    }
    return parts.join("\n");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /** 桌面文档图标已下线，保留 API 供日后复用 */
  function drawDesktopDocs() {}

  function hitDesktopDoc() {
    return null;
  }

  function findNearDoc() {
    return null;
  }

  async function openDoc(doc) {
    const viewer = document.getElementById("docViewer");
    const titleEl = document.getElementById("docViewerTitle");
    const bodyEl = document.getElementById("docViewerBody");
    if (!viewer || !bodyEl) {
      return;
    }
    openDocId = doc.id;
    titleEl.textContent = doc.title;
    bodyEl.innerHTML = "<p>加载中…</p>";
    viewer.classList.remove("hidden");
    window.PomDebug?.logLocal("打开文档", doc.path);

    try {
      const url = `${doc.path}?t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const md = await res.text();
      bodyEl.innerHTML = mdToHtml(md);
    } catch (e) {
      bodyEl.innerHTML = `<p>无法加载 ${escapeHtml(doc.path)}：${escapeHtml(e.message)}</p>`;
    }
  }

  function closeDoc() {
    openDocId = null;
    document.getElementById("docViewer")?.classList.add("hidden");
  }

  function bindUi() {
    document.getElementById("docViewerClose")?.addEventListener("click", closeDoc);
    document.getElementById("docViewerBackdrop")?.addEventListener("click", closeDoc);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && openDocId) {
        closeDoc();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindUi);
  } else {
    bindUi();
  }

  window.GameDesktop = {
    DESKTOP_DOCS,
    drawDesktopDocs,
    hitDesktopDoc,
    findNearDoc,
    openDoc,
    closeDoc,
    isOpen: () => Boolean(openDocId),
  };
})();
