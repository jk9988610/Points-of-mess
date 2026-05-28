(function () {
  const FALLBACK_SYSTEM = `你是证官：逻辑推理论证席上的证官，严谨、简洁。
回复 1～2 句 ≤40 字；只陈述/否认/顶回，禁止问句。
证辩者选「推证」时，每轮兑现一条可核对逻辑推断（若…则…、故、矛盾等）。`;

  const archetypes = {
    sharp: {
      id: "sharp",
      name: "证官",
      displayTitle: "证官",
      useProofPool: true,
      system: FALLBACK_SYSTEM,
      onionSeed: {
        proofTheme: true,
        aiDriven: true,
        roleLabel: "证官",
        playerRoleLabel: "证辩者",
        dynamicPlayerEvidence: false,
        endingMinConfirmed: 3,
        endingMinKeypointTurns: 2,
        maxOpenClaims: 1,
        argumentProfile: { maxOpenClaims: 1, minPremisesForEnding: 3, minKeypointTurns: 2 },
      },
      failureLine: "你不出示引理，这证我收不了。",
      closeOptionLines: {
        a: "G 已证毕，我整理证明稿。",
        b: "论证闭合，休庭。",
      },
      opening: "今日论题 G 待证。请用引理逐步闭合。",
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
