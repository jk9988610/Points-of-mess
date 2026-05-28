(function () {
  /** AI 生成开局：opening + 证明席摘要 + 首轮选项 */

  function buildBootstrapSystem(blueprint) {
    const name = blueprint?.mathematician?.name || "证官";
    const hint = String(blueprint?.topicHint || "").trim();
    return `你是「证官·${name}」主持的**逻辑证明题**开局设计师。

【题型要求】
- 纯逻辑推理：反证、奇偶、整除、命题等价、集合包含、有限/无穷等
- **禁止**繁琐数值计算、长公式链、微积分/矩阵/级数
- 用中文短句表述，单步可核对；论题 G 与前提 P 须自洽

【题目蓝本（可改写，勿照抄）】
${hint}

【输出】只输出一个合法 JSON（无 markdown）：
{
  "opening":"证官开场 1～2 句（≤40字，陈述式，禁止问句）",
  "plotSummary":"完整证明席（含【论证目标】论题 G、【证明席】[前提]、[待证#1] L1 及「若要证 G…」行；≤900字）",
  "options":[
    {"intent":"advance","line":"证辩者推进证明（≤35字，须能推进待证 L1）"},
    {"intent":"clarify","line":"了解论题/待证含义（≤35字，不推进）"},
    {"intent":"explore","line":"了解证法结构（≤35字，不推进）"},
    {"intent":"premise","line":"了解某前提（≤35字，不推进）"}
  ]
}

【规则】
1. options 恰好 4 条，intent 各一；advance 仅 1 条且必须能推进证明
2. 三条了解类语义互不重复；禁止休庭/离开
3. plotSummary 用数学证明体标记，待证至多 1 条开放引理`;
  }

  function parseBootstrapRaw(raw) {
    const obj = window.PomJson?.parseJsonObject?.(raw) || {};
    const opening = String(obj.opening || "").trim();
    let plotSummary = String(obj.plotSummary || "").trim();
    const optionsRaw = Array.isArray(obj.options) ? obj.options : [];
    if (!opening || !plotSummary || optionsRaw.length < 4) {
      throw new Error("开局 JSON 缺少 opening/plotSummary/options");
    }
    plotSummary =
      window.GameOnion?.normalizeProofArchive?.(plotSummary) || plotSummary;
    const parsed = optionsRaw
      .map((item) => ({
        intent: window.GameProofIntents?.normalizeUiIntent?.(item?.intent) || "",
        line: String(item?.line || item?.text || "").trim(),
      }))
      .filter((o) => o.intent && o.line);
    const options = window.GameProofIntents?.attachOptionIds?.(parsed) || [];
    const check = window.GameProofIntents?.validateProofOptions?.(options);
    if (!check?.ok) {
      throw new Error(check?.reason || "选项校验失败");
    }
    return { opening, plotSummary, options };
  }

  function buildSeedFromSummary(plotSummary, blueprint) {
    const goal = window.GameOnion?.extractGoal?.(plotSummary) || "";
    const prover = blueprint?.proverName || "证官";
    return {
      proofTheme: true,
      aiDriven: true,
      poolLemmaGrant: false,
      dynamicPlayerEvidence: false,
      problemId: blueprint?.problemId || "",
      roleLabel: prover,
      playerRoleLabel: "证辩者",
      goal,
      endingMinConfirmed: 3,
      endingCoreKeywords: [],
      endingMinKeypointTurns: 2,
      maxOpenClaims: 1,
      argumentProfile: {
        maxOpenClaims: 1,
        minPremisesForEnding: 3,
        minKeypointTurns: 2,
      },
      endingSpendAllKnowledge: false,
      endingEpilogueFallback: "G 证毕，论证闭合。",
      neglectPrimaryWarnAt: 3,
      neglectPrimaryFailAt: 5,
      goalTracks: { core: { keywords: [] } },
      sharpStatementFallbacks: [
        "先把逻辑步讲实，我再补一步。",
        "逐步来，别跳步。",
      ],
    };
  }

  async function bootstrapProofSession({ session, blueprint, signal }) {
    if (!blueprint) {
      throw new Error("缺少题目蓝本");
    }
    const systemPrompt = buildBootstrapSystem(blueprint);
    const userContent = `请为本局生成 opening、plotSummary、options。证官名：${blueprint.proverName || "证官"}`;

    window.PomDebug?.logLocal(
      "开局·AI 生成",
      `${blueprint.theorem || blueprint.problemId || "逻辑证明题"}`,
      ["bootstrap"]
    );

    const raw = await window.ChatApi.completeChat({
      systemPrompt,
      messages: [{ role: "user", content: userContent }],
      temperature: window.PomTokens?.TEMP_BOOTSTRAP ?? 0.45,
      max_tokens: window.PomTokens?.BOOTSTRAP ?? 2048,
      signal,
      debugLabel: "开局·AI",
    });

    const parsed = parseBootstrapRaw(raw);
    const onionSeed = buildSeedFromSummary(parsed.plotSummary, blueprint);
    session.plotSummary = parsed.plotSummary;
    session.proofBundle = {
      ...session.proofBundle,
      ...blueprint,
      bootstrapped: true,
      opening: parsed.opening,
      options: parsed.options,
      onionSeed,
      system: blueprint.system,
    };
    session.proverDisplayName = blueprint.proverName;
    return {
      opening: parsed.opening,
      plotSummary: parsed.plotSummary,
      options: parsed.options,
      seed: onionSeed,
    };
  }

  window.GameProofBootstrap = {
    buildBootstrapSystem,
    parseBootstrapRaw,
    buildSeedFromSummary,
    bootstrapProofSession,
  };
})();
