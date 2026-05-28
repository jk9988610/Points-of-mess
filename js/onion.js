/**
 * 剧情档案 · 程序侧（种子摘要、摘录、推进计数）。注入 API 的约束块由此生成。
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
    const block = String(text || "").match(/【本局目标】[\s\S]*?(?=【|$)/)?.[0];
    if (!block) {
      return "";
    }
    const items = [];
    for (const line of block.split("\n")) {
      const m = line.trim().match(/^[-*•]\s+(.+)$/);
      if (m) {
        items.push(m[1].trim());
      }
    }
    return items.join("；");
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

  /** ② 选项 user：本局态势 + 写法（不含「洋葱」术语） */
  function formatOptionsBlock(plotSummary, context) {
    const goal = extractGoal(plotSummary);
    const pending = extractPendingLines(plotSummary);
    if (!goal && pending.length === 0) {
      return "";
    }
    const stallTurns = context?.stallTurns ?? 0;
    const knowledge = formatPlayerKnowledgeForOptions(context?.session, context?.seed);
    const lastSharp = String(context?.lastAssistantLine || "").trim();
    const parts = ["【本局态势】"];
    if (goal) {
      parts.push(`目标：${goal}`);
    }
    if (pending.length) {
      parts.push(`仍待弄清：${pending[0]}`);
    }
    if (knowledge) {
      parts.push(knowledge);
    }
    if (lastSharp) {
      parts.push(`锋利上一句：${lastSharp}`);
    }
    parts.push(
      "",
      "【选项写法】",
      "推进(keypoint)：唯一推进目标。须用【玩家可亮牌】offer，或核对上一句专名（例：「B 就是指使者，物证 X 在哪？」）。",
      "询问(followup)：来意/态度/关系；禁核心密语、亮牌交换句、互怼逼供。",
      "禁止两条同义。"
    );
    if (/指使者|就是指使者|是.+派|主使/.test(lastSharp)) {
      parts.push(
        "锋利已点名指使者：keypoint 须确认并追问仍缺的事实（如下落），勿再空换循环。"
      );
    }
    if (stallTurns >= 2) {
      parts.push("连续无进展：亮牌必须用【玩家可亮牌】中未用过的 offer 句。");
    }
    if (context?.emptyPromiseCount >= 2) {
      parts.push("玩家信用破产：keypoint 只能确认已说事实；followup 仍可为旁询。");
    }
    return parts.join("\n");
  }

  function isGoalAdvancePlayerLine(playerLine) {
    const line = String(playerLine || "").trim();
    if (!line || PLAYER_ASKING_RE.test(line)) {
      return false;
    }
    return GOAL_ADVANCE_LINE_RE.test(line);
  }

  function getInquireLines(seed) {
    const raw = seed?.inquireLines;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }

  function pickProgramInquireLine(session, seed) {
    const pool = getInquireLines(seed);
    if (!pool.length) {
      return "你来找我，到底想干什么？";
    }
    const idx = session?.inquireLineIndex ?? 0;
    return pool[idx % pool.length];
  }

  function advanceInquireIndex(session) {
    if (!session) {
      return;
    }
    session.inquireLineIndex = (session.inquireLineIndex || 0) + 1;
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

    if (pickIntent === "followup") {
      lines.push(
        "【旁询】玩家本轮仅打听来意/态度/关系，不追本局核心目标",
        "用陈述顶回（冷淡/讽刺均可）；**禁止向玩家发问**",
        "勿逼玩家交代核心秘密；本句可不提供新线索"
      );
      return `\n【本局规则·本轮】\n${lines.map((l) => `- ${l}`).join("\n")}\n`;
    }

    if (context?.playerConcreteReveal && pickIntent === "keypoint") {
      lines.push(
        "玩家已亮牌（含可核对专名/地点）。你必须兑现交换：直接回答玩家所问的一条新事实",
        "禁止「你心里清楚」等敷衍；禁止只顶回不给料；**禁止问句**",
        "若玩家用具体专名交换，须给出指使者姓名或关键物证去向之一"
      );
    } else if (context?.emptyPromiseBankrupt) {
      lines.push(
        "玩家多次空头交换；拒绝再交易",
        "只回复：「别光说不做。没料就别换。」本轮不给人名/去向"
      );
    } else if (context?.hollowTradeOffer) {
      lines.push(
        "玩家未亮牌却要情报；不得先给新线索",
        "回复：「先把你说的事讲实，我再开口。」"
      );
    }
    if (context?.redundantOffer) {
      lines.push(
        "玩家拿【已确认】里已有事实来换；回复「这我知道了，拿新鲜的来换」",
        "不得因复读再送新线索"
      );
    }
    if (context?.playerNamesMastermind) {
      lines.push("玩家已指认指使者姓名；接住并确认，勿再逼「谁指使」");
    }
    if (context?.neglectWarn) {
      lines.push("玩家长期未用「推进」亮牌；语气加压（仅对推进轮）");
    }
    if (context?.neglectFail) {
      lines.push("终局：对方不肯亮牌推进，你没时间了，结束对峙");
    }

    if (stallTurns >= 2) {
      lines.push(
        "连续无进展：须给出一条可核对事实（人名/地点/去向），用陈述句",
        "禁止向玩家发问；禁止「你不说我不说」式空耗"
      );
    } else if (pickIntent === "keypoint" && !context?.playerConcreteReveal) {
      if (isGoalAdvancePlayerLine(context?.playerLine)) {
        lines.push("玩家在逼核心；给出一条具体事实或明确否认，**禁止问句**");
      } else {
        lines.push("玩家推进；给出具体回答、承认或否认，勿搪塞，**禁止问句**");
      }
    }

    lines.push("角色台词：只答不问（无 ？/?，不以吗/呢 发问）");

    if (goal) {
      lines.push(`本局目标：${goal}`);
    }
    if (pending[0]) {
      lines.push(`优先弄清：${pending[0]}`);
    }

    return `\n【本局规则·本轮】\n${lines.map((l) => `- ${l}`).join("\n")}\n`;
  }

  function updateStallCounters(session, plotSummary) {
    if (!session) {
      return { stallTurns: 0, confirmed: 0 };
    }
    const confirmed = countLayers(plotSummary).confirmed;
    const prev = session.lastConfirmedCount ?? 0;
    if (session.lastPickIntent === "followup") {
      session.lastConfirmedCount = confirmed;
      return { stallTurns: session.stallTurns || 0, confirmed };
    }
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
    /我告诉|我说(?:出|了)?|拿.{0,8}换|用.{0,12}换|给你.{0,6}换|换你|换一句|换一条/;
  const TRADE_OFFER_RE =
    /若我(?:说|告诉)|我拿|用.{0,24}换|换你|换一句|换一条|账本下落换|下落换/;
  const VAGUE_TRADE_TOKEN_RE =
    /账本下落|指使者|实话|真相|线索|谁派|幕后|下落(?!为|在)|一句实话|一句真话/;
  const CONCRETE_PLAYER_INFO_RE =
    /在[\u4e00-\u9fa5]{1,8}(?:手里|处|家|那儿)|藏在|经手(?:人)?(?:是|为)|见过[\u4e00-\u9fa5]{1,6}|[\u4e00-\u9fa5]{2,4}(?:手里|身上|派我|拦我)|(?:是|叫|名叫)[\u4e00-\u9fa5]{2,6}|阻拦(?:者)?(?:是|叫)?[\u4e00-\u9fa5]{2,6}/;
  const ACTION_RE = /带我去|领我去|帮我找|陪我去|跟我去|带我去找/;
  /** followup 不得包含：会逼核心目标/互怼指使者 */
  const GOAL_ADVANCE_LINE_RE =
    /指使|指使者|账本|谁派|幕后|主子|换你|换一句|陈四|刘老三|老九|赵家|开口|心里鬼|凭什么|谁先答|别绕|说清楚/;
  const PLAYER_ASKING_RE =
    /[？?]|吗$|谁让你|谁派你|谁是|到底是谁|查我|什么关系|干什么|来意|套话/;

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
    const line = String(playerLine || "").trim();
    if (!line || PLAYER_ASKING_RE.test(line)) {
      return false;
    }
    return MASTERMIND_RE.test(line);
  }

  function hasConcretePlayerInfo(playerLine) {
    const line = String(playerLine || "").trim();
    if (!line) {
      return false;
    }
    if (CONCRETE_PLAYER_INFO_RE.test(line)) {
      return true;
    }
    if (MASTERMIND_RE.test(line) && /[\u4e00-\u9fa5]{2,4}/.test(line)) {
      return true;
    }
    if (/^你说|你刚说|就是指使者|就是指|换你说/.test(line) && /[\u4e00-\u9fa5]{2,5}/.test(line)) {
      return true;
    }
    return false;
  }

  function isPlayerLineConcrete(playerLine, seed) {
    const line = String(playerLine || "").trim();
    if (!line) {
      return false;
    }
    if (hasConcretePlayerInfo(line)) {
      return true;
    }
    if (seed && detectPlayerRevealedKnowledge(line, seed)) {
      return true;
    }
    if (seed) {
      for (const k of getPlayerKnowledgeList(seed)) {
        if (k.match && line.includes(k.match)) {
          return true;
        }
        if (k.offerLine) {
          const frag = k.offerLine.replace(/[，。！？]/g, "").slice(0, 10);
          if (frag.length >= 4 && line.replace(/\s/g, "").includes(frag)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /** 玩家提出交易但未给出可核对的具体信息（空头支票） */
  function detectHollowTradeOffer(playerLine, seed) {
    const line = String(playerLine || "").trim();
    if (!line || !TRADE_OFFER_RE.test(line)) {
      return false;
    }
    if (isPlayerLineConcrete(line, seed)) {
      return false;
    }
    if (/下落换|若我说|若我告诉|一句实话|账本下落/.test(line)) {
      return true;
    }
    return VAGUE_TRADE_TOKEN_RE.test(line) && !/[\u4e00-\u9fa5]{2,6}(?:手里|是|叫|名叫)/.test(line);
  }

  function detectTradeOfferNeedsPlayerFirst(playerLine, seed) {
    const line = String(playerLine || "").trim();
    return TRADE_OFFER_RE.test(line) && !isPlayerLineConcrete(line, seed);
  }

  function trackEmptyPromise(session, playerLine, seed, pickIntent) {
    if (!session) {
      return 0;
    }
    if (pickIntent === "followup") {
      return session.emptyPromiseCount || 0;
    }
    if (detectHollowTradeOffer(playerLine, seed)) {
      session.emptyPromiseCount = (session.emptyPromiseCount || 0) + 1;
    } else if (isPlayerLineConcrete(playerLine, seed)) {
      session.emptyPromiseCount = 0;
    }
    return session.emptyPromiseCount || 0;
  }

  function pickConfirmAfterSharpLine(lastAssistantLine) {
    const t = String(lastAssistantLine || "").trim();
    if (!t) {
      return "";
    }
    const patterns = [
      /指使者(?:是|乃|为)([\u4e00-\u9fa5]{2,8})/,
      /([\u4e00-\u9fa5]{2,8})(?:就是指使者|是幕后|是主使)/,
      /经手人(?:是|乃)([\u4e00-\u9fa5]{2,8})/,
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (m?.[1]) {
        return `${m[1]}就是指使者，账本现在在哪？`;
      }
    }
    return "";
  }

  function isEmptyPromiseBankrupt(session) {
    return (session?.emptyPromiseCount || 0) >= 2;
  }

  function getPlayerKnowledgeList(seed) {
    const raw = seed?.playerKnowledge;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map((k) => ({
        id: String(k?.id || "").trim(),
        match: String(k?.match || "").trim(),
        text: String(k?.text || "").trim(),
        offerLine: String(k?.offerLine || k?.text || "").trim(),
      }))
      .filter((k) => k.id && k.offerLine);
  }

  function getAvailableKnowledge(session, seed) {
    const spent = session?.spentPlayerKnowledge || [];
    return getPlayerKnowledgeList(seed).filter((k) => !spent.includes(k.id));
  }

  function formatPlayerKnowledgeForOptions(session, seed) {
    const avail = getAvailableKnowledge(session, seed);
    if (!avail.length) {
      return "【玩家已知】（已用尽，keypoint 须确认锋利上一句或陈述新事实）";
    }
    const lines = avail.map(
      (k, i) => `  ${i + 1}. ${k.text} → offer:「${k.offerLine}」`
    );
    return `【玩家已知】（keypoint 优先用 offer 亮牌）\n${lines.join("\n")}`;
  }

  function pickProgramRevealLine(session, seed) {
    const next = getAvailableKnowledge(session, seed)[0];
    return next?.offerLine || "";
  }

  function markKnowledgeSpent(session, playerLine, seed) {
    if (!session) {
      return false;
    }
    if (!Array.isArray(session.spentPlayerKnowledge)) {
      session.spentPlayerKnowledge = [];
    }
    const line = String(playerLine || "");
    let marked = false;
    for (const k of getPlayerKnowledgeList(seed)) {
      if (session.spentPlayerKnowledge.includes(k.id)) {
        continue;
      }
      if (k.match && line.includes(k.match)) {
        session.spentPlayerKnowledge.push(k.id);
        marked = true;
      }
    }
    return marked;
  }

  function detectPlayerRevealedKnowledge(playerLine, seed) {
    const line = String(playerLine || "");
    return getPlayerKnowledgeList(seed).some(
      (k) => k.match && line.includes(k.match)
    );
  }

  function detectLedgerTrackProgress(playerLine, seed) {
    const line = String(playerLine || "");
    const kws = seed?.goalTracks?.ledger?.keywords || [
      "账本",
      "经手",
      "保管",
      "刘老三",
    ];
    return kws.some((k) => line.includes(String(k).trim()));
  }

  function hasGoalTracksAchieved(plotSummary, seed) {
    const tracks = seed?.goalTracks;
    if (!tracks || typeof tracks !== "object") {
      return null;
    }
    const confirmed = extractConfirmedLines(plotSummary).join("\n");
    for (const key of Object.keys(tracks)) {
      const kws = tracks[key]?.keywords;
      if (!Array.isArray(kws) || kws.length === 0) {
        continue;
      }
      if (!kws.some((k) => confirmed.includes(String(k).trim()))) {
        return false;
      }
    }
    return true;
  }

  /** 回合初：根据玩家本轮台词更新回避 #1 计数（与摘要是否压缩无关） */
  function bumpNeglectBeforeReply(session, playerLine, plotSummary, seed, pickIntent) {
    if (!session) {
      return getNeglectState(session, seed);
    }
    if (pickIntent === "followup") {
      return getNeglectState(session, seed);
    }
    const pending = extractPendingLines(plotSummary);
    if (pending.length === 0) {
      session.neglectPrimaryRounds = 0;
      return getNeglectState(session, seed);
    }
    if (detectPlayerNamesMastermind(playerLine)) {
      session.neglectPrimaryRounds = 0;
      return getNeglectState(session, seed);
    }
    if (seed?.goalTracks) {
      if (detectPlayerRevealedKnowledge(playerLine, seed)) {
        session.neglectPrimaryRounds = 0;
        return getNeglectState(session, seed);
      }
      if (detectLedgerTrackProgress(playerLine, seed)) {
        return getNeglectState(session, seed);
      }
      const mastermindKws = seed.goalTracks.mastermind?.keywords || [];
      if (mastermindKws.some((k) => String(playerLine).includes(String(k).trim()))) {
        session.neglectPrimaryRounds = 0;
        return getNeglectState(session, seed);
      }
    }
    session.neglectPrimaryRounds = (session.neglectPrimaryRounds || 0) + 1;
    return getNeglectState(session, seed);
  }

  function resetNeglectAfterPlotProgress(session, plotBefore, plotAfter, playerLine, seed) {
    if (!session) {
      return getNeglectState(session, seed);
    }
    const progress =
      detectPlayerNamesMastermind(playerLine) ||
      primaryPendingAdvanced(plotBefore, plotAfter, seed);
    if (extractPendingLines(plotAfter).length === 0 || progress) {
      session.neglectPrimaryRounds = 0;
    }
    return getNeglectState(session, seed);
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
    return resetNeglectAfterPlotProgress(session, plotBefore, plotAfter, playerLine, seed);
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
    const emptyCount = session?.emptyPromiseCount ?? extra?.emptyPromiseCount ?? 0;
    const bankrupt = emptyCount >= 2 || Boolean(extra?.emptyPromiseBankrupt);
    return {
      pickIntent: pickIntent || "",
      stallTurns: session?.stallTurns ?? 0,
      neglectWarn: Boolean(extra?.neglectWarn),
      neglectFail: Boolean(extra?.neglectFail),
      redundantOffer: Boolean(extra?.redundantOffer),
      playerNamesMastermind: Boolean(extra?.playerNamesMastermind),
      hollowTradeOffer: Boolean(extra?.hollowTradeOffer),
      tradeOfferNeedsPlayerFirst: Boolean(extra?.tradeOfferNeedsPlayerFirst),
      playerConcreteReveal: Boolean(extra?.playerConcreteReveal),
      playerLine: String(extra?.playerLine || ""),
      emptyPromiseBankrupt: bankrupt,
      emptyPromiseCount: emptyCount,
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

  /** 3 推 1：待核实#1 须清空；双轨/核心词齐备后方可结局 */
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
    if (!hasCoreGoalAchieved(plotSummary, seed)) {
      return false;
    }
    const tracksOk = hasGoalTracksAchieved(plotSummary, seed);
    if (tracksOk === false) {
      return false;
    }
    return true;
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
    detectHollowTradeOffer,
    detectTradeOfferNeedsPlayerFirst,
    hasConcretePlayerInfo,
    isPlayerLineConcrete,
    pickConfirmAfterSharpLine,
    trackEmptyPromise,
    isEmptyPromiseBankrupt,
    bumpNeglectBeforeReply,
    resetNeglectAfterPlotProgress,
    trackPrimaryProgress,
    getNeglectState,
    updateStallCounters,
    replyContextFromSession,
    getPlayerKnowledgeList,
    getAvailableKnowledge,
    pickProgramRevealLine,
    pickProgramInquireLine,
    advanceInquireIndex,
    isGoalAdvancePlayerLine,
    getInquireLines,
    markKnowledgeSpent,
    detectPlayerRevealedKnowledge,
    hasGoalTracksAchieved,
    formatPlayerKnowledgeForOptions,
  };
})();
