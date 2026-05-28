/**
 * 逻辑推理论证题池：仅命题结构论证（假言、三段论、反证、鸽巢等）。
 * 禁止代数展开、求和公式、同余链、几何算角等公式推导型论题。
 */
(function () {
  const MATHEMATICIANS = [
    { id: "aristotle", name: "亚里士多德", title: "形式逻辑" },
    { id: "euclid", name: "欧几里得", title: "演绎论证" },
    { id: "cauchy", name: "柯西", title: "命题分析" },
    { id: "cantor", name: "康托尔", title: "集合与计数" },
    { id: "gauss", name: "高斯", title: "理证结构" },
  ];

  /** 可组合前提（纯命题，无算式） */
  const PREMISE_BLOCKS = [
    { id: "if-then", text: "若 P 则 Q（P 真则 Q 必真）" },
    { id: "not-both", text: "P 与 ¬P 不能同真" },
    { id: "trans", text: "若 P 则 Q，且若 Q 则 R，则若 P 则 R" },
    { id: "either", text: "P 与 ¬P 必居其一" },
    { id: "subset", text: "若 x∈A 则 x∈B（A 包含于 B）" },
    { id: "or-excl", text: "P 或 Q 至少一真，且 P、Q 不能同假" },
    { id: "finite-pigeon", text: "物体多于容器时，必有两物同容器" },
  ];

  /** 可组合论题模板（仅逻辑结构） */
  const CONCLUSION_TEMPLATES = [
    {
      id: "comp-modus-tollens",
      logicHint: "假言推理、否后否前",
      theorem: "否后必否前",
      goal: "证明：若 P 则 Q，且 Q 不成立，则 P 不成立",
      lemmaChain: [
        "已知 Q 为假，推断 P 不能为真",
        "故 P 为假，否后否前成立",
      ],
      endingCoreKeywords: ["否后", "否前", "P 假"],
      endingEpilogueFallback: "G 证毕：否后否前成立。",
    },
    {
      id: "comp-transitivity",
      logicHint: "假言传递、三段论",
      theorem: "假言链传递",
      goal: "证明：若 P 则 Q，且若 Q 则 R，则若 P 则 R",
      lemmaChain: [
        "由 P 真经若 P 则 Q 得 Q 真",
        "由 Q 真经若 Q 则 R 得 R 真，故若 P 则 R",
      ],
      endingCoreKeywords: ["传递", "若 P 则 R"],
      endingEpilogueFallback: "G 证毕：假言传递成立。",
    },
    {
      id: "comp-disjunctive",
      logicHint: "选言推理、排除法",
      theorem: "选言三段论",
      goal: "证明：P 或 Q 为真，且 P 为假，则 Q 为真",
      lemmaChain: [
        "P 假时，P 或 Q 要求 Q 为真",
        "故 Q 必真，选言推理成立",
      ],
      endingCoreKeywords: ["选言", "Q 真"],
      endingEpilogueFallback: "G 证毕：选言推理成立。",
    },
  ];

  /** 精选逻辑论证题（每题含 lemmaChain，供程序续挂待证） */
  const CURATED_PROBLEMS = [
    {
      id: "rain-wet-ground",
      logicHint: "假言推理、否后否前",
      mathematicianIds: ["aristotle", "euclid"],
      theorem: "地不湿则可断定未下雨",
      goal: "由「若下雨则地湿」与「地不湿」推出未下雨",
      premises: ["若下雨，则地面会湿", "地面不湿"],
      lemmaChain: [
        "后件「地湿」为假",
        "若下雨则地湿下，前件「下雨」不能为真",
        "故未下雨，论题 G 成立",
      ],
      endingCoreKeywords: ["否后", "未下雨", "地不湿"],
      endingEpilogueFallback: "G 证毕：未下雨。",
      inquireLines: ["勿把因果颠倒；你用的是否后否前吗？"],
    },
    {
      id: "syllogism-barbara",
      logicHint: "三段论、全称命题",
      mathematicianIds: ["aristotle"],
      theorem: "经典三段论有效",
      goal: "证明：所有人皆会死，苏格拉底是人，故苏格拉底会死",
      premises: ["所有人皆会死", "苏格拉底是人"],
      lemmaChain: [
        "苏格拉底属于「人」",
        "人皆会死适用于苏格拉底",
        "故苏格拉底会死",
      ],
      endingCoreKeywords: ["三段论", "苏格拉底", "会死"],
      endingEpilogueFallback: "G 证毕：三段论结论成立。",
      inquireLines: ["中间项「人」在哪一步接入？"],
    },
    {
      id: "no-largest-int",
      logicHint: "反证、秩序、矛盾",
      mathematicianIds: ["euclid", "cauchy"],
      theorem: "不存在最大整数",
      goal: "证明：不存在上界最大的整数",
      premises: ["对任意整数 n，总存在 n+1 且 n+1>n"],
      lemmaChain: [
        "反设存在最大整数 N",
        "N+1 仍为正整数且 N+1>N，与 N 最大矛盾",
        "故不存在最大整数",
      ],
      endingCoreKeywords: ["矛盾", "最大", "N+1"],
      endingEpilogueFallback: "G 证毕：整数无上界。",
      inquireLines: ["反设之后，你构造了哪个后继？"],
    },
    {
      id: "pigeonhole-simple",
      logicHint: "鸽巢原理、反证、有限分类",
      mathematicianIds: ["cantor", "euclid"],
      theorem: "十物九巢必同巢",
      goal: "证明：10 只鸽子放入 9 个巢，必有两只同巢",
      premises: [
        "每只鸽子恰在一个巢中",
        "巢的个数少于鸽子只数",
      ],
      lemmaChain: [
        "反设每巢至多一鸽，则最多容纳 9 只",
        "无法容纳第 10 只，与已知矛盾",
        "故必有两鸽同巢",
      ],
      endingCoreKeywords: ["鸽巢", "矛盾", "同巢"],
      endingEpilogueFallback: "G 证毕：必有两鸽同巢。",
      inquireLines: ["反设后你数的是「至多几只」？"],
    },
    {
      id: "not-both-p-and-notp",
      logicHint: "矛盾律、排中",
      mathematicianIds: ["aristotle", "cauchy"],
      theorem: "P 与 ¬P 不能同真",
      goal: "证明：同一命题 P 不能既真又假",
      premises: ["真命题与它的否定互斥", "判定须一致，不可两可"],
      lemmaChain: [
        "设 P 与 ¬P 同真，则 P 真且 P 假",
        "同一命题不能既真又假，矛盾",
        "故 P 与 ¬P 不能同真",
      ],
      endingCoreKeywords: ["矛盾", "不能同真"],
      endingEpilogueFallback: "G 证毕：矛盾律成立。",
      inquireLines: ["矛盾出在「同真」还是「同假」？"],
    },
    {
      id: "contrapositive-equiv",
      logicHint: "逆否命题、等价",
      mathematicianIds: ["euclid", "gauss"],
      theorem: "原命题与逆否命题同真同假",
      goal: "证明：若 P 则 Q 与 若 ¬Q 则 ¬P 等价",
      premises: [
        "若 P 则 Q 表示 P 真时 Q 必真",
        "逆否命题为：若 Q 不真则 P 不真",
      ],
      lemmaChain: [
        "设若 P 则 Q 真且 Q 假，则 P 必假（否后否前）",
        "设若 ¬Q 则 ¬P 真且 P 真，则 Q 必真，与 Q 假矛盾",
        "故两命题同真同假",
      ],
      endingCoreKeywords: ["逆否", "等价", "同真同假"],
      endingEpilogueFallback: "G 证毕：原命题与逆否等价。",
      inquireLines: ["你证的是等价还是只证一个方向？"],
    },
    {
      id: "student-exam-pass",
      logicHint: "全称例化、三段论",
      mathematicianIds: ["aristotle", "gauss"],
      theorem: "及格者必已交卷",
      goal: "证明：凡交卷者皆及格，小明交卷，故小明及格",
      premises: ["凡交卷者皆及格", "小明已交卷"],
      lemmaChain: [
        "小明属于「交卷者」",
        "全称命题「凡交卷者皆及格」适用于小明",
        "故小明及格",
      ],
      endingCoreKeywords: ["小明", "及格", "交卷"],
      endingEpilogueFallback: "G 证毕：小明及格。",
      inquireLines: ["全称命题在哪一步例化到个体？"],
    },
    {
      id: "knights-truth-one",
      logicHint: "真假话、矛盾",
      mathematicianIds: ["euclid", "cauchy"],
      theorem: "两人至多一真",
      goal: "证明：甲说「乙说谎」、乙说「甲说谎」，不能两人皆真",
      premises: [
        "说真话者陈述为真，说谎者陈述为假",
        "甲、乙陈述不能同真同假而不一致",
      ],
      lemmaChain: [
        "设甲乙皆真，则乙说谎且甲说谎，互相矛盾",
        "设甲乙皆假，则乙说真话且甲说真话，亦矛盾",
        "故不能两人皆真，至多一真",
      ],
      endingCoreKeywords: ["矛盾", "说谎", "至多一真"],
      endingEpilogueFallback: "G 证毕：不能两人皆真。",
      inquireLines: ["你分了几种互斥情形？"],
    },
    {
      id: "subset-transitivity",
      logicHint: "集合包含、传递",
      mathematicianIds: ["cantor", "gauss"],
      theorem: "包含关系传递",
      goal: "证明：若 A⊆B 且 B⊆C，则 A⊆C",
      premises: [
        "x∈A 则 x∈B；x∈B 则 x∈C",
        "要证：任意 x，若 x∈A 则 x∈C",
      ],
      lemmaChain: [
        "设 x∈A，由 A⊆B 得 x∈B",
        "由 x∈B 与 B⊆C 得 x∈C",
        "故 A⊆C",
      ],
      endingCoreKeywords: ["包含", "传递", "A⊆C"],
      endingEpilogueFallback: "G 证毕：包含传递成立。",
      inquireLines: ["任意 x 从哪条前提进入链？"],
    },
    {
      id: "finite-no-injection",
      logicHint: "反证、一一对应、有限",
      mathematicianIds: ["cantor"],
      theorem: "有限集不能与其真子集一一对应",
      goal: "证明：有限集 A 与其真子集 B 不能建立双射",
      premises: [
        "双射意味着 A、B 元素个数相同",
        "B 为 A 的真子集则元素更少",
      ],
      lemmaChain: [
        "反设 A 与真子集 B 有双射",
        "双射要求元素个数相同，与真子集更少矛盾",
        "故不能建立双射",
      ],
      endingCoreKeywords: ["双射", "矛盾", "真子集"],
      endingEpilogueFallback: "G 证毕：不能与真子集双射。",
      inquireLines: ["矛盾来自「个数」还是「真子集」定义？"],
    },
  ];

  /** 池中禁止出现的公式推导痕迹（用于自检） */
  const FORMULA_DERIVATION_RE =
    /[²³√∫∑∏≡≠≤≥]|n\(n\+1\)|2k|2q²|p²|mod\s*p|180°|费马|同余|展开式|配對求和/i;

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
    return `你是「证官·${name}」：逻辑推理论证席上的证官，像断案推理。
场景：证辩者用命题结构（若…则…、故、否则、矛盾）逐步证毕论题 G。
回复：仅 1～2 句，≤40 字。禁止列表、markdown、算式与符号堆砌。
【硬性】只陈述/否认/顶回，禁止问句。
【交换】证辩者选「推证」后，兑现一条可核对逻辑推断，勿心算、勿长公式。
勿提选项、按钮、AI。`;
  }

  function buildTopicHint(problem, mathematician) {
    const chain = (problem.lemmaChain || []).slice(0, 4).join(" → ");
    const lines = [
      `证官：${mathematician.name}`,
      `论题：${problem.theorem || problem.goal}`,
      `证明目标：${problem.goal}`,
      `逻辑类型：${problem.logicHint || "命题推理"}`,
      `建议前提：${(problem.premises || []).slice(0, 3).join("；")}`,
      chain ? `引理链提示：${chain}` : "",
      "硬性：本题为逻辑推理题；选项与引理仅用日常/命题语言；禁止算式、展开、求和、几何角度计算。",
    ];
    return lines.filter(Boolean).join("\n");
  }

  function assertLogicOnlyPool() {
    const all = [...CURATED_PROBLEMS, ...CONCLUSION_TEMPLATES];
    for (const p of all) {
      const blob = [
        p.theorem,
        p.goal,
        ...(p.premises || []),
        ...(p.lemmaChain || []),
        ...(p.lemmaPool || []).map((x) => x.text + x.offerLine),
      ].join(" ");
      if (FORMULA_DERIVATION_RE.test(blob)) {
        window.PomDebug?.logLocalWarn?.("论题池", `疑似公式题：${p.id}`, ["pool"]);
      }
    }
  }

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

  function composeRandomProblem() {
    const template = pickRandom(CONCLUSION_TEMPLATES);
    const extraPremise = pickRandom(PREMISE_BLOCKS);
    const mathematician = pickMathematician(template);
    const premises = [extraPremise.text, ...(template.premises || [])].slice(0, 3);
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

  function findProblemById(problemId) {
    const id = String(problemId || "").trim();
    if (!id) {
      return null;
    }
    return (
      CURATED_PROBLEMS.find((p) => p.id === id) ||
      CONCLUSION_TEMPLATES.find((p) => p.id === id) ||
      null
    );
  }

  function getLemmaChain(problemId) {
    const problem = findProblemById(problemId);
    const chain = problem?.lemmaChain;
    if (!Array.isArray(chain) || !chain.length) {
      return [];
    }
    return chain.map((s) => String(s).trim()).filter(Boolean);
  }

  function getLemmaChainLength(problemId) {
    const chain = getLemmaChain(problemId);
    return chain.length > 0 ? chain.length : 2;
  }

  function getLemmaAtChainIndex(problemId, qedCount) {
    const chain = getLemmaChain(problemId);
    const idx = Number(qedCount) || 0;
    if (idx >= chain.length) {
      return null;
    }
    return chain[idx];
  }

  function getMinLemmaStepsForEnding(problemId) {
    const chain = getLemmaChain(problemId);
    if (chain.length > 0) {
      return chain.length;
    }
    return 2;
  }

  assertLogicOnlyPool();

  window.GameProofPool = {
    MATHEMATICIANS,
    CURATED_PROBLEMS,
    CONCLUSION_TEMPLATES,
    PREMISE_BLOCKS,
    FORMULA_DERIVATION_RE,
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
    findProblemById,
    getLemmaChain,
    getLemmaChainLength,
    getLemmaAtChainIndex,
    getMinLemmaStepsForEnding,
  };
})();
