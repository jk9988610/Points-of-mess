(function () {
  const OPTION_SCHEMA = [
    { id: 1, intent: "keypoint", label: "推进" },
    { id: 2, intent: "followup", label: "询问" },
    { id: 3, intent: "suspend", label: "挂起" },
  ];

  /** Phase A+：优先 [待核实] 行；兼容旧【未解问题】段 */
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
      if (/^[-*•]\s*\[待核实\]/.test(trimmed) || /^\[待核实\]/.test(trimmed)) {
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

    if (text.includes("【剧情档案】") && !/\[待核实\]/.test(text)) {
      window.PomDebug?.logLocalWarn("摘要摘录", "剧情档案中无 [待核实] 行");
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
    return `当前剧情摘要（待核实事项，供推进型选项参考）：\n${excerpt}`;
  }

  function buildOptionsSystemDuo(characterName) {
    const name = String(characterName || "锋利").trim() || "锋利";
    return `你是选项撰稿人。玩家与「${name}」对峙。输出玩家下一句（中文 ≤35 字）。

【分工】
- keypoint（推进）：唯一推进本局目标；须用【玩家可亮牌】offer 原句，或核对锋利刚说的专名。
- followup（询问）：来意/态度/关系；禁核心密语、亮牌交换、互怼逼供。

禁止两条同义。只输出 JSON：
{"options":[{"intent":"keypoint","line":"..."},{"intent":"followup","line":"..."}]}`;
  }

  /** 仅合并 API 备用路径；挂起按钮不进模型上下文 */
  function buildIntentHintsForApi() {
    return `- keypoint（推进）
- followup（询问）
- 结束对话`;
  }

  function applyGoalDrivenOptions(archetype, session, duo, onionContext) {
    const seed = archetype?.onionSeed;
    const plotSummary = String(onionContext?.plotSummary || "").trim();
    const lastSharp = String(onionContext?.lastAssistantLine || "").trim();
    let keypoint = String(duo?.keypoint || "").trim();
    let followup = String(duo?.followup || "").trim();

    const programKp = window.GameOnion?.pickKeypointOfferLine?.(
      session,
      seed,
      plotSummary,
      lastSharp
    );
    const confirm = window.GameOnion?.pickConfirmAfterSharpLine?.(lastSharp);
    const sharpNamedBoss = window.GameOnion?.mastermindNamedInLine?.(lastSharp);
    if (confirm && !sharpNamedBoss) {
      keypoint = confirm;
    } else if (programKp) {
      const avail = window.GameOnion?.getAvailableKnowledge?.(session, seed) || [];
      const repeatsSpent =
        avail.length > 0 &&
        keypoint &&
        !avail.some((k) => keypoint.includes(k.match));
      const stall = (onionContext?.stallTurns ?? 0) >= 1;
      if (!keypoint || repeatsSpent || stall) {
        keypoint = programKp;
      }
    } else {
      const reveal = window.GameOnion?.pickProgramRevealLine?.(session, seed);
      const stall = (onionContext?.stallTurns ?? 0) >= 2;
      const hollow = window.GameOnion?.detectHollowTradeOffer?.(keypoint, seed);
      const concrete = window.GameOnion?.isPlayerLineConcrete?.(keypoint, seed);
      if (reveal && (stall || hollow || !concrete)) {
        keypoint = reveal;
      }
    }

    if (window.GameOnion?.isGoalAdvancePlayerLine?.(followup)) {
      followup = window.GameOnion.pickProgramInquireLine(session, seed);
      window.GameOnion.advanceInquireIndex?.(session);
    }

    return { keypoint, followup };
  }

  function fixedSuspendLine(archetype) {
    const preset = archetype.options?.find((o) => o.intent === "suspend")?.line;
    return String(archetype.suspendLine || preset || "待会再来找你。").trim();
  }

  function optionRow(meta, line) {
    const text = String(line || "").trim();
    const send =
      meta.intent === "suspend" ? text : `[intent:${meta.intent}] ${text}`;
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
你是「${name}」。用 1～2 句中文（≤40 字）向玩家**点明结局**（目标已实现、局势如何收束）。${CHARACTER_REPLY_RULE}
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
    const systemPrompt = `你是选项撰稿人。本局目标已达成：${goal}。玩家与「${name}」对峙已收束。
输出玩家**结束对话**的两句不同离场白（中文各一句 ≤35 字），都是告别/收口，不要继续追问。

只输出 JSON：
{"options":[{"intent":"close","line":"..."},{"intent":"close","line":"..."}]}`;

    const last =
      [...session.messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.status === "done")?.content || "";
    const userContent = [
      `角色名：${name}`,
      `角色刚宣布的结局台词：${last}`,
      "请输出两条 intent 均为 close 的玩家离场句。",
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
    const p1 = pending[0] || "指使者是谁";
    const failLine = String(archetype.failureLine || "你不肯说指使者，我没时间了。").trim();
    const failSystem = `${roleStyleFromSystem(archetype.system)}${plotSummaryBlock(plotSummary)}
【失败轮】玩家多轮回避 #1「${p1}」。你是「${name}」。
用 1～2 句（≤40 字）结束对峙，参考语气：「${failLine}」。${CHARACTER_REPLY_RULE}
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

  function buildHybridOptions(archetype, duo) {
    const suspendLine = fixedSuspendLine(archetype);

    return OPTION_SCHEMA.map((meta) => {
      if (meta.intent === "keypoint") {
        return optionRow(meta, duo.keypoint);
      }
      if (meta.intent === "followup") {
        return optionRow(meta, duo.followup);
      }
      return optionRow(meta, suspendLine);
    });
  }

  function parseDuoOptionsFromRaw(raw) {
    const obj = extractJsonObject(raw);
    const list = Array.isArray(obj.options) ? obj.options : [];
    let keypoint = "";
    let followup = "";
    for (const item of list) {
      if (item && typeof item === "object" && item.intent === "keypoint") {
        keypoint = lineFromOptionItem(item);
      }
      if (item && typeof item === "object" && item.intent === "followup") {
        followup = lineFromOptionItem(item);
      }
    }
    if (!keypoint && list[0]) {
      keypoint = lineFromOptionItem(list[0]);
    }
    if (!followup && list[1]) {
      followup = lineFromOptionItem(list[1]);
    }
    keypoint = keypoint.replace(/^「+/, "").replace(/」+$/, "");
    followup = followup.replace(/^「+/, "").replace(/」+$/, "");
    if (!keypoint || !followup) {
      throw new Error("缺少 keypoint 或 followup");
    }
    return { keypoint, followup };
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
    "角色 reply 只能陈述/供述/否认/顶回，**禁止问句**（无 ？/?，不以吗/呢 发问）。";

  function filterCharacterReply(reply) {
    const t = String(reply || "").trim();
    if (!t || isWeakReply(t)) {
      return "";
    }
    if (isCharacterReplyQuestion(t)) {
      window.PomDebug?.logLocalWarn("角色问句已拒", t.slice(0, 80), ["reply"]);
      return "";
    }
    if (window.GameOnion?.isDeflectReply?.(t)) {
      window.PomDebug?.logLocalWarn("角色敷衍已拒", t.slice(0, 80), ["reply"]);
      return "";
    }
    return t;
  }

  function buildCombinedSystem(archetype, turn) {
    const base = `你是文字冒险游戏的对话引擎：同时生成角色台词（reply）与下一轮玩家选项（options）。

【messages 规则】
messages 里只能是角色与玩家的对白原话（玩家句即其点击的台词），不要期待 [game]、[choices] 等标记出现在 messages 中。
根据 messages 全文理解剧情；最后一条 user 是玩家本轮原话。

【角色风格】（写入 reply 时遵守）
${archetype.system}

【重要】必须只输出一个合法 JSON 对象，无其它文字、无 markdown 代码块。`;

    if (!turn) {
      return `${base}

非收束轮示例（options 必须是对象数组，禁止字符串数组）：
{"reply":"嘴硬。等刀架脖子上再说。","options":[{"intent":"keypoint","line":"..."},{"intent":"followup","line":"..."},{"intent":"close","line":"..."}]}

收束轮示例：
{"reply":"慢走不送。"}`;
    }

    const closeBlock = turn.isClose
      ? "\n【收束轮】玩家 intent=close。只输出 {\"reply\":\"...\"}，不要 options。"
      : "";

    const summaryBlock = turn.plotSummary?.trim()
      ? `\n【剧情摘要】（长程记忆；已写明的事实勿在 reply 里重复追问）\n${turn.plotSummary.trim()}\n`
      : "";

    return `${base}
${summaryBlock}
【本轮】
角色：${turn.character.name}
玩家本轮 intent：${turn.pick.intent}
玩家本轮原话（应与 messages 最后一条 user 一致）：${turn.pick.line}

【行动类型 — 只作结构参考，勿把旧选项文字写进 reply】
${buildIntentHintsForApi()}

【输出】
${turn.isClose ? "只输出 {\"reply\":\"...\"}。" : '输出 {"reply":"...","options":[{"intent":"keypoint","line":"..."},{"intent":"followup","line":"..."},{"intent":"close","line":"..."}]}。'}
reply：1～2 句，≤40 字；${CHARACTER_REPLY_RULE} options 三项须含 intent 与 line；**keypoint/followup 不得照抄旧句**，followup 须引用本轮 reply；close 由程序固定。${closeBlock}`;
  }

  function presetOptions(archetype) {
    return OPTION_SCHEMA.map((meta) => {
      const preset = archetype.options.find((o) => o.intent === meta.intent);
      const line = preset?.line || meta.label;
      return {
        ...meta,
        line,
        send: preset?.send || `[intent:${meta.intent}] ${line}`,
      };
    });
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
    if (parsed.length < OPTION_SCHEMA.length) {
      throw new Error(`options 不足 ${OPTION_SCHEMA.length} 条`);
    }
    const allStrings = parsed.every((p) => typeof p === "string");
    if (allStrings) {
      window.PomDebug?.logLocalWarn(
        "options 格式",
        "模型返回字符串数组，已按顺序映射为四类 intent"
      );
    }
    return OPTION_SCHEMA.map((meta, i) => {
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

  function replyFromRaw(raw) {
    try {
      const obj = extractJsonObject(raw);
      const reply = filterCharacterReply(String(obj.reply || "").trim());
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
    return filterCharacterReply(candidate);
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
      : "你是角色「锋利」，短句、直接。";
  }

  function plotSummaryBlock(plotSummary, replyContext) {
    const full = String(plotSummary || "").trim();
    if (!full) {
      return "";
    }
    const text = window.GameOnion?.compactPlotSummaryForApi?.(full) || full;
    const onionHint = window.GameOnion?.formatReplyHint?.(full, replyContext) || "";
    return `\n【剧情档案·摘录】（长程记忆；事实以此为准。勿重复已写明内容。）\n${text}${onionHint}\n`;
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

    let reply = replyFromRaw(raw);
    const seed = archetype?.onionSeed;
    if (!reply && session && seed) {
      reply =
        window.GameOnion?.pickProgramSharpReply?.(session, seed, {
          ...replyContext,
          deflectFallback: true,
        }) || "";
      if (!reply && replyContext?.pickIntent === "followup") {
        reply = window.GameOnion?.pickProgramStatementFallback?.(seed) || "";
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

    const systemPrompt = buildOptionsSystemDuo(character.name);
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

    let duo;
    try {
      duo = parseDuoOptionsFromRaw(raw);
    } catch (e) {
      window.PomDebug?.logLocalWarn("选项 JSON 解析失败，重试一次", e.message);
      raw = await requestOptionsJson({
        systemPrompt,
        userContent,
        temperature,
        signal,
        logTag: `${logTag}（重试）`,
      });
      duo = parseDuoOptionsFromRaw(raw);
    }

    if (duo.keypoint === duo.followup) {
      window.PomDebug?.logLocalWarn("选项重复", "keypoint 与 followup 相同，重试一次");
      raw = await requestOptionsJson({
        systemPrompt,
        userContent,
        temperature,
        signal,
        logTag: `${logTag}（去重）`,
      });
      duo = parseDuoOptionsFromRaw(raw);
    }

    const merged = applyGoalDrivenOptions(archetype, session, duo, onionContext);
    return buildHybridOptions(archetype, merged);
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
    presetOptions,
    generateOptions,
    requestEndingSequence,
    requestFailureSequence,
    buildEndingCloseOptions,
    requestCombinedTurn: requestCombinedTurnWithFallback,
  };
})();
