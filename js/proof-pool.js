/**
 * 逻辑推理证明题随机池：数学家、经典/组合论题、开局 opening/摘要/选项。
 * 偏命题推理与结构论证，少代数计算；每局抽取论题 G 供 AI 生成证明席。
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

  /** 可组合前提片段（逻辑命题，用于 composeRandomProblem） */
  const PREMISE_BLOCKS = [
    { id: "if-then", text: "若 P 则 Q（P 真则 Q 必真）" },
    { id: "not-both", text: "P 与 ¬P 不能同真" },
    { id: "trans", text: "若 P 则 Q，且若 Q 则 R，则若 P 则 R" },
    { id: "either", text: "命题 P 与 ¬P 必居其一" },
    { id: "subset", text: "若 x∈A 则 x∈B（A 包含于 B）" },
    { id: "n-even-sq", text: "若 n² 为偶数，则 n 为偶数（结构引理）" },
    { id: "coprime", text: "既约分数 p/q 中 p、q 互素" },
    { id: "finite-list", text: "有限表中的元素可逐一核对" },
  ];

  /** 可组合结论模板（纯逻辑结构，无长算式） */
  const CONCLUSION_TEMPLATES = [
    {
      id: "comp-modus-tollens",
      logicHint: "假言推理、否后否前",
      theorem: "否后必否前",
      goal: "证明：若 P 则 Q，且 Q 不成立，则 P 不成立",
      pending: ["由 Q 假按假言命题结构推出 P 假"],
      lemmaPool: [
        {
          id: "mt1",
          match: "Q 不成立",
          text: "已知 Q 为假",
          offerLine: "Q 已假，换你说对 P 的断定",
        },
        {
          id: "mt2",
          match: "否后",
          text: "若 P 则 Q 中，Q 假则 P 不能真",
          offerLine: "Q 假则 P 不可真，换你说 P 的真假",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "mt1", line: "Q 假时，P 真将违反若 P 则 Q。" },
        { afterKnowledge: "mt2", line: "故 P 必假，否后否前成立。" },
      ],
      endingCoreKeywords: ["否后", "否前", "假言"],
      goalTracks: { core: { keywords: ["否后", "否前", "Q 假", "P 假"] } },
      endingEpilogueFallback: "G 证毕：否后否前成立。",
    },
    {
      id: "comp-transitivity",
      logicHint: "三段论、传递推理",
      theorem: "假言链传递",
      goal: "证明：若 P 则 Q，且若 Q 则 R，则若 P 则 R",
      pending: ["由 P 真经两步假言推出 R 真"],
      lemmaPool: [
        {
          id: "tr1",
          match: "P 真",
          text: "设 P 成立",
          offerLine: "P 成立，换你说第一步推出的命题",
        },
        {
          id: "tr2",
          match: "Q 真",
          text: "由若 P 则 Q 得 Q 成立",
          offerLine: "Q 已成立，换你说对 R 的推断",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "tr1", line: "P 真则 Q 必真。" },
        { afterKnowledge: "tr2", line: "Q 真则 R 必真，故若 P 则 R。" },
      ],
      endingCoreKeywords: ["传递", "若 P 则 R", "三段"],
      goalTracks: { core: { keywords: ["传递", "P", "Q", "R"] } },
      endingEpilogueFallback: "G 证毕：假言链传递成立。",
    },
  ];

  /** 完整 curated 逻辑证明题 */
  const CURATED_PROBLEMS = [
    {
      id: "sqrt2-irrational",
      logicHint: "反证、奇偶结构、矛盾闭合",
      mathematicianIds: ["euclid"],
      theorem: "√2 是无理数",
      goal: "证明 √2 不能表为既约分数 p/q",
      premises: [
        "若 n² 为偶数，则 n 为偶数",
        "既约分数 p/q 中 p、q 互素（无公因子）",
      ],
      pending: ["推出 p、q 均为偶数，与互素矛盾"],
      lemmaPool: [
        {
          id: "s1",
          match: "既约",
          text: "设 √2=p/q，且 p/q 既约",
          offerLine: "设 √2=p/q 既约，换你说平方后的奇偶结构",
        },
        {
          id: "s2",
          match: "p²",
          text: "由 2q²=p² 得 p² 为偶数",
          offerLine: "p² 为偶，换你说 p 的奇偶",
        },
        {
          id: "s3",
          match: "q偶",
          text: "p 偶则 q² 偶，故 q 偶",
          offerLine: "p、q 皆偶，换你说与互素的矛盾",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "s1", line: "平方得 2q²=p²。" },
        { afterKnowledge: "s2", line: "p² 偶故 p 偶。" },
        { afterKnowledge: "s3", line: "q 亦偶，与互素矛盾。" },
      ],
      endingCoreKeywords: ["无理", "矛盾", "互素", "偶数"],
      goalTracks: { core: { keywords: ["矛盾", "互素", "偶数", "无理"] } },
      endingEpilogueFallback: "G 证毕：√2 无理。",
      inquireLines: [
        "反设有理后，你第一步锁定什么结构？",
        "互素条件打算在哪一步用？",
      ],
    },
    {
      id: "infinitude-primes",
      logicHint: "反设有限、构造矛盾、存在性",
      mathematicianIds: ["euclid"],
      theorem: "素数有无穷多个",
      goal: "证明：任意有限素数表均遗漏某素数",
      premises: [
        "大于 1 的整数若仅有 1 与自身为因子，则称为素数",
        "任意整数 n>1 必有素因子",
      ],
      pending: ["构造 N+1 并说明其素因子不在原表中"],
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
          text: "令 N=各素数乘积+1",
          offerLine: "令 N=乘积+1，换你说 N 的素因子归属",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "p1", line: "有限表必可编号。" },
        { afterKnowledge: "p2", line: "N 的素因子不在表中，反设破。" },
      ],
      endingCoreKeywords: ["无穷", "素数", "素因子", "矛盾"],
      goalTracks: { core: { keywords: ["素数", "素因子", "无穷"] } },
      endingEpilogueFallback: "G 证毕：素数无穷。",
      inquireLines: [
        "反设有限后，你的构造是什么？",
        "矛盾来自「表外素因子」还是计数？",
      ],
    },
    {
      id: "syllogism-barbara",
      logicHint: "三段论、集合包含、递推",
      mathematicianIds: ["euclid"],
      theorem: "三段论有效式",
      goal: "证明：所有人皆会死，苏格拉底是人，故苏格拉底会死",
      premises: ["所有人皆会死", "苏格拉底是人"],
      pending: ["由「人」概念将大、小前提联结到结论"],
      lemmaPool: [
        {
          id: "syl1",
          match: "苏格拉底",
          text: "苏格拉底属于「人」这一类",
          offerLine: "苏格拉底是人，换你说适用的全称命题",
        },
        {
          id: "syl2",
          match: "会死",
          text: "属于「人」者皆满足「会死」",
          offerLine: "人皆会死，换你说对苏格拉底的断定",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "syl1", line: "小前提把个体归入类。" },
        { afterKnowledge: "syl2", line: "大前提对该类赋予性质，结论成立。" },
      ],
      endingCoreKeywords: ["三段论", "人", "会死"],
      goalTracks: { core: { keywords: ["三段论", "苏格拉底", "会死"] } },
      endingEpilogueFallback: "G 证毕：三段论结论成立。",
      inquireLines: [
        "大前提与小前提如何对接？",
        "中间项「人」在哪一步起作用？",
      ],
    },
    {
      id: "no-largest-int",
      logicHint: "反设、构造后继、矛盾",
      mathematicianIds: ["euclid", "cauchy"],
      theorem: "不存在最大整数",
      goal: "证明：对任意整数 n，存在 n+1>n",
      premises: ["整数的序关系：若 m=n+1 则 m>n"],
      pending: ["说明不存在上界最大的整数"],
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
      id: "rain-wet-ground",
      logicHint: "假言推理、否后否前、日常命题",
      mathematicianIds: ["euclid", "cauchy"],
      theorem: "地不湿则可断定未下雨",
      goal: "由「若下雨则地湿」与「地不湿」推出未下雨",
      premises: ["若下雨，则地面会湿", "地面不湿"],
      pending: ["由地不湿否定假言后件，推出未下雨"],
      lemmaPool: [
        {
          id: "rw1",
          match: "地不湿",
          text: "后件「地湿」为假",
          offerLine: "地不湿，换你说对前件「下雨」的断定",
        },
        {
          id: "rw2",
          match: "未下雨",
          text: "若下雨则地湿下，前件不能为真",
          offerLine: "前件真则与地不湿矛盾，换你说前件真假",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "rw1", line: "后件假，假言式禁止前件真。" },
        { afterKnowledge: "rw2", line: "故前件「下雨」必假。" },
      ],
      endingCoreKeywords: ["否后", "地不湿", "未下雨"],
      goalTracks: { core: { keywords: ["否后", "地不湿", "下雨"] } },
      endingEpilogueFallback: "G 证毕：未下雨。",
      inquireLines: [
        "你用的是否后否前还是逆否？",
        "勿把「未下雨」与「地不湿」颠倒因果。",
      ],
    },
    {
      id: "pigeonhole-simple",
      logicHint: "鸽巢原理、有限分类、存在性",
      mathematicianIds: ["cantor", "euclid"],
      theorem: "十只鸽九巢必有两只同巢",
      goal: "证明：10 只鸽子放入 9 个巢，必有两只同巢",
      premises: [
        "鸽子与巢一一放入，每鸽恰在一巢",
        "巢的个数少于鸽子只数",
      ],
      pending: ["反设全不同巢导致鸽子数超过巢数，矛盾"],
      lemmaPool: [
        {
          id: "ph1",
          match: "反设",
          text: "反设每巢至多一鸽",
          offerLine: "设各巢最多一鸽，换你说最多能放几只",
        },
        {
          id: "ph2",
          match: "矛盾",
          text: "至多 9 只与 10 只矛盾",
          offerLine: "最多 9 只却需放 10 只，换你说矛盾点",
        },
      ],
      sharpReveals: [
        { afterKnowledge: "ph1", line: "每巢一鸽至多容纳 9 只。" },
        { afterKnowledge: "ph2", line: "无法放下第 10 只，反设破，必同巢。" },
      ],
      endingCoreKeywords: ["鸽巢", "矛盾", "同巢"],
      goalTracks: { core: { keywords: ["鸽巢", "矛盾", "同巢"] } },
      endingEpilogueFallback: "G 证毕：必有两鸽同巢。",
      inquireLines: [
        "反设「全不同巢」后数的是什么？",
        "矛盾来自数量比较还是定义？",
      ],
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
    return `你是「证官·${name}」：逻辑推理证明席上的证官，说话严谨、像断案推理。
场景：证辩者与你对论，用命题结构逐步证毕论题 G；证明席由程序维护。
回复：仅 1～2 句，总 ≤40 字。不要列表、markdown、长算式或大量符号。
【硬性】只陈述/否认/顶回，禁止问句（无 ？/?，不以吗/呢 发问）。
【交换】证辩者选「推证」后，每轮兑现**一条**可核对的逻辑推断（若…则…、故、否则、矛盾等），勿同句两条，勿心算长式。
证辩者选「题意/证法/前提」类选项时，可解释概念，可不送新引理，仍禁止问句。
勿提选项、按钮、AI。`;
  }

  function buildTopicHint(problem, mathematician) {
    const lines = [
      `数学家：${mathematician.name}`,
      `论题：${problem.theorem || problem.goal}`,
      `证明目标：${problem.goal}`,
      `逻辑方向：${problem.logicHint || "假言推理、三段论、反证、矛盾、集合/数量结构"}`,
      `建议前提类型：${(problem.premises || []).slice(0, 3).join("；") || "2～3 条可核对前提"}`,
      `开放引理方向：${(Array.isArray(problem.pending) ? problem.pending[0] : problem.pending) || "待证一步"}`,
      "约束：题型为逻辑推理题；选项与引理用日常/命题语言，禁止长乘除、级数、矩阵；禁止把结论当理由。",
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

  /** 从前提块 + 结论模板组合一题 */
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
    if (preferComposed || Math.random() < 0.4) {
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
