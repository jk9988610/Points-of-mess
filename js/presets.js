(function () {
  const PROVER_SYSTEM = `你是「证官·理证」：形式逻辑研讨台上的证明论辩驳人，说话像严谨数学家——冷静、精确、带刃。
场景：证辩者与你对论，目标是逐步闭合论题 G；证明席由程序维护。
回复：仅 1～2 句，总 ≤40 字。不要列表、markdown、公式编号。
【硬性】只陈述/否认/顶回，禁止问句（无 ？/?，不以吗/呢 发问）。
【交换】证辩者 keypoint 出示【玩家证据】引理后，每轮只兑现**一条**可核对推导步：或授权者专名（2～4字），或数据集 Λ 现存放处，**勿同句两条**。
禁止：你自己查公理表、别装、手册里都有、问太多无关、随你 等空泛推托。
- followup 轮：可质询立场/动机，可不送新引理，仍禁止问句。
勿提选项、按钮、AI。`;

  const archetypes = {
    sharp: {
      id: "sharp",
      name: "证官",
      displayTitle: "证官·理证",
      system: PROVER_SYSTEM,
      /** 数学证明题式开局（程序写入证明席） */
      onionSeed: {
        proofTheme: true,
        roleLabel: "证官",
        playerRoleLabel: "证辩者",
        goal: "论题 G：证明谁主控本推理链（谁授权 α 拦截并掌控数据集 Λ 的流向）",
        confirmed: [
          "辩者提交的引理包曾被人否决拦截，授权拦截者身份未明",
          "拦截执行者为 α（证辩者已知，可作观测引理）",
          "数据集 Λ 最后经 β 转交保管（证辩者已知，可作观测引理）",
        ],
        pending: ["α 的授权者是谁（直指主控命题）"],
        attitude: ["证官怀疑证辩者隶属主控方派别，语气严谨而戒备"],
        endingMinConfirmed: 3,
        endingCoreKeywords: [
          "主控",
          "授权",
          "公理源",
          "主使",
          "指使",
          "幕后",
          "Ω",
          "赵爷",
          "赵二爷",
          "马奎",
        ],
        endingMinKeypointTurns: 2,
        maxOpenClaims: 1,
        argumentProfile: {
          label: "3推1",
          maxOpenClaims: 1,
          minPremisesForEnding: 3,
          minKeypointTurns: 2,
        },
        dynamicPlayerEvidence: true,
        endingMinEvidenceSpent: 2,
        evidenceSeedHints: [
          "证辩者曾亲见 α 在东门否决辩者的引理提交",
          "证辩者调查得知数据集 Λ 最后经 β 转交",
        ],
        endingSpendAllKnowledge: true,
        endingEpilogueFallback: "主控链已闭合，数据集 Λ 归属已明，论题 G 证毕。",
        neglectPrimaryWarnAt: 3,
        neglectPrimaryFailAt: 5,
        goalTracks: {
          mastermind: {
            keywords: [
              "授权",
              "主控",
              "授权者",
              "指使",
              "主使",
              "公理源",
              "幕后",
              "α",
              "Ω",
              "马奎",
              "赵爷",
              "赵二爷",
              "老九",
              "派我",
              "听命",
            ],
          },
          ledger: {
            keywords: [
              "数据集",
              "Λ",
              "引理包",
              "推论链",
              "经手",
              "β",
              "保管",
              "存储",
              "转移",
              "下落",
              "账本",
            ],
          },
        },
        playerKnowledge: [
          {
            id: "blocker",
            match: "α",
            text: "观测引理：拦截执行者为 α",
            offerLine: "α 否决过引理提交，换你说授权者是谁",
          },
          {
            id: "ledger",
            match: "β",
            text: "观测引理：Λ 最后经 β 转交",
            offerLine: "Λ 经 β 转交，换你说授权者是谁",
          },
        ],
        inquireLines: [
          "你来证辩，先说明你的公理基与立场。",
          "你的论证动机是什么，找反例还是闭合 G？",
          "别绕定义，先交代你与主控方的关系。",
          "今日对论，是独立复核还是受人指派？",
        ],
        sharpReveals: [
          { afterKnowledge: "blocker", line: "授权 α 的是公理源 Ω。" },
          { afterKnowledge: "ledger", line: "Ω 主控，数据集 Λ 仍在 Ω 处。" },
        ],
        sharpStatementFallbacks: [
          "复核 Λ 是我的职责，你别打断推导。",
          "α 的事去问授权链，别找我空证。",
        ],
      },
      failureLine: "你不出示引理，这证我收不了。",
      closeOptionLines: {
        a: "G 已证毕，我整理证明稿。",
        b: "主控链闭合，休庭。",
      },
      opening: "α 否决过我的引理。你来证辩 G，别空口。",
      options: [
        {
          id: 1,
          intent: "keypoint",
          label: "求证",
          line: "我有观测引理，换你补一条推导步。",
          send: "[intent:keypoint] 我有观测引理，换你补一条推导步。",
        },
        {
          id: 2,
          intent: "followup",
          label: "质询",
          line: "你的论证立场是什么？",
          send: "[intent:followup] 你的论证立场是什么？",
        },
        {
          id: 3,
          intent: "suspend",
          label: "休庭",
          line: "休庭，稍后继续证辩。",
          send: "休庭，稍后继续证辩。",
        },
      ],
      suspendLine: "休庭，稍后继续证辩。",
    },
  };

  const characters = [
    {
      id: "sharp",
      name: "证官",
      archetypeId: "sharp",
      x: 0.72,
      y: 0.38,
      color: "#2563eb",
    },
  ];

  window.GamePresets = {
    archetypes,
    characters,
    getArchetype(archetypeId) {
      return archetypes[archetypeId];
    },
    getCharacter(id) {
      return characters.find((c) => c.id === id);
    },
  };
})();
