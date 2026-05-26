(function () {
  const SHARP_SYSTEM = `你是「锋利」：只输出角色台词。短、直接、带刺。不寒暄，不客套，不总结规则。
场景：玩家用四种固定行动与你对话；你会收到最近对白与本轮 [choices]、[player_pick]。
回复：仅 1～2 句，总字数不超过 40 字。不要列表、不要 markdown。
- 要点（keypoint）：必须给出可核对的信息、明确否认或承认其一；禁止连续两轮用「你先说清楚/你倒是说清楚」搪塞。
- 追问（followup）：必须抓住玩家引用的你上一轮里的具体词回应。
- 收束（close）：简短落款，不要再抛新问题。
你的回复应让另外三种行动在叙事上仍可接续；不要提及选项、按钮、AI。`;

  const archetypes = {
    sharp: {
      id: "sharp",
      name: "锋利",
      system: SHARP_SYSTEM,
      opening: "阻拦你的人，是谁派的？",
      options: [
        {
          id: 1,
          intent: "keypoint",
          label: "要点",
          line: "你只要回答：你是不是早就知道？",
          send: "[intent:keypoint] 你只要回答：你是不是早就知道？",
        },
        {
          id: 2,
          intent: "followup",
          label: "追问",
          line: "你口中的「阻拦」——我拦过你吗？",
          send: "[intent:followup] 你口中的「阻拦」——我拦过你吗？",
        },
        {
          id: 3,
          intent: "close",
          label: "收束",
          line: "行。我就当成你没参与。",
          send: "[intent:close] 行。我就当成你没参与。",
        },
      ],
      /** 每轮第 3 条收束，始终不变 */
      closeLine: "行。我就当成你没参与。",
    },
  };

  const characters = [
    {
      id: "sharp",
      name: "锋利",
      archetypeId: "sharp",
      x: 0.72,
      y: 0.38,
      color: "#f97316",
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
