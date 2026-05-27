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
      lines.push("【本局目标】（唯一，仅此一条）", `- ${goal}`, "");
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
      "仅一个本局核心目标；#1/#2 是并行中层线索，都指向同一幕后，不是两个终局。",
      "keypoint 对准 #1；followup 对准 #2。宜写「若我说…你就…」交易句。",
      "禁止「你必须先答另一条线」式拒绝。",
    ];
    if (goal) {
      parts.push(`本局核心目标：${goal}`);
    }
    pending.slice(0, 4).forEach((p, i) => {
      parts.push(`#${i + 1} ${p}`);
    });
    if (stallTurns >= 2) {
      parts.push("（僵局：选项须含让步/交换，迫使双方各让一步）");
    }
    parts.push(
      "禁止生成「用【已确认】里已有的事实」换新线索的选项（如再拿老周/经手人报价）"
    );
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

    if (context?.redundantOffer) {
      lines.push(
        "【信息价值】玩家拿【已确认】里已有的事实来交易；须拒绝并指出「这我已经知道了，拿我不知道的来换」",
        "勿因玩家复读已知信息而给出钥匙/带路等新线索"
      );
    }
    if (context?.playerNamesMastermind) {
      lines.push(
        "玩家已供述指使者/幕后；须接住并写入事实，可评估是否达成核心目标，勿再逼「你先说指使」"
      );
    }
    if (context?.neglectWarn) {
      lines.push("【警告】玩家多轮回避 #1；语气加压：下次不再绕开指使者");
    }
    if (context?.neglectFail) {
      lines.push("【终局】直接结束对峙：对方不肯说指使者，你没时间了");
    }

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
      lines.push(`本局唯一核心：${goal}`);
      lines.push("所有待核实均服务此核心；剥任一中层即可，勿强迫玩家先答另一条线");
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

  const MASTERMIND_RE =
    /(?:是|叫|名叫|背后是|乃是).{0,12}(?:派|指使|让我拦|派人)|\S{1,8}派我(?:来)?拦|指使者是|谁指使/;
  const OFFER_KNOWN_RE =
    /我告诉|我说(?:出|了)?|拿.{0,8}换|用.{0,12}换|给你.{0,6}换/;
  const ACTION_RE = /带我去|领我去|帮我找|陪我去|跟我去|带我去找/;

  function normalizePlayerLineForApi(playerLine) {
    let s = String(playerLine || "").trim();
    if (!s) {
      return s;
    }
    if (ACTION_RE.test(s)) {
      const topic = s
        .replace(/带我去|领我去|帮我找|陪我去|跟我去|带我去找/g, "")
        .replace(/^找/, "")
        .trim();
      if (topic && !/[？?]$/.test(topic)) {
        if (/女儿|人在|在哪/.test(topic)) {
          s = `${topic}可能在哪里？`;
        } else {
          s = `关于${topic}，你有什么线索？`;
        }
      } else if (topic) {
        s = topic.endsWith("？") ? topic : `${topic}？`;
      } else {
        s = "这事你还有别的线索吗？";
      }
    }
    return s;
  }

  function detectRedundantPlayerOffer(playerLine, plotSummary) {
    const line = String(playerLine || "").trim();
    if (!line || !OFFER_KNOWN_RE.test(line)) {
      return false;
    }
    const confirmed = extractConfirmedLines(plotSummary).join(" ");
    if (!confirmed) {
      return false;
    }
    const chunks = [...line.matchAll(/[\u4e00-\u9fa5]{2,6}/g)].map((m) => m[0]);
    const stop = new Set(
      "我告诉你我说已经知道了换用拿是的有在人不".split("")
    );
    const hits = chunks.filter((c) => c.length >= 2 && !stop.has(c) && confirmed.includes(c));
    return hits.length >= 2 || (hits.length >= 1 && /经手|老周|账本|钥匙|保险柜|女儿/.test(line));
  }

  function detectPlayerNamesMastermind(playerLine) {
    return MASTERMIND_RE.test(String(playerLine || ""));
  }

  function primaryPendingAdvanced(plotBefore, plotAfter, seed) {
    const beforeP = extractPendingLines(plotBefore);
    const afterP = extractPendingLines(plotAfter);
    if (beforeP[0] && (!afterP[0] || afterP[0] !== beforeP[0])) {
      return true;
    }
    const keywords = ["指使", "指派", "派我", "幕后", "主使", ...(seed?.endingCoreKeywords || [])];
    const beforeN = countLayers(plotBefore).confirmed;
    const afterN = countLayers(plotAfter).confirmed;
    if (afterN > beforeN) {
      const allAfter = extractConfirmedLines(plotAfter).join("\n");
      const allBefore = extractConfirmedLines(plotBefore).join("\n");
      if (keywords.some((k) => allAfter.includes(k) && !allBefore.includes(k))) {
        return true;
      }
    }
    return false;
  }

  function trackPrimaryProgress(session, plotBefore, plotAfter, playerLine, seed) {
    if (!session) {
      return { neglectPrimaryRounds: 0, shouldWarn: false, shouldFail: false };
    }
    const progress =
      detectPlayerNamesMastermind(playerLine) ||
      primaryPendingAdvanced(plotBefore, plotAfter, seed);
    if (extractPendingLines(plotAfter).length === 0) {
      session.neglectPrimaryRounds = 0;
    } else if (progress) {
      session.neglectPrimaryRounds = 0;
    } else {
      session.neglectPrimaryRounds = (session.neglectPrimaryRounds || 0) + 1;
    }
    return getNeglectState(session, seed);
  }

  function getNeglectState(session, seed) {
    const n = session?.neglectPrimaryRounds || 0;
    const warnAt = Number(seed?.neglectPrimaryWarnAt) > 0 ? seed.neglectPrimaryWarnAt : 3;
    const failAt = Number(seed?.neglectPrimaryFailAt) > 0 ? seed.neglectPrimaryFailAt : 5;
    return {
      neglectPrimaryRounds: n,
      shouldWarn: n >= warnAt && n < failAt,
      shouldFail: n >= failAt,
    };
  }

  function replyContextFromSession(session, pickIntent, extra) {
    return {
      pickIntent: pickIntent || "",
      stallTurns: session?.stallTurns ?? 0,
      neglectWarn: Boolean(extra?.neglectWarn),
      neglectFail: Boolean(extra?.neglectFail),
      redundantOffer: Boolean(extra?.redundantOffer),
      playerNamesMastermind: Boolean(extra?.playerNamesMastermind),
    };
  }

  function formatLayersDebug(plotSummary) {
    const { confirmed, pending, goal } = countLayers(plotSummary);
    return `核心 [已确认]×${confirmed} · 中层 [待核实]×${pending}${goal ? " · 已设本局目标" : ""}`;
  }

  function extractConfirmedLines(text) {
    const body = String(text || "");
    const archiveMatch = body.match(/【剧情档案】([\s\S]*?)(?=【关系与态度】|$)/);
    const archiveBody = archiveMatch ? archiveMatch[1] : body;
    const lines = [];
    for (const line of archiveBody.split("\n")) {
      const t = line.trim();
      if (/\[已确认\]/.test(t)) {
        lines.push(t.replace(/^[-*•]\s*/, ""));
      }
    }
    return lines;
  }

  function hasCoreGoalAchieved(plotSummary, seed) {
    const keywords = seed?.endingCoreKeywords;
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return true;
    }
    const confirmed = extractConfirmedLines(plotSummary).join("\n");
    return keywords.some((k) => confirmed.includes(String(k).trim()));
  }

  /** 中层剥完、核心条数足够且档案已写出「幕后/指使」等 → 可进入结局 */
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
    if (confirmed < minConfirmed) {
      return false;
    }
    return hasCoreGoalAchieved(plotSummary, seed);
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
    hasCoreGoalAchieved,
    extractConfirmedLines,
    normalizePlayerLineForApi,
    detectRedundantPlayerOffer,
    detectPlayerNamesMastermind,
    trackPrimaryProgress,
    getNeglectState,
    updateStallCounters,
    replyContextFromSession,
  };
})();
