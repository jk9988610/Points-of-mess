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
      const m = trimmed.match(/^[-*•]?\s*\[待核实#?([\da-z]+)?\]\s*(.*)$/i);
      if (m) {
        items.push({
          orderKey: m[1] || String(items.length + 1),
          text: m[2].trim() || trimmed,
        });
        continue;
      }
      if (/^[-*•]\s*\[待核实\]/.test(trimmed) || /^\[待核实\]/.test(trimmed)) {
        items.push({
          orderKey: String(items.length + 1),
          text: trimmed.replace(/^[-*•]\s*\[待核实\]\s*/i, "").trim(),
        });
      }
    }
    items.sort((a, b) => {
      const na = parseInt(String(a.orderKey).replace(/\D/g, ""), 10) || 0;
      const nb = parseInt(String(b.orderKey).replace(/\D/g, ""), 10) || 0;
      if (na !== nb) {
        return na - nb;
      }
      return String(a.orderKey).localeCompare(String(b.orderKey));
    });
    return items.map((x) => x.text).filter(Boolean);
  }

  /** 发给 API 的摘要压缩：保留目标+全部待核实+最近若干已确认 */
  function compactPlotSummaryForApi(plotSummary, maxConfirmed = 6) {
    const text = String(plotSummary || "").trim();
    if (!text) {
      return "";
    }
    const goalBlock = text.match(/【本局目标】[\s\S]*?(?=【|$)/)?.[0]?.trim() || "";
    const attitudeBlock = text.match(/【关系与态度】[\s\S]*$/)?.[0]?.trim() || "";
    const archiveMatch = text.match(/【剧情档案】([\s\S]*?)(?=【关系与态度】|$)/);
    const archiveBody = archiveMatch ? archiveMatch[1] : "";
    const confirmed = [];
    const pending = [];
    for (const line of archiveBody.split("\n")) {
      const t = line.trim();
      if (!t) {
        continue;
      }
      if (/\[已确认\]/.test(t)) {
        confirmed.push(t);
      } else if (/\[待核实/.test(t)) {
        pending.push(t);
      }
    }
    const tailConfirmed = confirmed.slice(-maxConfirmed);
    const parts = [];
    if (goalBlock) {
      parts.push(goalBlock);
    }
    parts.push("【剧情档案】");
    parts.push(...tailConfirmed, ...pending);
    if (attitudeBlock) {
      parts.push("", attitudeBlock.split("\n").slice(0, 3).join("\n"));
    }
    return parts.join("\n").trim();
  }

  function countLayers(plotSummary) {
    const text = String(plotSummary || "");
    const confirmed = (text.match(/\[已确认\]/g) || []).length;
    const pending = extractPendingLines(text).length;
    const goal = extractGoal(text) ? 1 : 0;
    return { confirmed, pending, goal };
  }

  /** ② 选项 user：程序指定优先剥的中层（不全文贴摘要） */
  function formatOptionsBlock(plotSummary, context) {
    const goal = extractGoal(plotSummary);
    const pending = extractPendingLines(plotSummary);
    if (!goal && pending.length === 0) {
      return "";
    }
    const stallTurns = context?.stallTurns ?? 0;
    const parts = [
      "【程序·洋葱中层】",
      "keypoint 对准 #1；followup 对准 #2 或另一待核实。",
      "宜写「若我说…你就…」类交易句，避免双方只互要求对方先答。",
    ];
    if (goal) {
      parts.push(`本局目标：${goal}`);
    }
    pending.slice(0, 4).forEach((p, i) => {
      parts.push(`#${i + 1} ${p}`);
    });
    if (stallTurns >= 2) {
      parts.push("（僵局：选项须含让步/交换，迫使双方各让一步）");
    }
    return parts.join("\n");
  }

  /** ① reply system：按玩家 intent + 僵局动态约束 */
  function formatReplyHint(plotSummary, context) {
    const goal = extractGoal(plotSummary);
    const pending = extractPendingLines(plotSummary);
    if (!pending.length && !goal) {
      return "";
    }
    const pickIntent = context?.pickIntent || "";
    const stallTurns = context?.stallTurns ?? 0;
    const lines = [];

    if (stallTurns >= 2) {
      lines.push(
        "【程序·破局】必须先给出一条可核对的具体事实（地点/人名/时间/物证），再附带追问",
        "禁止整句「你不说X我就不说Y」；禁止连续第3轮完全拒绝"
      );
      if (pending[1]) {
        lines.push(`可对 #2「${pending[1]}」先让步给部分答案以换 #1`);
      }
    } else if (pickIntent === "followup" && pending.length >= 2) {
      lines.push(
        `玩家在推进 #2「${pending[1]}」：须让步——先给 #2 的部分线索或明确否认，再要求玩家补 #1`,
        `禁止整轮只回复「先回答 #1」`
      );
      if (pending[0]) {
        lines.push(`#1 仍为：${pending[0]}`);
      }
    } else if (pickIntent === "keypoint" && pending[0]) {
      lines.push(
        `玩家针对 #1「${pending[0]}」：须具体回答、承认或否认，禁止「你先说清楚」搪塞`
      );
    } else if (pending[0]) {
      lines.push(`优先回应中层 #1：${pending[0]}`);
    }

    if (goal) {
      lines.push(`本局目标：${goal}`);
    }
    lines.push("一次只剥一层；每轮须推进至少一条待核实（回答、收窄或部分确认）");

    return `\n【程序·本轮推进】\n${lines.map((l) => `- ${l}`).join("\n")}\n`;
  }

  function updateStallCounters(session, plotSummary) {
    if (!session) {
      return { stallTurns: 0, confirmed: 0 };
    }
    const confirmed = countLayers(plotSummary).confirmed;
    const prev = session.lastConfirmedCount ?? 0;
    if (confirmed > prev) {
      session.stallTurns = 0;
    } else {
      session.stallTurns = (session.stallTurns || 0) + 1;
    }
    session.lastConfirmedCount = confirmed;
    return { stallTurns: session.stallTurns, confirmed };
  }

  function replyContextFromSession(session, pickIntent) {
    return {
      pickIntent: pickIntent || "",
      stallTurns: session?.stallTurns ?? 0,
    };
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
    compactPlotSummaryForApi,
    formatOptionsBlock,
    formatReplyHint,
    formatLayersDebug,
    isReadyForEnding,
    updateStallCounters,
    replyContextFromSession,
  };
})();
