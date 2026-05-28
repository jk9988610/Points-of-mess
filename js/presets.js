(function () {
  const FALLBACK_SYSTEM = `你是证官：数学证明研讨席上的证官，说话严谨、精确。
回复 1～2 句 ≤40 字；只陈述/否认/顶回，禁止问句。
证辩者出示引理后，每轮兑现一条可核对推导步。`;

  const archetypes = {
    sharp: {
      id: "sharp",
      name: "证官",
      displayTitle: "证官",
      useProofPool: true,
      system: FALLBACK_SYSTEM,
      /** 无随机池时的兜底（正常局由 GameProofPool 注入） */
      onionSeed: {
        proofTheme: true,
        poolLemmaGrant: true,
        roleLabel: "证官",
        playerRoleLabel: "证辩者",
        goal: "证明：n 为正整数时 n(n+1) 为偶数",
        confirmed: ["n 为正整数", "相邻整数必有一偶"],
        pending: ["说明 n(n+1) 必含因子 2"],
        dynamicPlayerEvidence: true,
        endingMinConfirmed: 3,
        endingMinKeypointTurns: 2,
        maxOpenClaims: 1,
        argumentProfile: { maxOpenClaims: 1, minPremisesForEnding: 3, minKeypointTurns: 2 },
        endingCoreKeywords: ["偶数", "因子 2"],
        goalTracks: { core: { keywords: ["偶数", "因子"] } },
        lemmaPool: [
          {
            id: "d1",
            match: "相邻",
            text: "n 与 n+1 为相邻整数",
            offerLine: "n 与 n+1 相邻，换你说其一的奇偶",
          },
        ],
        inquireLines: ["你打算分 n 奇偶讨论吗？"],
        sharpReveals: [{ afterKnowledge: "d1", line: "相邻整数中必有一偶，故 n(n+1) 为偶。" }],
      },
      failureLine: "你不出示引理，这证我收不了。",
      closeOptionLines: {
        a: "G 已证毕，我整理证明稿。",
        b: "论证闭合，休庭。",
      },
      opening: "今日论题 G 待证。请用引理逐步闭合。",
      options: [
        {
          id: 1,
          intent: "keypoint",
          label: "求证",
          line: "我有引理，换你补一条推导步。",
          send: "[intent:keypoint] 我有引理，换你补一条推导步。",
        },
        {
          id: 2,
          intent: "followup",
          label: "质询",
          line: "你采用何种证法？",
          send: "[intent:followup] 你采用何种证法？",
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
