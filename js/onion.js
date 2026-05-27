/**
 * 洋葱记事 · 程序侧（种子摘要、摘录、调试计数）。模型 prompt 仅做最少补充。
 */
(function () {
  function buildSeedPlotSummary(seed) {
    const goal = String(seed?.goal || "").trim();
    const confirmed = (seed?.confirmed || []).map((s) => String(s).trim()).filter(Boolean);
    const pending = (seed?.pending || []).map((s) => String(s).trim()).filter(Boolean);
    const attitude = (seed?.attitude || []).map((s) => String(s).trim()).filter(Boolean);

    const lines = [];
    if (goal) {
      lines.push("【本局目标】", `- ${goal}`, "");
    }
    lines.push("【剧情档案】");
    for (const c of confirmed) {
      lines.push(`- [已确认] ${c}`);
    }
    pending.forEach((p, i) => {
      lines.push(`- [待核实#${i + 1}] ${p}`);
    });
    if (!confirmed.length && !pending.length) {
      lines.push("- [待核实#1] （待剧情推进后填写）");
    }
    if (attitude.length) {
      lines.push("", "【关系与态度】");
      for (const a of attitude) {
        lines.push(`- ${a}`);
      }
    }
    return lines.join("\n").trim();
  }

  function extractGoal(text) {
    const body = String(text || "");
    const m = body.match(/【本局目标】\s*([\s\S]*?)(?=【|$)/);
    if (!m) {
      return "";
    }
    return m[1]
      .split("\n")
      .map((l) => l.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean)
      .join("；");
  }

  function extractPendingLines(text) {
    const body = String(text || "").trim();
    if (!body) {
      return [];
    }
    const items = [];
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const m = trimmed.match(/^[-*•]?\s*\[待核实#?(\d+)?\]\s*(.*)$/);
      if (m) {
        items.push({
          order: m[1] ? Number(m[1]) : items.length + 1,
          text: m[2].trim() || trimmed,
        });
        continue;
      }
      if (/^[-*•]\s*\[待核实\]/.test(trimmed) || /^\[待核实\]/.test(trimmed)) {
        items.push({
          order: items.length + 1,
          text: trimmed.replace(/^[-*•]\s*\[待核实\]\s*/, "").trim(),
        });
      }
    }
    items.sort((a, b) => a.order - b.order);
    return items.map((x) => x.text).filter(Boolean);
  }

  function countLayers(plotSummary) {
    const text = String(plotSummary || "");
    const confirmed = (text.match(/\[已确认\]/g) || []).length;
    const pending = extractPendingLines(text).length;
    const goal = extractGoal(text) ? 1 : 0;
    return { confirmed, pending, goal };
  }

  /** ② 选项 user：程序指定优先剥的中层（不全文贴摘要） */
  function formatOptionsBlock(plotSummary) {
    const goal = extractGoal(plotSummary);
    const pending = extractPendingLines(plotSummary);
    if (!goal && pending.length === 0) {
      return "";
    }
    const parts = ["【程序·洋葱中层】（keypoint 对准 #1；followup 对准 #2 或换角剥另一中层）"];
    if (goal) {
      parts.push(`本局目标：${goal}`);
    }
    pending.slice(0, 3).forEach((p, i) => {
      parts.push(`#${i + 1} ${p}`);
    });
    return parts.join("\n");
  }

  /** ① reply system：一行推进约束 */
  function formatReplyHint(plotSummary) {
    const goal = extractGoal(plotSummary);
    const pending = extractPendingLines(plotSummary);
    if (!pending.length && !goal) {
      return "";
    }
    const head = pending[0] ? `优先回应中层#1：${pending[0]}` : "";
    const goalBit = goal ? `本局目标：${goal}` : "";
    const bits = [head, goalBit, "一次只剥一层，勿一轮揭穿全部中层"].filter(Boolean);
    return `\n【程序·本轮推进】${bits.join("；")}。\n`;
  }

  function formatLayersDebug(plotSummary) {
    const { confirmed, pending, goal } = countLayers(plotSummary);
    return `核心 [已确认]×${confirmed} · 中层 [待核实]×${pending}${goal ? " · 已设本局目标" : ""}`;
  }

  /** 中层剥完且核心条数足够 → 可进入结局（程序判定，不调 API） */
  function isReadyForEnding(plotSummary, seed) {
    const goal = extractGoal(plotSummary);
    if (!goal) {
      return false;
    }
    const pending = extractPendingLines(plotSummary);
    if (pending.length > 0) {
      return false;
    }
    const minConfirmed = Number(seed?.endingMinConfirmed) > 0 ? seed.endingMinConfirmed : 2;
    const { confirmed } = countLayers(plotSummary);
    return confirmed >= minConfirmed;
  }

  window.GameOnion = {
    buildSeedPlotSummary,
    extractGoal,
    extractPendingLines,
    countLayers,
    formatOptionsBlock,
    formatReplyHint,
    formatLayersDebug,
    isReadyForEnding,
  };
})();
