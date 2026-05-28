(function () {
  /** AI 生成开局：opening + 证明席摘要 + 首轮三推证选项 */

  function buildBootstrapSystem(blueprint) {
    const name = blueprint?.mathematician?.name || "证官";
    const hint = String(blueprint?.topicHint || "").trim();
    return `你是「证官·${name}」主持的**逻辑推理论证题**开局设计师（断案式推理，不是数学题）。

【题型要求】
- 只允许：假言/三段论、否后否前、选言、反证、矛盾律、鸽巢计数、集合包含、真假话等
- **严禁**：代数式、平方展开、求和、同余、模运算、几何角度、微积分、根号、分数运算链
- 论题 G、前提 P、选项均用命题或日常语句；单步可核对

【题目蓝本（可改写，勿照抄）】
${hint}

【L1 设计】
- L1 须是一步**逻辑推断**（如「后件假故前件假」「反设导致矛盾」）
- **禁止**算式推导、符号堆砌、把 G 同义重述当 L1
- 好例：「地不湿，故按若下雨则地湿，下雨不成立」
- 坏例：「p²=2q²」「n²=4k²」「a^(p-1)≡1」

【选项口吻】
- 三句皆像逻辑题选项：「若…则…」「故」「否则」「与…矛盾」
- decoy：肯定后件、否定前件、逆命题、跳步直证 G、循环论证

【输出】只输出一个合法 JSON（无 markdown）：
{
  "opening":"证官开场 1～2 句（≤40字，陈述式，禁止问句）",
  "plotSummary":"完整证明席（【论证目标】论题 G +【证明席】[前提]、[待证#1] L1、- [依赖] 若要证 G，则需证 L1；≤900字）",
  "options":[
    {"intent":"advance","line":"正确逻辑推断 L1（≤35字）"},
    {"intent":"decoy","line":"似真误推 1（≤35字，不可推进 L1）"},
    {"intent":"decoy","line":"似真误推 2（≤35字，不可推进 L1，与上句不同类错误）"}
  ]
}

【规则】
1. options 恰好 3 条：advance×1 + decoy×2；advance 只推进 L1
2. plotSummary 待证至多 1 条；[依赖] 只写命题编号（G/Lk）
3. 禁止【关系与态度】段`;
  }

  function parseBootstrapRaw(raw) {
    const obj = window.PomJson?.parseJsonObject?.(raw) || {};
    const opening = String(obj.opening || "").trim();
    let plotSummary = String(obj.plotSummary || "").trim();
    const optionsRaw = Array.isArray(obj.options) ? obj.options : [];
    if (!opening || !plotSummary || optionsRaw.length < 3) {
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
    const checkRaw = window.GameProofIntents?.validateProofOptions?.(parsed);
    if (!checkRaw?.ok) {
      throw new Error(checkRaw?.reason || "选项校验失败");
    }
    const options = window.GameProofIntents?.attachOptionIds?.(parsed) || [];
    return { opening, plotSummary, options };
  }

  function buildSeedFromSummary(plotSummary, blueprint) {
    const goal = window.GameOnion?.extractGoal?.(plotSummary) || "";
    const prover = blueprint?.proverName || "证官";
    const problemId = blueprint?.problemId || "";
    const poolProblem = window.GameProofPool?.findProblemById?.(problemId);
    const chainLen = window.GameProofPool?.getLemmaChain?.(problemId)?.length || 0;
    const minLemmaSteps = poolProblem
      ? window.GameProofPool?.getMinLemmaStepsForEnding?.(problemId) || chainLen || 2
      : 1;
    const minKeypoints = poolProblem ? Math.max(1, minLemmaSteps) : 1;
    return {
      proofTheme: true,
      aiDriven: true,
      poolLemmaGrant: false,
      dynamicPlayerEvidence: false,
      problemId,
      minLemmaStepsForEnding: minLemmaSteps,
      roleLabel: prover,
      playerRoleLabel: "证辩者",
      goal,
      endingMinConfirmed: 2,
      endingCoreKeywords: poolProblem?.endingCoreKeywords || [],
      endingMinKeypointTurns: minKeypoints,
      maxOpenClaims: 1,
      argumentProfile: {
        maxOpenClaims: 1,
        minPremisesForEnding: 2,
        minKeypointTurns: 2,
      },
      endingSpendAllKnowledge: false,
      endingEpilogueFallback:
        poolProblem?.endingEpilogueFallback || "G 证毕，论证闭合。",
      neglectPrimaryWarnAt: 3,
      neglectPrimaryFailAt: 5,
      goalTracks: { core: { keywords: poolProblem?.endingCoreKeywords || [] } },
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
      `${blueprint.theorem || blueprint.problemId || "逻辑推理题"}`,
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
