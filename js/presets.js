(function () {
  const SHARP_SYSTEM = `你是「锋利」：只输出角色台词。短、直接、带刺。不寒暄，不客套，不总结规则。
场景：玩家用固定行动与你对话；你会收到最近对白与本轮玩家原话。
回复：仅 1～2 句，总字数不超过 40 字。不要列表、不要 markdown。
- 深挖（keypoint）：针对玩家追问的具体点，给出可核对的信息、明确否认或承认；禁止连续用「你先说清楚」搪塞。
- 推进（followup）：不纠缠细枝；换核心质问或催促（账本、内鬼、名字等）。
- 收束（close）：简短落款，不要再抛新问题。
不要提及选项、按钮、AI。`;

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
          label: "深挖",
          line: "「阻拦」——谁派的？把名字说清楚。",
          send: "[intent:keypoint] 「阻拦」——谁派的？把名字说清楚。",
        },
        {
          id: 2,
          intent: "followup",
          label: "推进",
          line: "别扯阻拦，账本和内鬼先说清楚。",
          send: "[intent:followup] 别扯阻拦，账本和内鬼先说清楚。",
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
