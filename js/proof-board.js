(function () {
  /**
   * 论证黑板：把 plotSummary 解析为 G / Pk / Lk 等可读条目（老师板书）
   */

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function stripLemmaPrefix(text) {
    return String(text || "")
      .replace(/^L\d+(?:\.\d+)?[：:]\s*/i, "")
      .trim();
  }

  function parseProofBoardModel(plotSummary) {
    const O = window.GameOnion;
    const raw = String(plotSummary || "").trim();
    if (!raw) {
      return null;
    }
    const text = O?.normalizeProofArchive?.(raw) || raw;
    const goal = O?.extractGoal?.(text) || "";
    const body = O?.extractArchiveBody?.(text) || text;
    const qedOrders = O?.extractQedOrders?.(text) || new Set();

    const rows = [];
    const progress = [];

    if (goal) {
      rows.push({
        sym: "G",
        text: goal,
        kind: "goal",
        badge: "论题",
        title: "论题 G：本局要证明的结论",
      });
    }

    for (const line of body.split("\n")) {
      const t = line.trim().replace(/^[-*•]\s*/, "");
      if (!t) {
        continue;
      }

      const prem = t.match(/^\[前提\]\s*P(\d+)\s*[：:]\s*(.+)$/i);
      if (prem) {
        rows.push({
          sym: `P${prem[1]}`,
          text: prem[2].trim(),
          kind: "premise",
          badge: "前提",
          title: `前提 P${prem[1]}：已知条件`,
        });
        continue;
      }

      const pend = t.match(/^\[待证#?(\d+)\]\s*(?:L\1\s*)?[：:]\s*(.+)$/i);
      if (pend && !qedOrders.has(pend[1])) {
        const sym = `L${pend[1]}`;
        const bodyText = stripLemmaPrefix(pend[2]);
        rows.push({
          sym,
          text: bodyText,
          kind: "pending",
          badge: "待证",
          title: `引理 ${sym}：当前要证的一步（选项里的 L${pend[1]} 即指本条）`,
        });
        continue;
      }

      const qed = t.match(/^\[证毕#?(\d+)\]\s*(?:L\1\s*)?[：:]\s*(.+)$/i);
      if (qed) {
        const sym = `L${qed[1]}`;
        progress.push({
          sym,
          text: stripLemmaPrefix(qed[2]),
          kind: "qed",
          badge: "证毕",
        });
        continue;
      }

      const hint = t.match(/^\[提示\]\s*H(\d+)\s*[：:]\s*(.+)$/i);
      if (hint) {
        progress.push({
          sym: `H${hint[1]}`,
          text: hint[2].trim(),
          kind: "hint",
          badge: "提示",
        });
        continue;
      }

      const partial = t.match(/^\[已证部分\]\s*P(\d+)(?:\s*（([^）)]+)）)?\s*[：:]\s*(.+)$/i);
      if (partial) {
        const lk = partial[2] || "Lk";
        progress.push({
          sym: partial[2] ? lk : `P${partial[1]}`,
          text: partial[3].trim(),
          kind: "partial",
          badge: "部分",
          title: `已证部分：${lk} 尚未闭合`,
        });
        continue;
      }

      const proven = t.match(/^\[已证\]\s*S(\d+)\s*[：:]\s*(.+)$/i);
      if (proven) {
        progress.push({
          sym: `S${proven[1]}`,
          text: proven[2].trim(),
          kind: "proven",
          badge: "已证",
        });
        continue;
      }

      if (/^\[依赖\]/.test(t) || /^\[已推翻\]/.test(t)) {
        continue;
      }
    }

    if (!rows.length && !progress.length) {
      return null;
    }

    return { goal, rows, progress };
  }

  function renderProofBoardHtml(model) {
    if (!model) {
      return '<p class="proof-board__empty">靠近证官开始论证后，符号含义会显示在此。</p>';
    }

    const parts = ['<div class="proof-board__sections">'];

    parts.push('<section class="proof-board__section" aria-label="符号板">');
    parts.push('<h3 class="proof-board__heading">符号板</h3>');
    parts.push('<p class="proof-board__note">选项中的 G、L1、P1 等即指下列命题。</p>');
    parts.push('<ul class="proof-board__list">');

    for (const row of model.rows) {
      const kindClass = `proof-board__row--${row.kind}`;
      parts.push(
        `<li class="proof-board__row ${kindClass}" title="${escapeHtml(row.title || "")}">` +
          `<span class="proof-board__sym" aria-label="${escapeHtml(row.badge)}">${escapeHtml(row.sym)}</span>` +
          `<span class="proof-board__badge">${escapeHtml(row.badge)}</span>` +
          `<span class="proof-board__text">${escapeHtml(row.text)}</span>` +
          `</li>`
      );
    }

    parts.push("</ul></section>");

    if (model.progress.length) {
      parts.push('<section class="proof-board__section" aria-label="论证进展">');
      parts.push('<h3 class="proof-board__heading">进展</h3>');
      parts.push('<ul class="proof-board__list proof-board__list--progress">');
      for (const row of model.progress) {
        const kindClass = `proof-board__row--${row.kind}`;
        parts.push(
          `<li class="proof-board__row ${kindClass}" title="${escapeHtml(row.title || "")}">` +
            `<span class="proof-board__sym">${escapeHtml(row.sym)}</span>` +
            `<span class="proof-board__badge">${escapeHtml(row.badge)}</span>` +
            `<span class="proof-board__text">${escapeHtml(row.text)}</span>` +
            `</li>`
        );
      }
      parts.push("</ul></section>");
    }

    parts.push("</div>");
    return parts.join("");
  }

  function updateProofBoard(container, plotSummary) {
    const bodyEl =
      container?.querySelector?.("[data-proof-board-body]") ||
      document.getElementById("proofBlackboardBody");
    const panel = container || document.getElementById("proofBlackboard");
    if (!bodyEl || !panel) {
      return;
    }
    const model = parseProofBoardModel(plotSummary);
    bodyEl.innerHTML = renderProofBoardHtml(model);
    panel.classList.toggle("hidden", !model);
    panel.classList.toggle("proof-blackboard--active", Boolean(model));
  }

  window.GameProofBoard = {
    parseProofBoardModel,
    renderProofBoardHtml,
    updateProofBoard,
  };
})();
