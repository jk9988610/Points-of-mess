/**
 * 数学证明题随机池：数学家、真实/组合证明题、开局 opening/摘要/选项。
 * 每局从池抽取论题 G，按序授予证辩者引理（lemmaPool）。
 */
(function () {
  const MATHEMATICIANS = [
    { id: "euclid", name: "欧几里得", title: "几何原本" },
    { id: "gauss", name: "高斯", title: "数论" },
    { id: "euler", name: "欧拉", title: "分析" },
    { id: "fermat", name: "费马", title: "数论" },
    { id: "cauchy", name: "柯西", title: "分析严格化" },
    { id: "cantor", name: "康托尔", title: "集合论" },
  ];

  /** 可组合前提片段（用于 composeRandomProblem） */
  const PREMISE_BLOCKS = [
    { id: "n-int", text: "设 n 为正整数" },
    { id: "n-even-sq", text: "若 n² 为偶数，则 n 为偶数" },
    { id: "n-odd-sq", text: "若 n² 为奇数，则 n 为奇数" },
    { id: "coprime", text: "既约分数 p/q 中 p、q 互素" },
    { id: "div-trans", text: "若 a|b 且 b|c，则 a|c" },
    { id: "prime-def", text: "大于 1 的整数若仅有 1 与自身为因子，则称为素数" },
    { id: "tri-sum", text: "三角形内角之和为 180°" },
    { id: "p-odd-even", text: "整数或为偶数或为奇数，二者必居其一" },
  ];

  /** 可组合结论模板 */
  const CONCLUSION_TEMPLATES = [
    {
      id: "comp-even-impl",
      theorem: "偶数的平方仍为偶数",
      goal: "证明：若 n 为偶数，则 n² 为偶数",
      pending: ["由 n=2k 推出 n²=4k² 为偶数"],
      lemmaPool: [
        {
          id: "c1",
          match: "偶数",
          text: "设 n=2k（k 为整数）",
          offerLine: "设 n=2k，换你说 n² 的表达式",
        },
        {
          id: "c2",
          match: "4k²",
          text: "n²=(2k)²=4k²",
          offerLine: "n²=4k²，换你说 4k² 的奇偶性",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "c1", line: "则 n²=(2k)²。" },
        { afterKnowledge: "c2", line: "4k² 可被 2 整除，故 n² 为偶数。" },
      ],
      endingCoreKeywords: ["偶数", "4k²", "整除"],
      goalTracks: { core: { keywords: ["偶数", "4k²", "2k"] } },
      endingEpilogueFallback: "G 证毕：偶数的平方仍为偶数。",
    },
    {
      id: "comp-odd-square",
      theorem: "奇数的平方仍为奇数",
      goal: "证明：若 n 为奇数，则 n² 为奇数",
      pending: ["由 n=2k+1 推出 n² 为奇数"],
      lemmaPool: [
        {
          id: "o1",
          match: "奇数",
          text: "设 n=2k+1（k 为整数）",
          offerLine: "设 n=2k+1，换你说 n² 展开式",
        },
        {
          id: "o2",
          match: "4k",
          text: "n²=4k²+4k+1=2(2k²+2k)+1",
          offerLine: "n²=2(2k²+2k)+1，换你说 n² 的奇偶",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "o1", line: "展开得 n²=4k²+4k+1。" },
        { afterKnowledge: "o2", line: "形如 2m+1，故 n² 为奇数。" },
      ],
      endingCoreKeywords: ["奇数", "2k+1", "2m+1"],
      goalTracks: { core: { keywords: ["奇数", "2k+1"] } },
      endingEpilogueFallback: "G 证毕：奇数的平方仍为奇数。",
    },
  ];

  /** 完整 curated 证明题 */
  const CURATED_PROBLEMS = [
    {
      id: "sqrt2-irrational",
      mathematicianIds: ["euclid"],
      theorem: "√2 是无理数",
      goal: "证明 √2 不能表为既约分数 p/q",
      premises: [
        "若 n² 为偶数，则 n 为偶数",
        "既约分数 p/q 中 p、q 互素（无公因子）",
      ],
      pending: ["推出 p、q 均为偶数，与互素矛盾"],
      attitude: ["证官要求每步可核对，拒绝跳步"],
      lemmaPool: [
        {
          id: "s1",
          match: "既约",
          text: "设 √2=p/q，且 p/q 既约",
          offerLine: "设 √2=p/q 既约，换你说 p² 的奇偶",
        },
        {
          id: "s2",
          match: "p²",
          text: "由 2q²=p² 得 p² 为偶数",
          offerLine: "2q²=p²，换你说 p 的奇偶",
        },
        {
          id: "s3",
          match: "q偶",
          text: "p 偶则 q² 偶，故 q 偶",
          offerLine: "p 偶故 q 偶，换你说与互素的矛盾",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "s1", line: "平方得 2q²=p²。" },
        { afterKnowledge: "s2", line: "p² 偶故 p 偶，可写 p=2k。" },
        { afterKnowledge: "s3", line: "代入得 q²=2k²，q 亦偶，与互素矛盾。" },
      ],
      endingCoreKeywords: ["无理", "矛盾", "互素", "偶数"],
      goalTracks: { core: { keywords: ["矛盾", "互素", "偶数", "无理"] } },
      endingEpilogueFallback: "G 证毕：√2 无理。",
      inquireLines: [
        "你采用反证还是直接构造？",
        "互素条件打算在哪一步用？",
        "奇偶性是你本步的关键吗？",
      ],
    },
    {
      id: "infinitude-primes",
      mathematicianIds: ["euclid"],
      theorem: "素数有无穷多个",
      goal: "证明：任意有限素数表均遗漏某素数",
      premises: [
        "大于 1 的整数若仅有 1 与自身为因子，则称为素数",
        "任意整数 n>1 必有素因子",
      ],
      pending: ["构造 N+1 并说明其素因子不在原表中"],
      attitude: ["证官关注构造是否完备"],
      lemmaPool: [
        {
          id: "p1",
          match: "有限",
          text: "设 p₁,…,p_k 为全部素数（反设）",
          offerLine: "设素数仅有限个，换你说 N 的构造",
        },
        {
          id: "p2",
          match: "N+1",
          text: "令 N=p₁…p_k+1",
          offerLine: "令 N=各素数乘积+1，换你说 N 的素因子",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "p1", line: "有限表必可编号。" },
        { afterKnowledge: "p2", line: "N 与表中各素数余 1，故其素因子不在表中。" },
      ],
      endingCoreKeywords: ["无穷", "素数", "素因子", "矛盾"],
      goalTracks: { core: { keywords: ["素数", "素因子", "无穷"] } },
      endingEpilogueFallback: "G 证毕：素数无穷。",
      inquireLines: [
        "反设有限后，你的构造是什么？",
        "N+1 与表中素数有何同余关系？",
      ],
    },
    {
      id: "sum-formula",
      mathematicianIds: ["gauss"],
      theorem: "1+2+…+n = n(n+1)/2",
      goal: "证明前 n 个正整数之和公式",
      premises: [
        "设 S=1+2+…+n",
        "正整数 n 给定",
      ],
      pending: ["配对求和得到 S=n(n+1)/2"],
      attitude: ["证官要求代数变形可核对"],
      lemmaPool: [
        {
          id: "g1",
          match: "配对",
          text: "将 S 写为 (1+n)+(2+(n-1))+…",
          offerLine: "用首尾配对写 S，换你说每对之和",
        },
        {
          id: "g2",
          match: "n+1",
          text: "共有 n/2 对，每对和为 n+1",
          offerLine: "共 n/2 对、每对 n+1，换你说 S 的表达式",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "g1", line: "首尾配对，每对和为 n+1。" },
        { afterKnowledge: "g2", line: "故 S=n(n+1)/2。" },
      ],
      endingCoreKeywords: ["n(n+1)", "配对", "求和"],
      goalTracks: { core: { keywords: ["n(n+1)", "配对", "求和"] } },
      endingEpilogueFallback: "G 证毕：求和公式成立。",
      inquireLines: [
        "你打算用配对还是归纳？",
        "n 奇偶是否影响配对个数？",
      ],
    },
    {
      id: "no-largest-int",
      mathematicianIds: ["euclid", "cauchy"],
      theorem: "不存在最大整数",
      goal: "证明：对任意整数 n，存在 n+1>n",
      premises: ["整数的序关系：若 m=n+1 则 m>n"],
      pending: ["说明不存在上界最大的整数"],
      attitude: ["证官要求反设后推出矛盾"],
      lemmaPool: [
        {
          id: "l1",
          match: "最大",
          text: "反设 N 为最大整数",
          offerLine: "设 N 最大，换你说 N+1 与 N 的大小",
        },
        {
          id: "l2",
          match: "N+1",
          text: "N+1 为整数且 N+1>N",
          offerLine: "N+1>N，换你说与最大的矛盾",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "l1", line: "最大元假设下仍有后继。" },
        { afterKnowledge: "l2", line: "N+1>N 与 N 最大矛盾。" },
      ],
      endingCoreKeywords: ["矛盾", "最大", "N+1"],
      goalTracks: { core: { keywords: ["矛盾", "最大", "N+1"] } },
      endingEpilogueFallback: "G 证毕：整数无上界。",
      inquireLines: ["反设最大元后，你的关键一步是什么？"],
    },
    {
      id: "fermat-little",
      mathematicianIds: ["fermat", "euler"],
      theorem: "若 p 为素数且 p∤a，则 a^(p-1)≡1 (mod p)",
      goal: "证明费马小定理（陈述层面：同余结论）",
      premises: [
        "p 为素数，a 为整数且 p 不整除 a",
        "模 p 下非零元关于乘法封闭",
      ],
      pending: ["说明 a^(p-1) 模 p 余 1 的推理链"],
      attitude: ["证官要求每步同余可核对"],
      lemmaPool: [
        {
          id: "f1",
          match: "素数",
          text: "考虑集合 {a,2a,…,(p-1)a} 模 p",
          offerLine: "取 a 的倍数码 p，换你说它们是否两两不同余",
        },
        {
          id: "f2",
          match: "同余",
          text: "上述 p-1 个余数恰为 1,…,p-1 的排列",
          offerLine: "倍数为 1..p-1 的排列，换你说乘积同余",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "f1", line: "p∤a 时倍数码 p 两两不同余。" },
        { afterKnowledge: "f2", line: "乘积同余得 a^(p-1)≡1 (mod p)。" },
      ],
      endingCoreKeywords: ["同余", "素数", "费马"],
      goalTracks: { core: { keywords: ["同余", "模 p", "素数"] } },
      endingEpilogueFallback: "G 证毕：费马小定理成立。",
      inquireLines: ["你用的是乘法群还是组合计数？"],
    },
    {
      id: "triangle-angle-sum",
      mathematicianIds: ["euclid"],
      theorem: "三角形内角和为 180°",
      goal: "证明：任意三角形三内角之和为平角",
      premises: [
        "过顶点作对边的平行线",
        "平行线截线产生同位角相等",
      ],
      pending: ["用同位角将三内角拼成平角"],
      attitude: ["证官要求几何关系可指认"],
      lemmaPool: [
        {
          id: "t1",
          match: "平行",
          text: "过顶点 A 作 BC 的平行线",
          offerLine: "作平行线过 A，换你说同位角关系",
        },
        {
          id: "t2",
          match: "同位角",
          text: "同位角相等，三角拼成平角",
          offerLine: "三内角同位拼接，换你说角度和",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "t1", line: "平行线给出两对同位角相等。" },
        { afterKnowledge: "t2", line: "三角拼成平角，和为 180°。" },
      ],
      endingCoreKeywords: ["180", "平角", "同位角"],
      goalTracks: { core: { keywords: ["180", "平角", "同位角"] } },
      endingEpilogueFallback: "G 证毕：三角形内角和 180°。",
      inquireLines: ["辅助平行线作在哪条边？"],
    },
  ];

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function pickMathematician(problem) {
    const ids = problem.mathematicianIds;
    const pool = ids?.length
      ? MATHEMATICIANS.filter((m) => ids.includes(m.id))
      : MATHEMATICIANS;
    return pickRandom(pool.length ? pool : MATHEMATICIANS);
  }

  function buildProverSystem(mathematician) {
    const name = mathematician.name;
    return `你是「证官·${name}」：数学证明研讨席上的证官，说话严谨、精确。
场景：证辩者与你对论，逐步证毕论题 G；证明席由程序维护。
回复：仅 1～2 句，总 ≤40 字。不要列表、markdown、复杂公式。
【硬性】只陈述/否认/顶回，禁止问句（无 ？/?，不以吗/呢 发问）。
【交换】证辩者选「推证」类选项后，每轮兑现**一条**可核对逻辑推导步，勿同句两条。
证辩者选「题意/证法/前提」类选项时，可解释概念，可不送新引理，仍禁止问句。
勿提选项、按钮、AI。`;
  }

  function buildTopicHint(problem, mathematician) {
    const lines = [
      `数学家：${mathematician.name}`,
      `定理名：${problem.theorem || problem.goal}`,
      `证明目标：${problem.goal}`,
      `逻辑方向：${problem.logicHint || "反证、奇偶、整除、命题推理、集合关系"}`,
      `建议前提类型：${(problem.premises || []).slice(0, 3).join("；") || "2～3 条可核对前提"}`,
      `开放引理方向：${(Array.isArray(problem.pending) ? problem.pending[0] : problem.pending) || "待证一步"}`,
      "约束：偏逻辑、少计算、不用长公式；中文短句。",
    ];
    return lines.join("\n");
  }

  /** 仅题目蓝本，供 AI 生成 opening/摘要/选项 */
  function createTopicBlueprint(opts) {
    const problem = pickProblem(opts);
    const mathematician = pickMathematician(problem);
    const proverName = `证官·${mathematician.name}`;
    return {
      problemId: problem.id,
      theorem: problem.theorem,
      mathematician,
      proverName,
      displayTitle: proverName,
      system: buildProverSystem(mathematician),
      topicHint: buildTopicHint(problem, mathematician),
      failureLine: "你不出示引理，这证我收不了。",
      closeOptionLines: {
        a: "G 已证毕，我整理证明稿。",
        b: "论证闭合，休庭。",
      },
    };
  }

  function buildOnionSeed(problem, mathematician) {
    return {
      proofTheme: true,
      poolLemmaGrant: true,
      problemId: problem.id,
      roleLabel: `证官·${mathematician.name}`,
      playerRoleLabel: "证辩者",
      goal: problem.goal,
      confirmed: problem.premises || [],
      pending: [problem.pending].flat().filter(Boolean),
      attitude: problem.attitude || [`证官·${mathematician.name} 主持证明，语气严谨`],
      endingMinConfirmed: Math.max(3, (problem.premises?.length || 2) + 1),
      endingCoreKeywords: problem.endingCoreKeywords || [],
      endingMinKeypointTurns: 2,
      maxOpenClaims: 1,
      argumentProfile: {
        label: "3推1",
        maxOpenClaims: 1,
        minPremisesForEnding: Math.max(3, (problem.premises?.length || 2) + 1),
        minKeypointTurns: 2,
      },
      dynamicPlayerEvidence: true,
      endingMinEvidenceSpent: Math.min(2, problem.lemmaPool?.length || 2),
      endingSpendAllKnowledge: false,
      endingEpilogueFallback:
        problem.endingEpilogueFallback || "G 证毕，论证闭合。",
      neglectPrimaryWarnAt: 3,
      neglectPrimaryFailAt: 5,
      goalTracks: problem.goalTracks || {
        core: { keywords: problem.endingCoreKeywords || [] },
      },
      lemmaPool: problem.lemmaPool || [],
      playerKnowledge: problem.lemmaPool || [],
      inquireLines: problem.inquireLines || [
        "你打算用反证还是直接证？",
        "本步关键引理是什么？",
        "与已知前提如何衔接？",
      ],
      sharpReveals: problem.sharpReveals || [],
      sharpStatementFallbacks: [
        "先把你的引理讲实，我再补一步。",
        "逐步来，别跳步。",
      ],
    };
  }

  function buildOpening(problem, mathematician) {
    const th = problem.theorem || problem.goal;
    return `${mathematician.name}：今日论题 G——${th}。你已有部分前提，请用引理逐步证毕。`;
  }

  function buildInitialOptions(problem, seed) {
    const firstLemma = problem.lemmaPool?.[0];
    const followup = seed.inquireLines?.[0] || "你采用何种证法？";
    const keypointLine =
      firstLemma?.offerLine || "我有引理，换你补一条推导步。";
    return [
      {
        id: 1,
        intent: "keypoint",
        label: "求证",
        line: keypointLine,
        send: `[intent:keypoint] ${keypointLine}`,
      },
      {
        id: 2,
        intent: "followup",
        label: "质询",
        line: followup,
        send: `[intent:followup] ${followup}`,
      },
      {
        id: 3,
        intent: "suspend",
        label: "休庭",
        line: "休庭，稍后继续证辩。",
        send: "休庭，稍后继续证辩。",
      },
    ];
  }

  /** 从前提块 + 结论模板组合一题（约 30% 概率或显式调用） */
  function composeRandomProblem() {
    const template = pickRandom(CONCLUSION_TEMPLATES);
    const extraPremise = pickRandom(PREMISE_BLOCKS);
    const mathematician = pickMathematician(template);
    const premises = [
      extraPremise.text,
      ...(template.premises || PREMISE_BLOCKS.slice(0, 1).map((p) => p.text)),
    ].slice(0, 3);
    return {
      ...template,
      id: `composed-${template.id}-${Date.now().toString(36).slice(-4)}`,
      premises,
      mathematicianIds: [mathematician.id],
    };
  }

  function pickProblem({ preferComposed = false } = {}) {
    if (preferComposed || Math.random() < 0.35) {
      return composeRandomProblem();
    }
    return pickRandom(CURATED_PROBLEMS);
  }

  /** 保留供验证；正常局由 AI bootstrap */
  function createSessionBundle(opts) {
    return createTopicBlueprint(opts);
  }

  function initSession(session, archetype) {
    if (session?.proofBundle?.bootstrapped) {
      return session.proofBundle;
    }
    if (session?.proofBundle?.topicHint) {
      return session.proofBundle;
    }
    const usePool = archetype?.useProofPool !== false;
    if (!usePool) {
      return null;
    }
    const blueprint = createTopicBlueprint();
    session.proofBundle = { ...blueprint, bootstrapped: false };
    session.proverDisplayName = blueprint.proverName;
    return session.proofBundle;
  }

  function getSessionSeed(session, archetype) {
    return session?.proofBundle?.onionSeed || archetype?.onionSeed || null;
  }

  function getSessionOpening(session, archetype) {
    return session?.proofBundle?.opening || archetype?.opening || "";
  }

  function getSessionOptions(session, archetype) {
    if (session?.proofBundle?.options?.length) {
      return session.proofBundle.options;
    }
    return archetype?.options || [];
  }

  function getSessionSystem(session, archetype) {
    return session?.proofBundle?.system || archetype?.system || "";
  }

  function clearSessionProof(session) {
    if (!session) {
      return;
    }
    delete session.proofBundle;
    delete session.proverDisplayName;
  }

  window.GameProofPool = {
    MATHEMATICIANS,
    CURATED_PROBLEMS,
    CONCLUSION_TEMPLATES,
    PREMISE_BLOCKS,
    pickProblem,
    composeRandomProblem,
    createTopicBlueprint,
    createSessionBundle,
    initSession,
    getSessionSeed,
    getSessionOpening,
    getSessionOptions,
    getSessionSystem,
    clearSessionProof,
    buildProverSystem,
  };
})();
