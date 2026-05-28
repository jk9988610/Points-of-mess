(function () {
  const OPTION_SPECS =
    window.GameProofIntents?.PROOF_OPTION_SPECS || [
      { id: 1, intent: "advance", label: "推证" },
      { id: 2, intent: "decoy", label: "推证" },
      { id: 3, intent: "clarify", label: "题意" },
      { id: 4, intent: "explore", label: "证法" },
    ];

  /** @deprecated 兼容旧引用 */
  const OPTION_SCHEMA = OPTION_SPECS;

  /** Phase A+：优先 [待证] / [待核实] 行 */
  function extractPendingVerification(plotSummary) {
    const text = String(plotSummary || "").trim();
    if (!text) {
      return "";
    }

    const pendingLines = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      if (
        /^[-*•]\s*\[待证#?\d*\]/i.test(trimmed) ||
        /^[-*•]\s*\[待核实#?\d*\]/i.test(trimmed) ||
        /^\[待证\]/i.test(trimmed) ||
        /^\[待核实\]/i.test(trimmed)
      ) {
        pendingLines.push(trimmed.replace(/^[-*•]\s*/, ""));
      }
    }
    if (pendingLines.length > 0) {
      return pendingLines.join("\n").slice(0, 400);
    }

    const legacy = text.match(/【未解问题】([\s\S]*?)(?=【|$)/);
    if (legacy) {
      return legacy[1].trim().slice(0, 400);
    }

    if (
      (text.includes("【证明席】") || text.includes("【剧情档案】")) &&
      !/\[待证|\[待核实\]/.test(text)
    ) {
      window.PomDebug?.logLocalWarn("摘要摘录", "证明席中无 [待证] 行");
    }

    return text.slice(0, 400);
  }

  function plotSummaryForOptions(plotSummary) {
    const onion = window.GameOnion?.formatOptionsBlock?.(plotSummary);
    if (onion) {
      return onion;
    }
    const excerpt = extractPendingVerification(plotSummary);
    if (!excerpt) {
      return "";
    }
    return `当前证明席（待证引理，供推进型选项参考）：\n${excerpt}`;
  }

  function buildOptionsSystemProof(characterName) {
    const name = String(characterName || "证官").trim() || "证官";
    return `你是证明题选项撰稿人。证辩者与「${name}」对论。输出证辩者下一句（中文 ≤35 字）。

【选项类型】共 4 条，intent 各一：
- advance（正确推证）：须实质推进当前待证 Lk / 论题 G
- decoy（误推证）：表面像推证，但跳步、误用前提或方向错误，**不可**推进 Lk
- clarify（题意）：了解论题 G 或 Lk 含义；给出可核对线索，不推进证明
- explore（证法）：了解证法结构/反证或分步思路；给出可核对线索，不推进证明

decoy 与 advance 语气同为推证请求，难度相近，便于 A/B 辨伪。两了解类互不重复。禁止休庭/离开。偏逻辑，少公式。
只输出 JSON：
{"options":[{"intent":"advance","line":"..."},{"intent":"decoy","line":"..."},{"intent":"clarify","line":"..."},{"intent":"explore","line":"..."}]}`;
  }

  const buildOptionsSystemDuo = buildOptionsSystemProof;

  function buildIntentHintsForApi() {
    return `- advance（正确推证）
- decoy（误推证）
- clarify（题意）
- explore（证法）
- 结束证辩`;
  }

  function applyGoalDrivenOptions(archetype, session, parsedOptions, onionContext) {
    const seed = archetype?.onionSeed;
    if (seed?.aiDriven) {
      return parsedOptions;
    }
    const plotSummary = String(onionContext?.plotSummary || "").trim();
    const lastSharp = String(onionContext?.lastAssistantLine || "").trim();
    let advance = parsedOptions.find((o) => o.intent === "advance");
    let others = parsedOptions.filter((o) => o.intent !== "advance");
    if (!advance) {
      return parsedOptions;
    }
    let advLine = String(advance.line || "").trim();
    const programKp = window.GameOnion?.pickKeypointOfferLine?.(
      session,
      seed,
      plotSummary,
      lastSharp
    );
    if (programKp) {
      const avail = window.GameOnion?.getAvailableKnowledge?.(session, seed) || [];
      const repeatsSpent =
        avail.length > 0 &&
        advLine &&
        !avail.some((k) => advLine.includes(k.match));
      const stall = (onionContext?.stallTurns ?? 0) >= 1;
      if (!advLine || repeatsSpent || stall) {
        advLine = programKp;
      }
    }
    return parsedOptions.map((o) =>
      o.intent === "advance" ? { ...o, line: advLine, send: `[intent:advance] ${advLine}` } : o
    );
  }

  function optionRow(meta, line) {
    const text = String(line || "").trim();
    const send = `[intent:${meta.intent}] ${text}`;
    return {
      ...meta,
      line: text,
      send,
    };
  }

  function buildEndingCloseOptions(duo) {
    const a = String(duo?.closeA || "").trim();
    const b = String(duo?.closeB || "").trim();
    return [
      { id: 1, intent: "close", line: a, send: a },
      { id: 2, intent: "close", line: b, send: b },
    ];
  }

  function parseCloseDuoFromRaw(raw) {
    const obj = extractJsonObject(raw);
    const list = Array.isArray(obj.options) ? obj.options : [];
    const lines = [];
    for (const item of list) {
      const line = lineFromOptionItem(item);
      if (line) {
        lines.push(line);
      }
    }
    if (lines.length < 2 && list[0] && list[1]) {
      lines[0] = lines[0] || lineFromOptionItem(list[0]);
      lines[1] = lines[1] || lineFromOptionItem(list[1]);
    }
    if (lines.length < 2) {
      throw new Error("缺少两条 close 选项");
    }
    return {
      closeA: lines[0].replace(/^「+/, "").replace(/」+$/, ""),
      closeB: lines[1].replace(/^「+/, "").replace(/」+$/, ""),
    };
  }

  async function requestEndingReply({
    character,
    archetype,
    apiMessages,
    plotSummary,
    signal,
  }) {
    const goal = window.GameOnion?.extractGoal?.(plotSummary) || "";
    const name = character.name;
    const epilogueSystem = `${roleStyleFromSystem(archetype.system)}${plotSummaryBlock(plotSummary)}
【结局轮·宣布】本局目标已达成：${goal}
你是「${name}」。用 1～2 句中文（≤40 字）向证辩者**点明证毕**（论题 G 已闭合、证明如何收束）。${CHARACTER_REPLY_RULE}
只输出角色台词，不要 JSON。`;

    const raw = await window.ChatApi.completeChat({
      systemPrompt: epilogueSystem,
      messages: apiMessages,
      temperature: window.PomTokens?.TEMP_REPLY ?? 0.4,
      max_tokens: tokenLimit("REPLY_ONLY", 768),
      signal,
      debugLabel: "结局·①宣布",
    });
    function filterEndingReply(text) {
      let t = String(text || "").trim();
      t = t.replace(/^([\u4e00-\u9fa5]{2,8})[？?]/, "$1，");
      t = t.replace(/[？?]/g, "。");
      if (!t || isWeakReply(t) || window.GameOnion?.isDeflectReply?.(t)) {
        return "";
      }
      return t;
    }

    let reply = filterEndingReply(replyFromRaw(raw));
    if (!reply) {
      reply = String(archetype?.onionSeed?.endingEpilogueFallback || "").trim();
      if (reply) {
        window.PomDebug?.logLocal("结局兜底台词", reply, ["reply-fallback"]);
      }
    }
    if (reply && !isWeakReply(reply)) {
      return reply;
    }
    throw new Error("无法解析结局宣布台词");
  }

  async function requestEndingCloseOptions({
    character,
    archetype,
    session,
    signal,
    plotSummary,
  }) {
    const goal = window.GameOnion?.extractGoal?.(plotSummary) || "";
    const name = character.name;
    const fallback = archetype.closeOptionLines || {
      a: "明白了，我先走。",
      b: "就这样吧。",
    };
    const systemPrompt = `你是选项撰稿人。论题 G 已证毕：${goal}。证辩者与「${name}」对论已收束。
输出证辩者**结束证辩**的两句不同离场白（中文各一句 ≤35 字），都是告别/收口，不要继续追问。

只输出 JSON：
{"options":[{"intent":"close","line":"..."},{"intent":"close","line":"..."}]}`;

    const last =
      [...session.messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.status === "done")?.content || "";
    const userContent = [
      `角色名：${name}`,
      `角色刚宣布的结局台词：${last}`,
      "请输出两条 intent 均为 close 的证辩者离场句。",
    ].join("\n\n");

    let raw = "";
    try {
      raw = await requestOptionsJson({
        systemPrompt,
        userContent,
        temperature: window.PomTokens?.TEMP_OPTIONS ?? 0.4,
        signal,
        logTag: "结局·②close选项",
      });
      return parseCloseDuoFromRaw(raw);
    } catch (e) {
      window.PomDebug?.logLocalWarn("结局 close 选项失败，用预设", e.message);
      return { closeA: fallback.a, closeB: fallback.b };
    }
  }

  async function requestFailureReply({
    character,
    archetype,
    apiMessages,
    plotSummary,
    signal,
  }) {
    const name = character.name;
    const pending = window.GameOnion?.extractPendingLines?.(plotSummary) || [];
    const p1 = pending[0] || "开放引理 L1";
    const failLine = String(archetype.failureLine || "你不出示引理，这证我收不了。").trim();
    const failSystem = `${roleStyleFromSystem(archetype.system)}${plotSummaryBlock(plotSummary)}
【失败轮】证辩者多轮回避 #1「${p1}」。你是「${name}」。
用 1～2 句（≤40 字）休庭收束，参考语气：「${failLine}」。${CHARACTER_REPLY_RULE}
只输出角色台词，不要 JSON。`;

    const raw = await window.ChatApi.completeChat({
      systemPrompt: failSystem,
      messages: apiMessages,
      temperature: window.PomTokens?.TEMP_REPLY ?? 0.4,
      max_tokens: tokenLimit("REPLY_ONLY", 768),
      signal,
      debugLabel: "失败·①终局",
    });
    const reply = replyFromRaw(raw);
    if (reply && !isWeakReply(reply)) {
      return reply;
    }
    return failLine;
  }

  async function requestFailureSequence({
    character,
    archetype,
    session,
    apiMessages,
    signal,
  }) {
    const reply = await requestFailureReply({
      character,
      archetype,
      apiMessages,
      plotSummary: session.plotSummary,
      signal,
    });
    return { reply, options: null };
  }

  async function requestEndingSequence({
    character,
    archetype,
    session,
    apiMessages,
    signal,
  }) {
    const plotSummary = session.plotSummary;
    const reply = await requestEndingReply({
      character,
      archetype,
      apiMessages,
      plotSummary,
      signal,
    });
    const sessionWithReply = {
      messages: [
        ...session.messages,
        { role: "assistant", content: reply, status: "done" },
      ],
    };
    const duo = await requestEndingCloseOptions({
      character,
      archetype,
      session: sessionWithReply,
      signal,
      plotSummary,
    });
    return { reply, options: buildEndingCloseOptions(duo) };
  }

  function parseMultiOptionsFromRaw(raw) {
    const obj = extractJsonObject(raw);
    const list = Array.isArray(obj.options) ? obj.options : [];
    const parsed = [];
    for (const item of list) {
      const intent = window.GameProofIntents?.normalizeUiIntent?.(item?.intent) || "";
      const line = lineFromOptionItem(item);
      if (intent && line) {
        parsed.push({ intent, line: line.replace(/^「+/, "").replace(/」+$/, "") });
      }
    }
    const checkRaw = window.GameProofIntents?.validateProofOptions?.(parsed);
    if (!checkRaw?.ok) {
      throw new Error(checkRaw?.reason || "选项格式无效");
    }
    const options = window.GameProofIntents?.attachOptionIds?.(parsed) || [];
    return options;
  }

  /** @deprecated */
  function parseDuoOptionsFromRaw(raw) {
    const opts = parseMultiOptionsFromRaw(raw);
    return {
      keypoint: opts.find((o) => o.intent === "advance")?.line || "",
      followup: opts.find((o) => o.intent === "clarify")?.line || "",
    };
  }

  function buildProofOptionsList(parsedOptions) {
    return parsedOptions;
  }

  /** @deprecated */
  function buildHybridOptions(archetype, duo) {
    return buildProofOptionsList(
      window.GameProofIntents?.attachOptionIds?.([
        { intent: "advance", line: duo.keypoint },
        { intent: "decoy", line: "这步似可跳过 L1，直接证 G？" },
        { intent: "clarify", line: duo.followup },
        { intent: "explore", line: "这步证法结构是什么？" },
      ]) || []
    );
  }

  function isWeakReply(text) {
    const t = String(text || "").trim();
    return !t || /^[.…·\s]+$/.test(t) || t.length < 2;
  }

  /** 角色 reply 不得向玩家发问 */
  function isCharacterReplyQuestion(text) {
    const t = String(text || "").trim();
    if (!t) {
      return false;
    }
    if (/[？?]/.test(t)) {
      return true;
    }
    if (/吗[。！]?$/.test(t) || /呢[。！]?$/.test(t)) {
      return true;
    }
    return false;
  }

  const CHARACTER_REPLY_RULE =
    "证官 reply 只能陈述/否认/顶回，**禁止问句**（无 ？/?，不以吗/呢 发问）。";

  function sanitizeRhetoricalQuestion(text) {
    let t = String(text || "").trim();
    if (!t) {
      return t;
    }
    if (/^我护谁[？?]/.test(t)) {
      t = t.replace(/^我护谁[？?]\s*/, "我只护真相，");
    }
    if (/^谁[？?]$/.test(t)) {
      t = "与你无关。";
    }
    return t.replace(/[？?]/g, "。");
  }

  function filterCharacterReply(reply, context) {
    let t = sanitizeRhetoricalQuestion(String(reply || "").trim());
    if (!t || isWeakReply(t)) {
      return "";
    }
    if (isCharacterReplyQuestion(t)) {
      window.PomDebug?.logLocalWarn("角色问句已拒", t.slice(0, 80), ["reply"]);
      return "";
    }
    const pickIntent = context?.pickIntent || "";
    if (window.GameOnion?.isDeflectReply?.(t, pickIntent)) {
      window.PomDebug?.logLocalWarn("角色敷衍已拒", t.slice(0, 80), ["reply"]);
      return "";
    }
    return t;
  }

  function buildCombinedSystem(archetype, turn) {
    const base = `你是数学证明对论游戏的对话引擎：同时生成证官台词（reply）与下一轮证辩者选项（options）。

【messages 规则】
messages 里只能是证官与证辩者的对白原话（证辩者句即其点击的台词），不要期待 [game]、[choices] 等标记出现在 messages 中。
根据 messages 全文理解论证进程；最后一条 user 是证辩者本轮原话。

【角色风格】（写入 reply 时遵守）
${archetype.system}

【重要】必须只输出一个合法 JSON 对象，无其它文字、无 markdown 代码块。`;

    if (!turn) {
      return `${base}

非收束轮示例：
{"reply":"先把逻辑步讲实，我再补一步。","options":[{"intent":"advance","line":"..."},{"intent":"decoy","line":"..."},{"intent":"clarify","line":"..."},{"intent":"explore","line":"..."}]}

收束轮示例：
{"reply":"G 已证毕，休庭。"}`;
    }

    const closeBlock = turn.isClose
      ? "\n【收束轮】玩家 intent=close。只输出 {\"reply\":\"...\"}，不要 options。"
      : "";

    const summaryBlock = turn.plotSummary?.trim()
      ? `\n【证明席·长程】（已写入事实勿重复追问）\n${turn.plotSummary.trim()}\n`
      : "";

    return `${base}
${summaryBlock}
【本轮】
角色：${turn.character.name}
证辩者本轮 intent：${turn.pick.intent}
证辩者本轮原话（应与 messages 最后一条 user 一致）：${turn.pick.line}

【行动类型 — 只作结构参考，勿把旧选项文字写进 reply】
${buildIntentHintsForApi()}

【输出】
${turn.isClose ? "只输出 {\"reply\":\"...\"}。" : '输出 {"reply":"...","options":[{"intent":"advance","line":"..."},{"intent":"decoy","line":"..."},{"intent":"clarify","line":"..."},{"intent":"explore","line":"..."}]}。'}
reply：1～2 句，≤40 字；${CHARACTER_REPLY_RULE} options 须 4 条且 intent 各一；**advance 正确、decoy 误推**；了解类含线索、不得照抄旧句。${closeBlock}`;
  }

  function presetOptions(archetype) {
    const preset = archetype?.options;
    if (Array.isArray(preset) && preset.length >= 4) {
      return preset;
    }
    return OPTION_SPECS.map((meta) =>
      optionRow(meta, meta.label)
    );
  }

  function extractJsonObject(raw) {
    return window.PomJson.parseJsonObject(raw);
  }

  function lineFromOptionItem(item) {
    if (typeof item === "string") {
      return item.trim();
    }
    if (item && typeof item === "object") {
      return String(item.line || item.text || item.content || "").trim();
    }
    return "";
  }

  /** 兼容 options 为字符串数组（按顺序映射 keypoint→close） */
  function optionsFromArray(items) {
    const parsed = Array.isArray(items) ? items : [];
    if (parsed.length < OPTION_SPECS.length) {
      throw new Error(`options 不足 ${OPTION_SPECS.length} 条`);
    }
    const allStrings = parsed.every((p) => typeof p === "string");
    if (allStrings) {
      window.PomDebug?.logLocalWarn(
        "options 格式",
        "模型返回字符串数组，已按顺序映射为四类 intent"
      );
    }
    return OPTION_SPECS.map((meta, i) => {
      const item =
        parsed.find((p) => p && typeof p === "object" && p.intent === meta.intent) ||
        parsed[i];
      let line = lineFromOptionItem(item);
      line = line.replace(/^「+/, "").replace(/」+$/, "");
      if (!line) {
        throw new Error(`缺少 ${meta.intent} 的 line`);
      }
      return {
        ...meta,
        line,
        send: `[intent:${meta.intent}] ${line}`,
      };
    });
  }

  function tokenLimit(name, fallback) {
    return window.PomTokens?.[name] ?? fallback;
  }

  function parseCombinedResponse(raw, isClose) {
    if (!String(raw || "").trim()) {
      throw new Error("API 返回为空");
    }
    try {
      const obj = extractJsonObject(raw);
      const reply = String(obj.reply || "").trim();
      if (!reply || isWeakReply(reply)) {
        throw new Error("缺少有效 reply");
      }
      if (isClose) {
        return { reply, options: null };
      }
      return {
        reply,
        options: optionsFromArray(obj.options),
      };
    } catch (e) {
      const plain = replyFromRaw(raw);
      if (!plain || isWeakReply(plain)) {
        throw e;
      }
      window.PomDebug?.logLocalWarn("非 JSON 回复", "按纯文本解析 reply");
      if (isClose) {
        return { reply: plain, options: null };
      }
      throw new Error("非 JSON 且无 options，需拆分生成");
    }
  }

  function replyFromRaw(raw, context) {
    try {
      const obj = extractJsonObject(raw);
      const reply = filterCharacterReply(String(obj.reply || "").trim(), context);
      if (reply) {
        return reply;
      }
    } catch {
      /* fall through */
    }
    let text = String(raw || "")
      .trim()
      .replace(/^```[\s\S]*?```/gm, "")
      .trim();
    if (text.startsWith("{")) {
      return "";
    }
    const first = text.split("\n").find((l) => l.trim()) || text;
    const candidate = first.trim().slice(0, 120);
    return filterCharacterReply(candidate, context);
  }

  function lastUsableAssistantLine(session, archetype) {
    const done = session.messages.filter(
      (m) => m.status !== "error" && (m.role === "user" || m.role === "assistant")
    );
    for (let i = done.length - 1; i >= 0; i--) {
      if (done[i].role !== "assistant") {
        continue;
      }
      const line = assistantLineForOptions(done[i].content);
      if (line && !isWeakReply(line)) {
        return line;
      }
    }
    return archetype.opening;
  }

  function assistantLineForOptions(content) {
    const text = String(content || "").trim();
    if (!text.startsWith("{")) {
      return text;
    }
    try {
      const obj = JSON.parse(text);
      const reply = String(obj.reply || "").trim();
      if (reply) {
        return reply;
      }
    } catch {
      /* use raw */
    }
    return text.slice(0, 80);
  }

  async function completeChatJson(params, options) {
    const preferPlain = options?.preferPlain !== false;
    const attempts = preferPlain
      ? [
          { label: "普通", extra: {} },
          { label: "json_object", extra: { response_format: { type: "json_object" } } },
        ]
      : [
          { label: "json_object", extra: { response_format: { type: "json_object" } } },
          { label: "普通", extra: {} },
        ];

    let lastError = null;
    const debugLabel = params.debugLabel || "选项 JSON";
    for (const attempt of attempts) {
      try {
        const raw = await window.ChatApi.completeChat({
          ...params,
          ...attempt.extra,
          debugLabel,
          debugAttempt: attempt.label !== "普通" ? attempt.label : undefined,
        });
        if (String(raw || "").trim()) {
          return raw;
        }
        lastError = new Error("API 返回为空");
      } catch (e) {
        lastError = e;
        window.PomDebug?.logLocalWarn(
          `${attempt.label} 请求失败`,
          e.message || String(e)
        );
      }
    }
    throw lastError || new Error("API 返回为空");
  }

  function roleStyleFromSystem(systemPrompt) {
    const m = String(systemPrompt || "").match(
      /【角色风格】（写入 reply 时遵守）\n([\s\S]*?)(?=\n【|$)/
    );
    return m
      ? `【角色风格】\n${m[1].trim()}`
      : "你是证官·理证，短句、严谨。";
  }

  function plotSummaryBlock(plotSummary, replyContext) {
    const full = String(plotSummary || "").trim();
    if (!full) {
      return "";
    }
    const text = window.GameOnion?.compactPlotSummaryForApi?.(full) || full;
    const onionHint = window.GameOnion?.formatReplyHint?.(full, replyContext) || "";
    return `\n【证明席·摘录】（长程记忆；事实以此为准。勿重复已写明内容。）\n${text}${onionHint}\n`;
  }

  async function requestReplyOnly({
    systemPrompt,
    apiMessages,
    signal,
    plotSummary,
    debugLabel,
    replyContext,
    session,
    archetype,
  }) {
    const replySystem = `${roleStyleFromSystem(systemPrompt)}${plotSummaryBlock(plotSummary, replyContext)}
只输出角色的一句台词：1～2 句中文，≤40 字。${CHARACTER_REPLY_RULE} 不要 JSON、markdown、解释。`;

    const raw = await window.ChatApi.completeChat({
      systemPrompt: replySystem,
      messages: apiMessages,
      temperature: window.PomTokens?.TEMP_REPLY ?? 0.4,
      max_tokens: tokenLimit("REPLY_ONLY", 768),
      signal,
      debugLabel: debugLabel || "拆分·①reply",
    });

    let reply = replyFromRaw(raw, replyContext);
    const seed = archetype?.onionSeed;
    if (!reply && session && seed) {
      reply =
        window.GameOnion?.pickProgramSharpReply?.(session, seed, {
          ...replyContext,
          deflectFallback: true,
        }) || "";
      if (!reply && replyContext?.pickIntent) {
        const engine = window.GameOnion?.resolveEngineIntent?.(replyContext.pickIntent);
        if (engine === "followup") {
          reply = window.GameOnion?.pickProgramStatementFallback?.(seed) || "";
        }
      }
      if (reply) {
        window.PomDebug?.logLocal("程序兜底 reply", reply, ["reply-fallback"]);
      }
    }
    if (reply) {
      return reply;
    }
    throw new Error("无法解析角色回复");
  }

  async function requestOptionsJson({
    systemPrompt,
    userContent,
    temperature,
    signal,
    logTag,
  }) {
    const raw = await completeChatJson(
      {
        systemPrompt,
        messages: [{ role: "user", content: userContent }],
        temperature,
        max_tokens: tokenLimit("OPTIONS", 1280),
        signal,
        debugLabel: logTag,
      },
      { preferPlain: true }
    );
    return raw;
  }

  function buildOptionsUserContent({ character, last, priorText, plotSummary, onionContext }) {
    const ctx = { ...(onionContext || {}), lastAssistantLine: last };
    const summaryBlock =
      window.GameOnion?.formatOptionsBlock?.(plotSummary, ctx) ||
      plotSummaryForOptions(plotSummary);
    const parts = [
      `角色名：${character.name}`,
      `角色上一句台词：${last}`,
    ];
    if (priorText) {
      parts.push(`最近对话：（不含上一句；本局对白全文）\n${priorText}`);
    }
    if (summaryBlock) {
      parts.push(summaryBlock);
    }
    parts.push("请按 system 要求只输出 JSON。");
    return parts.join("\n\n");
  }

  async function generateOptions({
    character,
    archetype,
    session,
    signal,
    temperature = window.PomTokens?.TEMP_OPTIONS ?? 0.4,
    logTag = "拆分·②选项",
    plotSummary = "",
    onionContext = null,
  }) {
    const { lastLine, priorText } = window.GameDialogue.formatRecentDialogueForOptions(
      session.messages,
      { characterName: character.name }
    );
    const last =
      assistantLineForOptions(lastLine) || lastUsableAssistantLine(session, archetype);

    const systemPrompt = buildOptionsSystemProof(character.name);
    const userContent = buildOptionsUserContent({
      character,
      last,
      priorText,
      plotSummary,
      onionContext,
    });

    let raw = await requestOptionsJson({
      systemPrompt,
      userContent,
      temperature,
      signal,
      logTag,
    });

    let options;
    try {
      options = parseMultiOptionsFromRaw(raw);
    } catch (e) {
      window.PomDebug?.logLocalWarn("选项 JSON 解析失败，重试一次", e.message);
      raw = await requestOptionsJson({
        systemPrompt,
        userContent,
        temperature,
        signal,
        logTag: `${logTag}（重试）`,
      });
      options = parseMultiOptionsFromRaw(raw);
    }

    const lines = options.map((o) => o.line).filter(Boolean);
    if (new Set(lines).size < lines.length) {
      window.PomDebug?.logLocalWarn("选项重复", "存在同义句，重试一次");
      raw = await requestOptionsJson({
        systemPrompt,
        userContent,
        temperature,
        signal,
        logTag: `${logTag}（去重）`,
      });
      options = parseMultiOptionsFromRaw(raw);
    }

    const merged = applyGoalDrivenOptions(archetype, session, options, onionContext);
    return buildProofOptionsList(merged);
  }

  async function callCombinedOnce({ systemPrompt, apiMessages, isClose, signal }) {
    const raw = await completeChatJson(
      {
        systemPrompt,
        messages: apiMessages,
        temperature: window.PomTokens?.TEMP_REPLY ?? 0.4,
        max_tokens: isClose
          ? tokenLimit("COMBINED_CLOSE", 768)
          : tokenLimit("COMBINED", 2048),
        signal,
        debugLabel: isClose ? "结束对话·回复" : "角色回复+选项（合并）",
      },
      { preferPlain: true }
    );
    return { raw, parsed: parseCombinedResponse(raw, isClose) };
  }

  async function requestSplitTurn({
    character,
    archetype,
    session,
    apiMessages,
    turn,
    signal,
  }) {
    const systemPrompt = buildCombinedSystem(archetype, {
      ...turn,
      plotSummary: session.plotSummary,
    });
    const replyContext = window.GameOnion?.replyContextFromSession?.(
      session,
      turn?.pick?.intent,
      turn?.onionExtra
    );
    const lastSharp =
      [...session.messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.status === "done")?.content || "";
    const onionContext = {
      stallTurns: session?.stallTurns ?? 0,
      emptyPromiseCount: session?.emptyPromiseCount ?? 0,
      session,
      seed: archetype?.onionSeed,
      plotSummary: session.plotSummary,
      lastAssistantLine: lastSharp,
    };
    const retry = window.PomApiRetry?.withApiRetries;

    const reply = retry
      ? await retry(
          "拆分·①reply",
          () =>
            requestReplyOnly({
              systemPrompt,
              apiMessages,
              signal,
              plotSummary: session.plotSummary,
              debugLabel: "拆分·①reply",
              replyContext,
              session,
              archetype,
            }),
          { signal }
        )
      : await requestReplyOnly({
          systemPrompt,
          apiMessages,
          signal,
          plotSummary: session.plotSummary,
          debugLabel: "拆分·①reply",
          replyContext,
          session,
          archetype,
        });

    const sessionWithReply = {
      messages: [
        ...session.messages,
        { role: "assistant", content: reply, status: "done" },
      ],
    };

    const options = retry
      ? await retry(
          "拆分·②选项",
          () =>
            generateOptions({
              character,
              archetype,
              session: sessionWithReply,
              signal,
              plotSummary: session.plotSummary,
              logTag: "拆分·②选项",
              onionContext,
            }),
          { signal }
        )
      : await generateOptions({
          character,
          archetype,
          session: sessionWithReply,
          signal,
          plotSummary: session.plotSummary,
          logTag: "拆分·②选项",
          onionContext,
        });

    return { reply, options };
  }

  async function requestCombinedTurn({
    character,
    archetype,
    session,
    apiMessages,
    turn,
    isClose,
    signal,
  }) {
    const systemPrompt = buildCombinedSystem(archetype, {
      ...turn,
      plotSummary: session.plotSummary,
    });
    if (window.PomTokens?.USE_SPLIT_FIRST) {
      if (isClose) {
        window.PomDebug?.logLocal("API 路径", "结束对话 · 仅 ①reply");
        const reply = await requestReplyOnly({
          systemPrompt,
          apiMessages,
          signal,
          plotSummary: session.plotSummary,
          debugLabel: "拆分·①reply（结束对话）",
        });
        return { reply, options: null };
      }
      return requestSplitTurn({
        character,
        archetype,
        session,
        apiMessages,
        turn,
        signal,
      });
    }

    let raw = "";
    let parsed = null;
    try {
      const first = await callCombinedOnce({ systemPrompt, apiMessages, isClose, signal });
      raw = first.raw;
      parsed = first.parsed;
    } catch (e1) {
      window.PomDebug?.logLocalWarn("合并请求失败，重试一次", e1.message);
      const second = await callCombinedOnce({
        systemPrompt,
        apiMessages,
        isClose,
        signal,
      });
      raw = second.raw;
      parsed = second.parsed;
    }

    if (isClose) {
      return parsed;
    }

    return parsed;
  }

  async function requestCombinedTurnWithFallback({
    character,
    archetype,
    session,
    apiMessages,
    turn,
    isClose,
    signal,
  }) {
    const retry = window.PomApiRetry?.withApiRetries;
    try {
      if (retry) {
        return await retry(
          "主路径·拆分",
          () =>
            requestCombinedTurn({
              character,
              archetype,
              session,
              apiMessages,
              turn,
              isClose,
              signal,
            }),
          { signal, retries: 2 }
        );
      }
      return await requestCombinedTurn({
        character,
        archetype,
        session,
        apiMessages,
        turn,
        isClose,
        signal,
      });
    } catch (e) {
      if (window.PomApiRetry?.isRetryableApiError?.(e)) {
        window.PomDebug?.logLocalWarn(
          "主路径重试后仍失败",
          `${e.message} · 走备用拆分`,
          ["ui-warn", "api"]
        );
      } else {
        window.PomDebug?.logLocalWarn("主路径失败，走备用拆分", e.message);
      }
      let reply = "";
      try {
        const replyContext = window.GameOnion?.replyContextFromSession?.(
          session,
          turn?.pick?.intent,
          turn?.onionExtra
        );
        reply = await requestReplyOnly({
          systemPrompt: buildCombinedSystem(archetype, {
            ...turn,
            plotSummary: session.plotSummary,
          }),
          apiMessages,
          signal,
          plotSummary: session.plotSummary,
          debugLabel: "备用·①reply",
          replyContext,
          session,
          archetype,
        });
      } catch {
        /* use empty */
      }

      if (isClose) {
        if (isWeakReply(reply)) {
          throw new Error("结束对话回复生成失败，请重试");
        }
        return { reply, options: null };
      }

      if (isWeakReply(reply)) {
        const last = lastUsableAssistantLine(session, archetype);
        reply = last;
        window.PomDebug?.logLocalWarn("回复无效，沿用上一句角色台词", reply);
      }

      const sessionWithReply = {
        messages: [
          ...session.messages,
          { role: "assistant", content: reply, status: "done" },
        ],
      };

      try {
        const options = await generateOptions({
          character,
          archetype,
          session: sessionWithReply,
          signal,
          plotSummary: session.plotSummary,
          logTag: "备用·②选项",
          onionContext: {
            stallTurns: session?.stallTurns ?? 0,
            emptyPromiseCount: session?.emptyPromiseCount ?? 0,
            session,
            seed: archetype?.onionSeed,
          },
        });
        return { reply, options };
      } catch (e2) {
        window.PomDebug?.logLocalWarn("备用选项 API 失败，仍用程序预设", e2.message);
        return { reply, options: presetOptions(archetype) };
      }
    }
  }

  window.GameOptionsAi = {
    OPTION_SCHEMA,
    OPTION_SPECS,
    presetOptions,
    generateOptions,
    parseMultiOptionsFromRaw,
    buildOptionsSystemProof,
    requestEndingSequence,
    requestFailureSequence,
    buildEndingCloseOptions,
    requestCombinedTurn: requestCombinedTurnWithFallback,
  };
})();
