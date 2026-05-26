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

  const HIT_RADIUS = 0.065;
  let openDocId = null;

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

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

  function drawDesktopDocs(ctx, canvas, { player, highlightDocId, talkingId }) {
    if (talkingId) {
      return;
    }
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;

    for (const doc of DESKTOP_DOCS) {
      const cx = doc.x * w;
      const cy = doc.y * h;
      const near = highlightDocId === doc.id;
      const iw = Math.min(72, w * 0.16);
      const ih = iw * 0.85;

      ctx.fillStyle = near ? doc.color : `${doc.color}cc`;
      ctx.strokeStyle = near ? "#fff" : "rgba(255,255,255,0.35)";
      ctx.lineWidth = near ? 2 : 1;
      roundRect(ctx, cx - iw / 2, cy - ih / 2, iw, ih, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `bold ${Math.max(10, w * 0.022)}px Arial,sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("📄", cx, cy + 4);
      ctx.font = `${Math.max(9, w * 0.02)}px Arial,sans-serif`;
      ctx.fillText(doc.title, cx, cy + ih / 2 + 14);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function hitDesktopDoc(worldPoint, player) {
    if (!player) {
      return null;
    }
    let best = null;
    let bestD = HIT_RADIUS;
    for (const doc of DESKTOP_DOCS) {
      const d = dist(worldPoint, doc);
      if (d < bestD && dist(player, doc) < window.GameMap.INTERACT_RADIUS) {
        bestD = d;
        best = doc;
      }
    }
    return best;
  }

  function findNearDoc(player) {
    if (!player) {
      return null;
    }
    let best = null;
    let bestD = window.GameMap.INTERACT_RADIUS;
    for (const doc of DESKTOP_DOCS) {
      const d = dist(player, doc);
      if (d < bestD) {
        bestD = d;
        best = doc;
      }
    }
    return best;
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
