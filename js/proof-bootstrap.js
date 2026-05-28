(function () {
  /** 开局拆分为：档案策划 → ①reply → ②选项 → ③摘要（与普通回合一致，便于调试面板） */

  function buildBootstrapArchiveSystem(blueprint) {
    const name = blueprint?.mathematician?.name || "证官";
    const hint = String(blueprint?.topicHint || "").trim();
    return `你是「证官·${name}」主持的**逻辑推理论证题**档案策划（断案式推理，不是数学题）。

【题型要求】
- 只允许：假言/三段论、否后否前、选言、反证、矛盾律、鸽巢计数、集合包含、真假话等
- **严禁**：代数式、平方展开、求和、同余、模运算、几何角度、微积分、根号、分数运算链
- 论题 G、前提 P 均用命题或日常语句；单步可核对

【题目蓝本（可改写，勿照抄）】
${hint}

【L1 设计】
- L1 须是一步**逻辑推断**（如「后件假故前件假」「反设导致矛盾」）
- **禁止**算式推导、符号堆砌、把 G 同义重述当 L1

【输出】只输出合法 JSON（无 markdown）：
{
  "plotSummary":"完整证明席（【论证目标】论题 G +【证明席】[前提]、[待证#1] L1、- [依赖] 若要证 G，则需证 L1；≤900字）"
}

【规则】
1. plotSummary 待证至多 1 条；[依赖] 只写命题编号（G/Lk）
2. 禁止【关系与态度】段`;
  }

  function buildBootstrapOpeningSystem(blueprint, plotSummary) {
    const name = blueprint?.mathematician?.name || "证官";
    const goal = window.GameOnion?.extractGoal?.(plotSummary) || "";
    return `你是「证官·${name}」：逻辑推理论证席上的证官，像断案推理。
场景：证辩者用命题结构（若…则…、故、否则、矛盾）逐步证毕论题 G。
回复：仅 1～2 句，≤40 字。禁止列表、markdown、算式与符号堆砌。
${window.GameOnion?.compactPlotSummaryForApi?.(plotSummary) ? `\n【证明席·摘录】\n${window.GameOnion.compactPlotSummaryForApi(plotSummary)}\n` : ""}
【本步】开局开场白：点出本案论证类型（如选言、否后、反证），**不要**复述整份档案。
${goal ? `论题 G：${goal}` : ""}
只输出 1～2 句中文开场白，陈述式，禁止问句。不要 JSON。`;
  }

  async function requestBootstrapArchive(blueprint, signal) {
    const systemPrompt = buildBootstrapArchiveSystem(blueprint);
    const userContent = `请为本局生成 plotSummary。证官名：${blueprint.proverName || "证官"}`;
    window.PomDebug?.logLocal(
      "开局·档案策划",
      blueprint.theorem || blueprint.problemId || "逻辑推理题",
      ["bootstrap", "ui"]
    );
    const raw = await window.ChatApi.completeChat({
      systemPrompt,
      messages: [{ role: "user", content: userContent }],
      temperature: window.PomTokens?.TEMP_BOOTSTRAP ?? 0.45,
      max_tokens: window.PomTokens?.BOOTSTRAP ?? 2048,
      signal,
      debugLabel: "开局·档案",
    });
    const obj = window.PomJson?.parseJsonObject?.(raw) || {};
    let plotSummary = String(obj.plotSummary || "").trim();
    if (!plotSummary) {
      throw new Error("开局档案 JSON 缺少 plotSummary");
    }
    plotSummary =
      window.GameOnion?.normalizeProofArchive?.(plotSummary) || plotSummary;
    return plotSummary;
  }

  async function requestBootstrapOpening({
    blueprint,
    plotSummary,
    signal,
    characterName,
  }) {
    const systemPrompt = buildBootstrapOpeningSystem(blueprint, plotSummary);
    const userContent = `证辩者入席。请以「证官·${characterName || blueprint.proverName || "证官"}」身份开场。`;
    const raw = await window.ChatApi.completeChat({
      systemPrompt,
      messages: [{ role: "user", content: userContent }],
      temperature: window.PomTokens?.TEMP_REPLY ?? 0.4,
      max_tokens: window.PomTokens?.REPLY ?? 768,
      signal,
      debugLabel: "开局·①reply",
    });
    let opening = String(raw || "").trim();
    opening = opening.replace(/^([\u4e00-\u9fa5]{2,8})[：:]\s*/, "");
    opening = opening.replace(/[？?]/g, "。");
    if (!opening || opening.length < 4) {
      throw new Error("无法解析开局开场白");
    }
    return opening;
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
        minKeypointTurns: minKeypoints,
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

  async function bootstrapProofSession({
    session,
    blueprint,
    signal,
    character,
    archetype,
  }) {
    if (!blueprint) {
      throw new Error("缺少题目蓝本");
    }
    if (!character || !archetype) {
      throw new Error("开局拆分需要 character 与 archetype");
    }

    window.PomDebug?.logLocal(
      "开局·流程",
      "档案 → ①reply → ②选项 → ③摘要",
      ["bootstrap", "ui"]
    );

    const plotSummary = await requestBootstrapArchive(blueprint, signal);
    const onionSeed = buildSeedFromSummary(plotSummary, blueprint);
    session.plotSummary = plotSummary;
    session.proofBundle = {
      ...session.proofBundle,
      ...blueprint,
      bootstrapped: false,
      onionSeed,
      system: blueprint.system,
    };
    session.proverDisplayName = blueprint.proverName;

    const opening = await requestBootstrapOpening({
      blueprint,
      plotSummary,
      signal,
      characterName: character.name,
    });

    session.messages.push({
      id: `boot-${Date.now()}`,
      role: "assistant",
      content: opening,
      createdAt: Date.now(),
      status: "done",
    });

    window.PomDebug?.logLocal("开局·①reply 已写入", opening, [
      "bootstrap",
      "summary-out",
    ]);

    const sessionWithOpening = {
      ...session,
      messages: [...session.messages],
    };

    let options = await window.GameOptionsAi?.generateOptions?.({
      character,
      archetype: { ...archetype, onionSeed },
      session: sessionWithOpening,
      signal,
      plotSummary: session.plotSummary,
      logTag: "开局·②选项",
      onionContext: {
        session: sessionWithOpening,
        seed: onionSeed,
        plotSummary: session.plotSummary,
        lastAssistantLine: opening,
      },
    });

    if (!options?.length) {
      throw new Error("开局②选项生成失败");
    }

    window.PomDebug?.logLocal(
      "开局·②选项",
      options.map((o) => `${o.intent}: ${o.line}`).join("\n"),
      ["bootstrap", "ui"]
    );

    const summaryOk = await window.GameSummary?.maybeRefreshPlotSummary?.(
      session,
      signal,
      onionSeed,
      { force: true, debugLabel: "开局·③摘要", optionTurns: 0 }
    );
    if (!summaryOk) {
      window.PomDebug?.logLocalWarn(
        "开局·③摘要",
        "未执行，档案保持策划稿",
        ["bootstrap", "summary-skip"]
      );
    }

    session.proofBundle = {
      ...session.proofBundle,
      ...blueprint,
      bootstrapped: true,
      opening,
      options,
      onionSeed,
      system: blueprint.system,
    };

    return {
      opening,
      plotSummary: session.plotSummary,
      options,
      seed: onionSeed,
    };
  }

  window.GameProofBootstrap = {
    buildBootstrapArchiveSystem,
    buildBootstrapOpeningSystem,
    requestBootstrapArchive,
    requestBootstrapOpening,
    buildSeedFromSummary,
    bootstrapProofSession,
  };
})();
