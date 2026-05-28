/**
 * 证明席 · 程序侧（种子摘要、摘录、推进计数）。注入 API 的约束块由此生成。
 * 档案格式：数学证明体（论题 G / 前提 / 待证 Lk / 已证 Sk / 证毕）。
 */
(function () {
  function getRoleLabels(seed) {
    return {
      prover: String(seed?.roleLabel || "证官").trim() || "证官",
      player: String(seed?.playerRoleLabel || "证辩者").trim() || "证辩者",
    };
  }

  function isProofTheme(seed) {
    return seed?.proofTheme !== false;
  }

  function resolveEngineIntent(intent) {
    if (window.GameProofIntents?.resolveEngineIntent) {
      return window.GameProofIntents.resolveEngineIntent(intent);
    }
    const t = String(intent || "").trim();
    if (t === "advance" || t === "keypoint") {
      return "keypoint";
    }
    if (t === "decoy") {
      return "decoy";
    }
    if (t === "clarify" || t === "explore" || t === "premise" || t === "followup") {
      return "followup";
    }
    return t;
  }

  function isAdvancePickIntent(intent) {
    return resolveEngineIntent(intent) === "keypoint";
  }

  function isDecoyPickIntent(intent) {
    return resolveEngineIntent(intent) === "decoy";
  }

  /** 从 seed 读取论证配置（兼容 argumentProfile 与旧字段） */
  function getArgumentProfile(seed) {
    const profile = seed?.argumentProfile || {};
    return {
      label: profile.label || "",
      maxOpenClaims:
        Number(profile.maxOpenClaims ?? seed?.maxOpenClaims) > 0
          ? Number(profile.maxOpenClaims ?? seed?.maxOpenClaims)
          : 1,
      maxPremises:
        Number(profile.maxPremises ?? seed?.maxArchiveConfirmed) > 0
          ? Number(profile.maxPremises ?? seed?.maxArchiveConfirmed)
          : 8,
      minPremisesForEnding:
        Number(profile.minPremisesForEnding ?? seed?.endingMinConfirmed) > 0
          ? Number(profile.minPremisesForEnding ?? seed?.endingMinConfirmed)
          : 2,
      minKeypointTurns:
        Number(profile.minKeypointTurns ?? seed?.endingMinKeypointTurns) > 0
          ? Number(profile.minKeypointTurns ?? seed?.endingMinKeypointTurns)
          : 0,
    };
  }

  function getMaxOpenClaims(seed) {
    return getArgumentProfile(seed).maxOpenClaims;
  }

  function getMinPremisesForEnding(seed) {
    return getArgumentProfile(seed).minPremisesForEnding;
  }

  /** 开放引理 = 未证毕的 [待证#n] */
  function openClaims(plotSummary) {
    return extractPendingLines(plotSummary);
  }

  function normalizeProofArchive(text) {
    let s = String(text || "").trim();
    if (!s) {
      return s;
    }
    s = s.replace(/【本局目标】/g, "【论证目标】");
    s = s.replace(/【剧情档案】/g, "【证明席】");
    s = s.replace(/\[已确认\]/g, "[已证]");
    s = s.replace(/锋利供述/g, "证官供述");
    s = s.replace(/玩家供述/g, "证辩者供述");
    s = s.replace(/待剧情推进后填写/g, "待论证推进后填写");
    s = s.replace(/\[待核实#(\d+)\]/gi, "[待证#$1]");
    s = s.replace(/\[待核实\]/gi, "[待证#1]");
    s = s.replace(/【关系与态度】[\s\S]*$/g, "").trim();
    s = s.replace(/\n- \[证毕\]\s*G[^\n]*/gi, "");
    s = s.replace(/\n- \[证毕#G\][^\n]*/gi, "");
    const lines = [];
    for (const raw of s.split("\n")) {
      let line = raw;
      const depInline = line.match(
        /^(\s*)若要证\s+(G|L[\d.]+)\s*，\s*则需证\s+(G|L[\d.]+)\s*[：:]\s*.+$/
      );
      if (depInline) {
        line = `- [依赖] 若要证 ${depInline[2]}，则需证 ${depInline[3]}`;
      } else if (/^\s*若要证\s+(G|L[\d.]+)\s*，\s*则需证\s+(G|L[\d.]+)\s*$/.test(line.trim())) {
        const m = line.trim().match(/若要证\s+(G|L[\d.]+)\s*，\s*则需证\s+(G|L[\d.]+)/);
        if (m) {
          line = `- [依赖] 若要证 ${m[1]}，则需证 ${m[2]}`;
        }
      } else if (/^\s*-\s*\[依赖\]\s*/.test(line)) {
        line = line.replace(/^\s*-\s*\[依赖\]\s*/, "- [依赖] ");
      }
      lines.push(line);
    }
    return lines.join("\n").trim();
  }

  /** 命题间推导依赖（非单句内因果） */
  function formatDependencyLine(fromLabel, toLabel) {
    const from = String(fromLabel || "G").trim();
    const to = String(toLabel || "L1").trim();
    return `- [依赖] 若要证 ${from}，则需证 ${to}`;
  }

  function extractGoalBlock(text) {
    const t = String(text || "");
    return (
      t.match(/【论证目标】[\s\S]*?(?=【|$)/)?.[0] ||
      t.match(/【本局目标】[\s\S]*?(?=【|$)/)?.[0] ||
      ""
    );
  }

  function extractArchiveBody(text) {
    const t = normalizeProofArchive(String(text || ""));
    const m =
      t.match(/【证明席】([\s\S]*?)$/) ||
      t.match(/【剧情档案】([\s\S]*?)$/);
    return m ? m[1].trim() : "";
  }

  function extractArchiveSection(text) {
    const t = normalizeProofArchive(String(text || ""));
    const m =
      t.match(/(【证明席】[\s\S]*?)$/) ||
      t.match(/(【剧情档案】[\s\S]*?)$/);
    return m ? m[1].trim() : "";
  }

  function extractDependencyLines(text) {
    const lines = [];
    for (const line of extractArchiveBody(text).split("\n")) {
      const t = line.trim();
      if (/\[依赖\]/.test(t) || /^\s*若要证\s+(G|L[\d.]+)\s*，\s*则需证/.test(t)) {
        lines.push(t.replace(/^[-*•]\s*/, ""));
      }
    }
    return lines;
  }

  function extractQedOrders(text) {
    const orders = new Set();
    for (const line of String(text || "").split("\n")) {
      const m = line.trim().match(/\[证毕#?([\da-z]+)?\]/i);
      if (m) {
        orders.add(m[1] || "1");
      }
    }
    return orders;
  }

  function parsePendingFromLine(trimmed) {
    let m = trimmed.match(/^[-*•]?\s*\[待证#?([\da-z]+)?\]\s*(.*)$/i);
    if (m) {
      return { orderKey: m[1] || "1", text: m[2].trim() || trimmed };
    }
    m = trimmed.match(/^[-*•]?\s*\[待核实#?([\da-z]+)?\]\s*(.*)$/i);
    if (m) {
      return { orderKey: m[1] || "1", text: m[2].trim() || trimmed };
    }
    if (/^[-*•]\s*\[待证\]/i.test(trimmed) || /^\[待证\]/i.test(trimmed)) {
      return {
        orderKey: "1",
        text: trimmed.replace(/^[-*•]\s*\[待证\]\s*/i, "").trim(),
      };
    }
    if (/^[-*•]\s*\[待核实\]/i.test(trimmed) || /^\[待核实\]/i.test(trimmed)) {
      return {
        orderKey: "1",
        text: trimmed.replace(/^[-*•]\s*\[待核实\]\s*/i, "").trim(),
      };
    }
    return null;
  }

  function buildSeedPlotSummary(seed) {
    const goal = String(seed?.goal || seed?.theorem || "").trim();
    const confirmed = (seed?.confirmed || seed?.premises || [])
      .map((s) => String(s).trim())
      .filter(Boolean);
    const pending = (seed?.pending || seed?.openLemmas || [])
      .map((s) => String(s).trim())
      .filter(Boolean);

    const lines = [];
    if (goal) {
      lines.push("【论证目标】", `- 论题 G：${goal}`, "");
    }
    lines.push("【证明席】", "【前提集】");
    confirmed.forEach((c, i) => {
      const body = c.replace(/^P\d+[：:]\s*/i, "").trim();
      lines.push(`- [前提] P${i + 1}：${body}`);
    });
    lines.push("", "【证明进程】");
    pending.forEach((p, i) => {
      const n = i + 1;
      const body = p.replace(/^L\d+[：:]\s*/i, "").trim();
      lines.push(`- [待证#${n}] L${n}：${body}`);
      lines.push(formatDependencyLine("G", `L${n}`));
    });
    if (!confirmed.length && !pending.length) {
      lines.push("- [待证#1] L1：（待填）");
      lines.push(formatDependencyLine("G", "L1"));
    }
    return lines.join("\n").trim();
  }

  function extractGoal(text) {
    const block = extractGoalBlock(text);
    if (!block) {
      return "";
    }
    const inline = block.match(/论题\s*G[：:]\s*(.+?)(?:\n|$)/);
    if (inline?.[1]) {
      return inline[1].trim().replace(/[。.]\s*$/, "");
    }
    const items = [];
    for (const line of block.split("\n")) {
      const m = line.trim().match(/^[-*•]\s+(?:论题\s*G[：:]\s*)?(.+)$/);
      if (m) {
        items.push(m[1].trim());
      }
    }
    return items.join("；");
  }

  function extractPendingLines(text) {
    const body = normalizeProofArchive(String(text || "").trim());
    if (!body) {
      return [];
    }
    const qed = extractQedOrders(body);
    const items = [];
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      if (/^\s*若要证/.test(trimmed) && !/\[待证|\[待核实|\[依赖\]/.test(trimmed)) {
        continue;
      }
      if (/^\s*-\s*\[依赖\]/.test(trimmed)) {
        continue;
      }
      const parsed = parsePendingFromLine(trimmed);
      if (!parsed) {
        continue;
      }
      const key = parsed.orderKey || String(items.length + 1);
      if (qed.has(key)) {
        continue;
      }
      items.push({ orderKey: key, text: parsed.text });
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

  /** 发给 API：论题 + 待证 + 最近已证/前提 */
  function compactPlotSummaryForApi(plotSummary, maxConfirmed = 6) {
    const text = normalizeProofArchive(String(plotSummary || "").trim());
    if (!text) {
      return "";
    }
    const goalBlock = extractGoalBlock(text)?.trim() || "";
    const archiveBody = extractArchiveBody(text);
    const proven = [];
    const pending = [];
    const deps = [];
    for (const line of archiveBody.split("\n")) {
      const t = line.trim();
      if (!t || /^【/.test(t)) {
        continue;
      }
      if (/\[依赖\]|^\s*若要证\s+(G|L[\d.]+)\s*，\s*则需证/.test(t)) {
        deps.push(t.replace(/^[-*•]\s*/, ""));
      } else if (/\[已证\]|\[已确认\]|\[前提\]/.test(t)) {
        proven.push(t);
      } else if (/\[待证|\[待核实/.test(t)) {
        pending.push(t);
      }
    }
    const tailProven = proven.slice(-maxConfirmed);
    const parts = [];
    if (goalBlock) {
      parts.push(goalBlock);
    }
    parts.push("【证明席】");
    if (tailProven.some((l) => /\[前提\]/.test(l))) {
      parts.push("【前提集】");
    }
    parts.push(...tailProven, ...pending, ...deps.slice(-3));
    return parts.join("\n").trim();
  }

  function countLayers(plotSummary) {
    const text = normalizeProofArchive(String(plotSummary || ""));
    const premises = (text.match(/\[前提\]/g) || []).length;
    const proven =
      (text.match(/\[已证\]/g) || []).length +
      (text.match(/\[已确认\]/g) || []).length;
    const pending = extractPendingLines(text).length;
    const qed = extractQedOrders(text).size;
    const goal = extractGoal(text) ? 1 : 0;
    return { confirmed: premises + proven, premises, proven, pending, qed, goal };
  }

  /** ② 选项 user：本局态势 + 写法 */
  function formatOptionsBlock(plotSummary, context) {
    const goal = extractGoal(plotSummary);
    const pending = extractPendingLines(plotSummary);
    if (!goal && pending.length === 0) {
      return "";
    }
    const stallTurns = context?.stallTurns ?? 0;
    const deps = extractDependencyLines(plotSummary);
    const lastSharp = String(context?.lastAssistantLine || "").trim();
    const inquireStreak = countRecentFollowupStreak(context?.session);
    const labels = getRoleLabels(context?.seed);
    const parts = ["【证明态势】"];
    if (goal) {
      parts.push(goal.startsWith("论题") ? goal : `论题 G：${goal}`);
    }
    if (pending.length) {
      const label = (t) => String(t || "").replace(/^L\d+[：:]\s*/i, "").trim();
      const pendingNote =
        pending.length === 1
          ? `开放引理 L1：${label(pending[0])}`
          : `开放引理：${pending.map((p, i) => `L${i + 1}·${label(p)}`).join("；")}`;
      parts.push(pendingNote);
    }
    if (deps.length) {
      parts.push(`命题依赖：${deps.slice(-2).join("；")}`);
    }
    if (lastSharp) {
      parts.push(`${labels.prover}上一句：${lastSharp}`);
    }
    parts.push(
      "",
      "【选项写法】",
      "共 3 条推证句：1 条 advance（正确，须实质推进当前 Lk）+ 2 条 decoy（似真误推，不可推进 Lk）。",
      "decoy 类型：跳步、循环论证、误用前提、证错命题、把定义当推导等。",
      "三句难度相近；程序随机排列按钮位置。"
    );
    if (inquireStreak >= 2) {
      parts.push("连续多轮未选 advance：本轮 advance 须直指待证 Lk。");
    }
    if (stallTurns >= 2) {
      parts.push("连续无进展：advance 须给出可核对推导步或引理交换。");
    }
    if (context?.emptyPromiseCount >= 2) {
      parts.push("空头交换过多：advance 仅确认已写入证明席的事实。");
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
      return "请先说明采用何种证法。";
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

  /** ① reply system：按证辩者 intent + 僵局动态约束 */
  function formatReplyHint(plotSummary, context) {
    const goal = extractGoal(plotSummary);
    const pending = extractPendingLines(plotSummary);
    if (!pending.length && !goal) {
      return "";
    }
    const pickIntent = resolveEngineIntent(context?.pickIntent || "");
    const stallTurns = context?.stallTurns ?? 0;
    const lines = [];

    const exchange = formatExchangeContract(plotSummary, context);
    if (exchange) {
      lines.push(exchange);
    }

    if (pickIntent === "followup") {
      lines.push(
        "【了解轮】（旧 intent）用陈述解释，禁止问句"
      );
      if (countRecentFollowupStreak(context?.session) >= 2) {
        lines.push("证辩者多轮了解：可加一句可核对推导步破冰，仍用陈述");
      }
      lines.push("证官台词：只答不问");
      return `\n【证明规则·本轮】\n${lines.map((l) => `- ${l}`).join("\n")}\n`;
    }

    if (context?.wrongProofPick) {
      lines.push(
        "证辩者选了**错误推证**（decoy）；指出跳步/误用前提/方向错误，不给新进展",
        "用陈述句，禁止问句"
      );
    } else if (context?.playerConcreteReveal && pickIntent === "keypoint") {
      lines.push(
        "证辩者已出示引理（含可核对专名）。须兑现交换：直接给出一条新推导步",
        "禁止推托；禁止只顶回不给步；**禁止问句**"
      );
    } else if (context?.emptyPromiseBankrupt) {
      lines.push(
        "证辩者多次空头交换；拒绝再论",
        "只回复：「没引理就别换步。」本轮不给新推导步"
      );
    } else if (context?.hollowTradeOffer) {
      lines.push(
        "证辩者未出示引理却要推导步；不得先给新步",
        "回复：「先把你的引理讲实，我再补一步。」"
      );
    }
    if (context?.redundantOffer) {
      lines.push(
        "证辩者复读证明席已有前提；回复「这步已知，拿新引理来换」",
        "不得因复读再送新推导步"
      );
    }
    if (context?.neglectWarn) {
      lines.push("证辩者长期未选 advance 出示引理；语气加压（仅推证轮）");
    }
    if (context?.neglectFail) {
      lines.push("终局：证辩者不肯出示引理，论证时限到，休庭");
    }

    if (stallTurns >= 2) {
      lines.push(
        "连续无进展：须给出一条可核对推导步，用陈述句",
        "禁止向证辩者发问；禁止空耗"
      );
    } else if (pickIntent === "keypoint" && !context?.playerConcreteReveal) {
      if (isGoalAdvancePlayerLine(context?.playerLine)) {
        lines.push("证辩者在逼 Lk；给出一条具体推导步或明确否认，**禁止问句**");
      } else {
        lines.push("证辩者推证；给出具体推导步、承认或否认，勿搪塞，**禁止问句**");
      }
    }

    lines.push("证官台词：只答不问（无 ？/?，不以吗/呢 发问）");

    if (goal) {
      lines.push(goal.startsWith("论题") ? goal : `论题 G：${goal}`);
    }
    if (pending[0]) {
      lines.push(`优先待证：${pending[0]}`);
    }

    return `\n【证明规则·本轮】\n${lines.map((l) => `- ${l}`).join("\n")}\n`;
  }

  function updateStallCounters(session, plotSummary) {
    if (!session) {
      return { stallTurns: 0, confirmed: 0 };
    }
    const confirmed = countLayers(plotSummary).confirmed;
    const prev = session.lastConfirmedCount ?? 0;
    const lastAssistant = [...(session.messages || [])]
      .reverse()
      .find((m) => m.role === "assistant" && m.status === "done");
    if (assistantReplyAdvancesPlot(lastAssistant?.content, plotSummary)) {
      session.stallTurns = 0;
      session.lastConfirmedCount = confirmed;
      return { stallTurns: 0, confirmed };
    }
    if (session.lastPickIntent && resolveEngineIntent(session.lastPickIntent) === "followup") {
      session.lastConfirmedCount = confirmed;
      return { stallTurns: session.stallTurns || 0, confirmed };
    }
    if (confirmed > prev) {
      session.stallTurns = 0;
    } else if (mastermindNamedInArchive(plotSummary) && extractPendingLines(plotSummary).length === 0) {
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
  /** followup 选项不得含：逼开放引理 / 引理交换话术 */
  const GOAL_ADVANCE_LINE_RE =
    /换你|换一句|换一条|谁派|幕后|凭什么|别绕|说清楚|开口|心里鬼|谁先答|引理包|账本|数据集|Λ|α|β|Ω|陈四|刘老三|老九|赵家/;
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
    return hits.length >= 2 || (hits.length >= 1 && /经手|Λ|数据集|β|账本|钥匙|保险柜|女儿/.test(line));
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

  function isPlayerLineConcrete(playerLine, seed, session) {
    const line = String(playerLine || "").trim();
    if (!line) {
      return false;
    }
    if (hasConcretePlayerInfo(line)) {
      return true;
    }
    if (seed && detectPlayerRevealedKnowledge(line, seed, session)) {
      return true;
    }
    if (seed) {
      for (const k of getPlayerKnowledgeList(session, seed)) {
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

  /** 证辩者提出交换但未给出可核对的具体信息（空头交换） */
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
        return `你已承认「${m[1]}」，请补全对当前待证 Lk 的推导步。`;
      }
    }
    return "";
  }

  function isEmptyPromiseBankrupt(session) {
    return (session?.emptyPromiseCount || 0) >= 2;
  }

  function usesDynamicPlayerEvidence(seed) {
    return seed?.dynamicPlayerEvidence !== false;
  }

  function getSeedKnowledgeList(seed) {
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

  function getSessionEvidenceList(session) {
    if (!Array.isArray(session?.playerEvidence)) {
      return [];
    }
    return session.playerEvidence
      .map((k) => ({
        id: String(k?.id || "").trim(),
        match: String(k?.match || "").trim(),
        text: String(k?.text || "").trim(),
        offerLine: String(k?.offerLine || k?.text || "").trim(),
      }))
      .filter((k) => k.id && k.offerLine);
  }

  /** 可出示引理：动态池优先，否则回退 seed.playerKnowledge */
  function getPlayerKnowledgeList(session, seed) {
    if (usesDynamicPlayerEvidence(seed)) {
      return getSessionEvidenceList(session);
    }
    return getSeedKnowledgeList(seed);
  }

  function getAvailableKnowledge(session, seed) {
    const spent = session?.spentPlayerKnowledge || [];
    return getPlayerKnowledgeList(session, seed).filter((k) => !spent.includes(k.id));
  }

  function formatPlayerKnowledgeForOptions(session, seed) {
    const avail = getAvailableKnowledge(session, seed);
    const label = usesDynamicPlayerEvidence(seed) ? "【证辩者引理】" : "【证辩者已知】";
    if (!avail.length) {
      return `${label}（暂无未用引理；advance 须确认证官上一句或陈述新事实）`;
    }
    const lines = avail.map(
      (k, i) => `  ${i + 1}. ${k.text} → offer:「${k.offerLine}」`
    );
    return `${label}（advance 须用 offer 原句出示引理）\n${lines.join("\n")}`;
  }

  function pickProgramRevealLine(session, seed) {
    const next = getAvailableKnowledge(session, seed)[0];
    return next?.offerLine || "";
  }

  const DEFLECT_REPLY_RE =
    /你心里|心里清楚|别装|你该去问|问太多|反倒可疑|爱信不信|不护谁|疑心太重|随你|误事|少说|废话|挡话|栽我身上/;

  /** followup 短拒白名单：≤20 字顶回，不算敷衍（A4） */
  const FOLLOWUP_SHORT_ACCEPT_RE =
    /不关我事|与你无关|别挡|少管|来意|套话|谈事|你自己的事|与我何干|爱咋咋|随你便|休庭|公理基|逐步来|别跳步/;

  function isFollowupShortAccept(text) {
    const t = String(text || "").trim();
    return t.length >= 2 && t.length <= 20 && FOLLOWUP_SHORT_ACCEPT_RE.test(t);
  }

  const MASTERMIND_NAMED_IN_ARCHIVE_RE =
    /(?:赵二爷|赵爷|老九|赵家|二爷).{0,16}(?:主使|指使|幕后|听命|指使者)|(?:主使|指使|指使者).{0,12}(?:赵二爷|赵爷|老九|二爷)|听命于(?:赵二爷|赵爷|老九)/;

  const MASTERMIND_FINAL_CLAIM_RE =
    /唯一主使|就是主使|乃是主使|主使.{0,10}没有别人|没有更高层|否认有更高|没有别人/;

  function archiveBlob(plotSummary) {
    const lines = extractConfirmedLines(plotSummary);
    const body = extractArchiveBody(plotSummary) || "";
    for (const line of body.split("\n")) {
      const t = line.trim();
      if (/\[证毕#?[\da-z]*\]/i.test(t)) {
        lines.push(t.replace(/^[-*•]\s*/, ""));
      }
    }
    return lines.join("\n");
  }

  /** 排除开局种子「可作筹码」行，只算对局内新供述 */
  function gameplayConfirmedBlob(plotSummary) {
    return extractConfirmedLines(plotSummary)
      .filter((line) => !/可作筹码/.test(line) && !/\[前提\]/.test(line))
      .join("\n");
  }

  /** 档案中主使链已闭合（不绑死赵爷/老九，认模型供出的专名） */
  function mastermindTrackSatisfied(blob) {
    const text = String(blob || "");
    if (!text) {
      return false;
    }
    if (MASTERMIND_NAMED_IN_ARCHIVE_RE.test(text)) {
      return true;
    }
    if (/证官供述[：:][^。\n]{0,48}(?:授权|指使|指使者|主使|主控)/.test(text)) {
      return true;
    }
    if (/锋利供述[：:][^。\n]{0,48}(?:指使|指使者|主使)/.test(text)) {
      return true;
    }
    if (MASTERMIND_FINAL_CLAIM_RE.test(text)) {
      return true;
    }
    if (
      /(?:指使|指使者|主使|幕后).{0,16}[\u4e00-\u9fa5]{2,6}|[\u4e00-\u9fa5]{2,6}.{0,12}(?:指使|指使者|主使)/.test(
        text
      )
    ) {
      return true;
    }
    return false;
  }

  function isDeflectReply(text, pickIntent) {
    const t = String(text || "").trim();
    if (pickIntent === "followup" && isFollowupShortAccept(t)) {
      return false;
    }
    return DEFLECT_REPLY_RE.test(t);
  }

  function extractMastermindLabel(plotSummary, lastSharp) {
    const blob = `${archiveBlob(plotSummary)}\n${lastSharp || ""}`;
    const patterns = [
      /指使者(?:是|乃|为)(?:账房总管)?([\u4e00-\u9fa5]{2,6})/,
      /指使(?:者)?(?:是|乃|为)(?:账房总管)?([\u4e00-\u9fa5]{2,6})/,
      /背后是(?:账房总管)?([\u4e00-\u9fa5]{2,6})/,
      /(账房总管[\u4e00-\u9fa5]{2,4})/,
      /([\u4e00-\u9fa5]{2,6})(?:就是|乃是)?(?:唯一)?主使/,
      /(赵二爷|赵爷|老九|二爷|[\u4e00-\u9fa5]{2,4}德柱)/,
    ];
    for (const re of patterns) {
      const m = blob.match(re);
      if (m?.[1]) {
        return m[1].trim();
      }
    }
    return "幕后主使";
  }

  function formatMastermindConfirmLabel(name) {
    const n = String(name || "").trim();
    if (!n || n === "幕后主使" || n === "主控者") {
      return "该步你已承认，请补全对当前 Lk 的推导步。";
    }
    if (/主使|指使|幕后|主控|授权/.test(n)) {
      return `${n}已写入证明席，请据此推进 Lk。`;
    }
    return `${n}已确立，请据此补全对当前 Lk 的推导步。`;
  }

  /** 推进选项：优先未消耗引理；主链已闭合则确认句 */
  function pickKeypointOfferLine(session, seed, plotSummary, lastSharp) {
    const avail = getAvailableKnowledge(session, seed);
    if (avail[0]?.offerLine) {
      return avail[0].offerLine;
    }
    const line = String(lastSharp || "").trim();
    const blob = extractConfirmedLines(plotSummary).join("");
    const pending = extractPendingLines(plotSummary)[0] || "";
    if (mastermindNamedInArchive(plotSummary) || mastermindNamedInLine(line)) {
      const name = extractMastermindLabel(plotSummary, line);
      return formatMastermindConfirmLabel(name);
    }
    if (/授权者|主控|指使者|幕后|主使/.test(pending) && !mastermindTrackSatisfied(blob)) {
      return pending ? `就「${pending.slice(0, 24)}」，换你说可核对推导步。` : "请就开放引理 L1 给出可核对推导步。";
    }
    return "";
  }

  function pickProgramStatementFallback(seed) {
    const pool = seed?.sharpStatementFallbacks;
    if (!Array.isArray(pool) || !pool.length) {
      return "先把逻辑步讲实，我再补一步。";
    }
    return String(pool[0]).trim();
  }

  function mastermindNamedInArchive(plotSummary) {
    return mastermindTrackSatisfied(archiveBlob(plotSummary));
  }

  function mastermindNamedInLine(line) {
    const t = String(line || "").trim();
    if (!t) {
      return false;
    }
    if (MASTERMIND_NAMED_IN_ARCHIVE_RE.test(t)) {
      return true;
    }
    if (/指使|指使者|主使|幕后|听命/.test(t) && /[\u4e00-\u9fa5]{2,6}/.test(t)) {
      return true;
    }
    if (MASTERMIND_FINAL_CLAIM_RE.test(t)) {
      return true;
    }
    return false;
  }

  function pendingIsResolvedMeta(pendingText, plotSummary) {
    const p = String(pendingText || "");
    if (!p) {
      return false;
    }
    const blob = archiveBlob(plotSummary);
    if (!mastermindTrackSatisfied(blob) && !MASTERMIND_FINAL_CLAIM_RE.test(blob)) {
      return false;
    }
    return /是否|需核实|矛盾|身份与|实际在|最终指使者|更高层|另有/.test(p);
  }

  function pendingTargetAlreadyNamed(pendingText, plotSummary) {
    const p = String(pendingText || "");
    if (!/是否|需确认|最终|更高层|即为/.test(p)) {
      return false;
    }
    const blob = gameplayConfirmedBlob(plotSummary);
    const name =
      p.match(/([\u4e00-\u9fa5]{2,6})(?:是否|即为)/)?.[1] ||
      p.match(/(赵二爷|赵爷|老九|赵德柱)/)?.[1];
    if (!name) {
      return false;
    }
    return blob.includes(name) && /指使|主使|指使者|供述/.test(blob);
  }

  function shouldClearPendingLine(pendingText, plotSummary) {
    const p = String(pendingText || "").trim();
    if (!p || isVacuousPendingText(p)) {
      return true;
    }
    if (pendingIsResolvedMeta(p, plotSummary)) {
      return true;
    }
    if (pendingTargetAlreadyNamed(p, plotSummary)) {
      return true;
    }
    const blob = archiveBlob(plotSummary);
    if (/指使者|主使|幕后|谁派|指使/.test(p)) {
      return (
        mastermindTrackSatisfied(blob) || MASTERMIND_FINAL_CLAIM_RE.test(blob)
      );
    }
    return false;
  }

  function shouldClearPendingBlock(plotSummary) {
    const pending = extractPendingLines(plotSummary);
    if (!pending.length) {
      return false;
    }
    return pending.every((p) => shouldClearPendingLine(p, plotSummary));
  }

  function isVacuousPendingText(text) {
    const p = String(text || "").trim();
    if (!p) {
      return true;
    }
    return /^(?:[（(]?无[）)]?|暂无|未知|待填|待论证推进后填写|待剧情推进后填写)$/.test(p);
  }

  function extractClaimName(line, slotId) {
    const t = String(line || "");
    if (slotId === "mastermind") {
      const patterns = [
        /而是([\u4e00-\u9fa5]{2,6})/,
        /的是([\u4e00-\u9fa5]{2,6})(?:[，。；]|$)/,
        /指使[\u4e00-\u9fa5]{0,8}的是([\u4e00-\u9fa5]{2,6})/,
        /指使者(?:是|乃|为)(?:账房总管)?([\u4e00-\u9fa5]{2,6})/,
        /([\u4e00-\u9fa5]{2,6})(?:就是|乃是)?(?:唯一)?主使/,
        /([\u4e00-\u9fa5]{2,6}).{0,8}(?:指使|派我)/,
        /(赵二爷|赵爷|老九|赵德柱|[\u4e00-\u9fa5]{2,4}德柱)/,
      ];
      for (const re of patterns) {
        const m = t.match(re);
        if (m?.[1]) {
          return m[1].trim();
        }
      }
    }
    if (slotId === "ledger") {
      const patterns = [
        /不在([\u4e00-\u9fa5]{2,6})手里/,
        /账本(?:在|于|还在)?([\u4e00-\u9fa5]{2,6})/,
        /经手人(?:是|为)([\u4e00-\u9fa5]{2,6})/,
        /([\u4e00-\u9fa5]{2,6})(?:手里|手上|保管)/,
      ];
      for (const re of patterns) {
        const m = t.match(re);
        if (m?.[1]) {
          return m[1].trim();
        }
      }
    }
    return "";
  }

  /** 档案中同 slot 是否仍有未标记 [已推翻] 的双真值（A2.1） */
  function hasUnresolvedSlotContradiction(plotSummary, seed) {
    const section = extractArchiveSection(plotSummary);
    if (!section) {
      return false;
    }
    const bodyLines = section.split("\n").slice(1);
    const slotIds = Object.keys(seed?.goalTracks || { mastermind: {} });
    for (const slotId of slotIds) {
      const kws = seed?.goalTracks?.[slotId]?.keywords || [];
      if (!kws.length) {
        continue;
      }
      const names = [];
      for (const line of bodyLines) {
        if (!/\[已证\]|\[已确认\]/.test(line) || /\[已推翻\]/.test(line)) {
          continue;
        }
        if (!kws.some((k) => line.includes(String(k).trim()))) {
          continue;
        }
        const name = extractClaimName(line, slotId);
        if (name) {
          names.push(name);
        }
      }
      if ([...new Set(names)].length > 1) {
        return true;
      }
    }
    return false;
  }

  function slotClosed(plotSummary, seed, slotId) {
    const tracks = seed?.goalTracks;
    if (!tracks?.[slotId]) {
      return null;
    }
    if (slotId === "mastermind") {
      return mastermindTrackSatisfied(archiveBlob(plotSummary));
    }
    const kws = tracks[slotId]?.keywords || [];
    const blob = archiveBlob(plotSummary);
    return kws.some((k) => blob.includes(String(k).trim()));
  }

  /** 必填 slot 闭合情况（供 debug / 结局） */
  function slotCoverage(plotSummary, seed) {
    const tracks = seed?.goalTracks;
    if (!tracks || typeof tracks !== "object") {
      return {};
    }
    const out = {};
    for (const slotId of Object.keys(tracks)) {
      out[slotId] = slotClosed(plotSummary, seed, slotId) === true;
    }
    return out;
  }

  /** 槽位单真值：改口则标记 [已推翻]，删占位待证（A2） */
  function reconcileEvidenceSlots(text, seed) {
    let result = normalizeProofArchive(String(text || "").trim());
    if (!result) {
      return result;
    }
    result = result.replace(
      /\n- \[待证#[^\]]*\]\s*[（(]?(?:无|暂无|待填|待论证推进后填写|待剧情推进后填写)[）)]?[^\n]*/gi,
      ""
    );
    result = result.replace(
      /\n- \[待核实#[^\]]*\]\s*[（(]?(?:无|暂无|待填|待论证推进后填写|待剧情推进后填写)[）)]?[^\n]*/gi,
      ""
    );
    result = result.replace(/\n- \[待证\]\s*[（(]?(?:无|暂无)[）)]?[^\n]*/gi, "");
    result = result.replace(/\n- \[待核实\]\s*[（(]?(?:无|暂无)[）)]?[^\n]*/gi, "");

    const archiveMatch =
      result.match(/(【证明席】[\s\S]*?)$/) ||
      result.match(/(【剧情档案】[\s\S]*?)$/);
    if (!archiveMatch) {
      return result.trim();
    }
    const head = archiveMatch[1].split("\n").slice(0, 1);
    const bodyLines = archiveMatch[1].split("\n").slice(1);
    const slotIds = Object.keys(seed?.goalTracks || { mastermind: {}, ledger: {} });

    for (const slotId of slotIds) {
      const kws = seed?.goalTracks?.[slotId]?.keywords || [];
      if (!kws.length) {
        continue;
      }
      const claims = [];
      for (let i = 0; i < bodyLines.length; i++) {
        const line = bodyLines[i];
        if (!/\[已证\]|\[已确认\]/.test(line) || /\[已推翻\]/.test(line)) {
          continue;
        }
        if (!kws.some((k) => line.includes(String(k).trim()))) {
          continue;
        }
        const name = extractClaimName(line, slotId);
        if (name) {
          claims.push({ i, name });
        }
      }
      const uniqueNames = [...new Set(claims.map((c) => c.name))];
      if (uniqueNames.length <= 1) {
        continue;
      }
      const keep = claims[claims.length - 1];
      for (const c of claims) {
        if (c.i !== keep.i && !/\[已推翻\]/.test(bodyLines[c.i])) {
          bodyLines[c.i] = bodyLines[c.i].replace(
            /(\[已证\]|\[已确认\])/,
            "$1 [已推翻]"
          );
        }
      }
    }

    const newArchive = [...head, ...bodyLines].join("\n");
    result = result.replace(archiveMatch[1], newArchive);
    return result.trim();
  }

  function stripClearablePendingLines(text) {
    let result = normalizeProofArchive(String(text || ""));
    const pending = extractPendingLines(result);
    if (!pending.length) {
      return result;
    }
    for (const p of pending) {
      if (shouldClearPendingLine(p, result)) {
        const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(
          new RegExp(`\\n- \\[待证#?\\d*\\]\\s*${escaped}`, "gi"),
          ""
        );
        result = result.replace(
          new RegExp(`\\n- \\[待核实#?\\d*\\]\\s*${escaped}`, "gi"),
          ""
        );
        result = result.replace(/\n- \[依赖\][^\n]*/gi, "");
        result = result.replace(/\n\s*若要证[^\n]*/gi, "");
      }
    }
    result = result.replace(/\n- \[待证#[^\]]*\][^\n]*/gi, (line) => {
      const m = line.match(/\[待证[^\]]*\]\s*(.*)$/i);
      return m && isVacuousPendingText(m[1]) ? "" : line;
    });
    result = result.replace(/\n- \[待核实#[^\]]*\][^\n]*/gi, (line) => {
      const m = line.match(/\[待核实[^\]]*\]\s*(.*)$/i);
      return m && isVacuousPendingText(m[1]) ? "" : line;
    });
    return result;
  }

  /** 论证闭合：无未决开放论断 + 必填 slot 闭合 + 核心目标词（A3） */
  function isArgumentClosed(plotSummary, seed) {
    if (!extractGoal(plotSummary)) {
      return false;
    }
    if (hasUnresolvedSlotContradiction(plotSummary, seed)) {
      return false;
    }
    const claims = openClaims(plotSummary);
    const maxOpen = getMaxOpenClaims(seed);
    if (claims.length > maxOpen) {
      return false;
    }
    const blocking = claims.filter((p) => !shouldClearPendingLine(p, plotSummary));
    if (blocking.length > 0) {
      return false;
    }
    if (!hasCoreGoalAchieved(plotSummary, seed)) {
      return false;
    }
    const coverage = slotCoverage(plotSummary, seed);
    const slotIds = Object.keys(coverage);
    if (slotIds.length > 0 && slotIds.some((id) => !coverage[id])) {
      return false;
    }
    const tracksOk = hasGoalTracksAchieved(plotSummary, seed);
    if (tracksOk === false) {
      return false;
    }
    return true;
  }

  /** 压摘要后：待证 Lk 闭合则删 #1；裁剪档案膨胀 */
  function reconcilePlotSummary(plotSummary, seed) {
    let text = normalizeProofArchive(String(plotSummary || "").trim());
    if (!text) {
      return text;
    }
    text = reconcileEvidenceSlots(text, seed);
    text = stripClearablePendingLines(text);
    text = text.replace(/\n- \[已证\][^\n]*可能意在[^\n]*/gi, "");
    text = text.replace(/\n- \[已证\][^\n]*存疑[^\n]*/gi, "");
    text = text.replace(/\n- \[已证\][^\n]*(?:指出跳步|跳步：|纠错|未认可|证官.*拒)[^\n]*/gi, "");
    text = text.replace(/\n- \[已确认\][^\n]*可能意在[^\n]*/gi, "");
    text = text.replace(/\n- \[已确认\][^\n]*存疑[^\n]*/gi, "");
    const archiveMatch =
      text.match(/(【证明席】[\s\S]*?)$/) ||
      text.match(/(【剧情档案】[\s\S]*?)$/);
    if (archiveMatch) {
      const head = archiveMatch[1].split("\n").slice(0, 1);
      const bodyLines = archiveMatch[1].split("\n").slice(1);
      const proven = [];
      const other = [];
      for (const line of bodyLines) {
        const t = line.trim();
        if (!t) {
          continue;
        }
        if (/\[已证\]|\[已确认\]/.test(t)) {
          proven.push(line);
        } else {
          other.push(line);
        }
      }
      const maxProven = getArgumentProfile(seed).maxPremises;
      const trimmed = proven.slice(-maxProven);
      const newArchive = [...head, ...trimmed, ...other].join("\n");
      text = text.replace(archiveMatch[1], newArchive);
    }
    return text.trim();
  }

  function assistantReplyAdvancesPlot(assistantLine, plotSummary) {
    const line = String(assistantLine || "").trim();
    if (!line || isDeflectReply(line)) {
      return false;
    }
    if (!MASTERMIND_NAMED_IN_ARCHIVE_RE.test(line)) {
      return false;
    }
    const blob = extractConfirmedLines(plotSummary).join("");
    return !MASTERMIND_NAMED_IN_ARCHIVE_RE.test(blob);
  }

  function pickProgramSharpReply(session, seed, replyContext) {
    const reveals = seed?.sharpReveals;
    if (!Array.isArray(reveals) || !reveals.length) {
      return "";
    }
    const spent = session?.spentPlayerKnowledge || [];
    for (let i = spent.length - 1; i >= 0; i--) {
      const hit = reveals.find((r) => r.afterKnowledge === spent[i]);
      if (hit?.line) {
        return String(hit.line).trim();
      }
    }
    if ((replyContext?.stallTurns ?? 0) >= 2 || replyContext?.deflectFallback) {
      const idx = session?.sharpRevealIndex ?? 0;
      if (session) {
        session.sharpRevealIndex = idx + 1;
      }
      return String(reveals[idx % reveals.length].line || "").trim();
    }
    return String(reveals[0]?.line || "").trim();
  }

  function countRecentFollowupStreak(session) {
    if (!session?.messages) {
      return 0;
    }
    let n = 0;
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const m = session.messages[i];
      if (m.role !== "user" || m.status === "error") {
        continue;
      }
      if (m.intent && resolveEngineIntent(m.intent) === "followup") {
        n++;
      } else if (m.intent && isAdvancePickIntent(m.intent)) {
        break;
      }
    }
    return n;
  }

  function formatExchangeContract(plotSummary, context) {
    const pickIntent = resolveEngineIntent(context?.pickIntent || "");
    if (pickIntent !== "keypoint") {
      return "";
    }
    const pending = extractPendingLines(plotSummary)[0];
    const lines = [
      "【引理交换·本回合】证辩者出示引理 → 证官须兑现一条新推导步，禁止敷衍",
    ];
    if (pending) {
      lines.push(`须直接推进：${pending}`);
    }
    if (context?.playerConcreteReveal) {
      lines.push(
        "须给出一条可核对推导步（奇偶/整除/等价/矛盾之一），勿同句两条"
      );
    }
    return lines.join("\n");
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
    for (const k of getPlayerKnowledgeList(session, seed)) {
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

  function detectPlayerRevealedKnowledge(playerLine, seed, session) {
    const line = String(playerLine || "");
    return getPlayerKnowledgeList(session, seed).some(
      (k) => k.match && line.includes(k.match)
    );
  }

  function detectLedgerTrackProgress(playerLine, seed) {
    const line = String(playerLine || "");
    const kws = seed?.goalTracks?.ledger?.keywords || [
      "数据集",
      "Λ",
      "引理包",
      "经手",
      "β",
      "保管",
      "前提",
      "符号",
    ];
    return kws.some((k) => line.includes(String(k).trim()));
  }

  function hasGoalTracksAchieved(plotSummary, seed) {
    const tracks = seed?.goalTracks;
    if (!tracks || typeof tracks !== "object") {
      return null;
    }
    const confirmed = archiveBlob(plotSummary);
    for (const key of Object.keys(tracks)) {
      if (key === "mastermind" && mastermindTrackSatisfied(confirmed)) {
        continue;
      }
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

  /** 回合初：根据证辩者本轮台词更新回避 #1 计数（与摘要是否压缩无关） */
  function bumpNeglectBeforeReply(session, playerLine, plotSummary, seed, pickIntent) {
    if (!session) {
      return getNeglectState(session, seed);
    }
    if (pickIntent === "followup" || window.GameProofIntents?.isInquireIntent?.(pickIntent)) {
      return getNeglectState(session, seed);
    }
    if (window.GameProofIntents?.isDecoyIntent?.(pickIntent)) {
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
      if (detectPlayerRevealedKnowledge(playerLine, seed, session)) {
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
      wrongProofPick: Boolean(extra?.wrongProofPick),
    };
  }

  function formatLayersDebug(plotSummary, seed) {
    const { premises, proven, pending, qed, goal } = countLayers(plotSummary);
    const parts = [
      `前提×${premises}`,
      `已证×${proven}`,
      `待证×${pending}`,
    ];
    if (qed > 0) {
      parts.push(`证毕×${qed}`);
    }
    if (goal) {
      parts.push("论题 G 已设");
    }
    if (seed?.goalTracks) {
      const cov = slotCoverage(plotSummary, seed);
      const slotNote = Object.entries(cov)
        .map(([k, v]) => `${k}:${v ? "闭" : "开"}`)
        .join("/");
      if (slotNote) {
        parts.push(`槽位 ${slotNote}`);
      }
    }
    return parts.join(" · ");
  }

  function extractConfirmedLines(text) {
    const archiveBody = extractArchiveBody(text) || String(text || "");
    const lines = [];
    for (const line of archiveBody.split("\n")) {
      const t = line.trim();
      if (/\[已证\]|\[已确认\]|\[前提\]/.test(t)) {
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
    const confirmed = archiveBlob(plotSummary);
    return (
      keywords.some((k) => confirmed.includes(String(k).trim())) ||
      mastermindTrackSatisfied(confirmed)
    );
  }

  function hasSessionEndingProgress(session, seed, plotSummary) {
    if (!session) {
      return false;
    }
    const minKp =
      Number(seed?.endingMinKeypointTurns) > 0 ? seed.endingMinKeypointTurns : 2;
    if ((session.keypointTurnCount || 0) < minKp) {
      return false;
    }
    if (seed?.endingSpendAllKnowledge) {
      const spent = session.spentPlayerKnowledge || [];
      if (usesDynamicPlayerEvidence(seed)) {
        const granted = getSessionEvidenceList(session);
        const minSpend =
          Number(seed?.endingMinEvidenceSpent) > 0
            ? seed.endingMinEvidenceSpent
            : Math.min(2, granted.length);
        const spentCount = granted.filter((e) => spent.includes(e.id)).length;
        if (spentCount < minSpend) {
          return false;
        }
      } else {
        const play = gameplayConfirmedBlob(plotSummary);
        const blockerOk =
          spent.includes("blocker") ||
          /证官供述[^。\n]{0,48}α/.test(play) ||
          /证辩者[^。\n]{0,48}α/.test(play) ||
          /(?:锋利|证官)供述[^。\n]{0,48}陈四/.test(play) ||
          /(?:玩家|证辩者)供述[^。\n]{0,48}陈四/.test(play);
        const ledgerOk =
          spent.includes("ledger") ||
          /证官供述[^。\n]{0,48}(?:β|Λ|数据集)/.test(play) ||
          /证辩者[^。\n]{0,48}(?:β|Λ|数据集)/.test(play) ||
          /(?:锋利|证官)供述[^。\n]{0,48}(?:刘老三|账本)/.test(play) ||
          /(?:玩家|证辩者)供述[^。\n]{0,48}(?:刘老三|账本)/.test(play);
        if (!blockerOk || !ledgerOk) {
          return false;
        }
      }
    }
    return true;
  }

  /** 论证闭合 + 最少前提条数（A3：优先看开放论断/slot，而非单纯数条） */
  function isPlotReadyForEnding(plotSummary, seed) {
    if (!isArgumentClosed(plotSummary, seed)) {
      return false;
    }
    const minPremises = getMinPremisesForEnding(seed);
    const { confirmed } = countLayers(plotSummary);
    if (confirmed < minPremises) {
      return false;
    }
    return true;
  }

  /** 开放引理已全部证毕（无 [待证]，至少一条 [证毕#k]） */
  function isLemmaStackComplete(plotSummary, seed) {
    if (!extractGoal(plotSummary)) {
      return false;
    }
    if (extractPendingLines(plotSummary).length > 0) {
      return false;
    }
    return extractQedOrders(plotSummary).size > 0;
  }

  function getMinLemmaStepsForEnding(seed) {
    const fromSeed = Number(seed?.minLemmaStepsForEnding);
    if (fromSeed > 0) {
      return fromSeed;
    }
    const fromPool = window.GameProofPool?.getMinLemmaStepsForEnding?.(seed?.problemId);
    if (fromPool > 0) {
      return fromPool;
    }
    return 2;
  }

  function appendOpenLemmaToArchive(plotSummary, order, body, dependsOn = "G") {
    const text = normalizeProofArchive(String(plotSummary || "").trim());
    if (!text || !body) {
      return text;
    }
    const n = Number(order) > 0 ? Number(order) : 1;
    const lemmaLine = `- [待证#${n}] L${n}：${String(body).trim()}`;
    const depLine = formatDependencyLine(dependsOn, `L${n}`);
    const marker = "【证明进程】";
    const idx = text.indexOf(marker);
    if (idx >= 0) {
      const insertAt = idx + marker.length;
      const chunk = `\n${lemmaLine}\n${depLine}`;
      return `${text.slice(0, insertAt)}${chunk}${text.slice(insertAt)}`.trim();
    }
    return `${text}\n\n${marker}\n${lemmaLine}\n${depLine}`.trim();
  }

  function ensureOpenLemmaTowardGoal(plotSummary, seed) {
    if (!seed?.aiDriven || !extractGoal(plotSummary)) {
      return plotSummary;
    }
    if (extractPendingLines(plotSummary).length > 0) {
      return plotSummary;
    }
    const qedCount = extractQedOrders(plotSummary).size;
    const minSteps = getMinLemmaStepsForEnding(seed);
    if (qedCount >= minSteps) {
      return plotSummary;
    }
    const nextBody = window.GameProofPool?.getLemmaAtChainIndex?.(
      seed?.problemId,
      qedCount
    );
    if (!nextBody) {
      return plotSummary;
    }
    const nextOrder = qedCount + 1;
    return appendOpenLemmaToArchive(plotSummary, nextOrder, nextBody, "G");
  }

  function isAiDrivenProofComplete(plotSummary, seed) {
    if (!isLemmaStackComplete(plotSummary, seed)) {
      return false;
    }
    const qed = extractQedOrders(plotSummary).size;
    if (qed < getMinLemmaStepsForEnding(seed)) {
      return false;
    }
    const keywords = seed?.endingCoreKeywords;
    if (Array.isArray(keywords) && keywords.length > 0) {
      return hasCoreGoalAchieved(plotSummary, seed);
    }
    return true;
  }

  function isReadyForEnding(plotSummary, seed, session) {
    if (!hasSessionEndingProgress(session, seed, plotSummary)) {
      return false;
    }
    if (seed?.aiDriven) {
      return isAiDrivenProofComplete(plotSummary, seed);
    }
    return isPlotReadyForEnding(plotSummary, seed);
  }

  window.GameOnion = {
    getRoleLabels,
    isProofTheme,
    resolveEngineIntent,
    isAdvancePickIntent,
    isDecoyPickIntent,
    getArgumentProfile,
    getMaxOpenClaims,
    getMinPremisesForEnding,
    openClaims,
    normalizeProofArchive,
    extractArchiveBody,
    extractQedOrders,
    formatDependencyLine,
    extractDependencyLines,
    buildSeedPlotSummary,
    extractGoal,
    extractPendingLines,
    countLayers,
    compactPlotSummaryForApi,
    formatOptionsBlock,
    formatReplyHint,
    formatLayersDebug,
    isReadyForEnding,
    isPlotReadyForEnding,
    isArgumentClosed,
    isLemmaStackComplete,
    isAiDrivenProofComplete,
    getMinLemmaStepsForEnding,
    ensureOpenLemmaTowardGoal,
    appendOpenLemmaToArchive,
    usesDynamicPlayerEvidence,
    getSessionEvidenceList,
    getSeedKnowledgeList,
    slotCoverage,
    reconcileEvidenceSlots,
    isFollowupShortAccept,
    hasSessionEndingProgress,
    extractMastermindLabel,
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
    pickKeypointOfferLine,
    pickProgramSharpReply,
    pickProgramStatementFallback,
    reconcilePlotSummary,
    mastermindNamedInArchive,
    mastermindNamedInLine,
    mastermindTrackSatisfied,
    shouldClearPendingBlock,
    shouldClearPendingLine,
    isVacuousPendingText,
    isDeflectReply,
    countRecentFollowupStreak,
    formatExchangeContract,
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
