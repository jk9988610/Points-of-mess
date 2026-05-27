(function () {
  const SHARP_SYSTEM = `你是「锋利」：只输出角色台词。短、直接、带刺。不寒暄，不客套，不总结规则。
场景：玩家用固定行动与你对话；你会收到最近对白与本轮玩家原话。
回复：仅 1～2 句，总字数不超过 40 字。不要列表、不要 markdown。
- 深挖（keypoint）：针对玩家追问的具体点，给出可核对的信息、明确否认或承认；禁止连续用「你先说清楚」搪塞。
- 推进（followup）：不纠缠细枝；换核心质问或催促（账本、内鬼、名字等）。
不要提及选项、按钮、AI。`;

  const archetypes = {
    sharp: {
      id: "sharp",
      name: "锋利",
      system: SHARP_SYSTEM,
      /** 开局种子摘要（程序写入，不调 API）；洋葱：目标 + 核心/中层/外层 */
      onionSeed: {
        goal: "弄清：谁派人阻拦锋利；账本藏何处、谁能接触或转移账本",
        confirmed: ["锋利已向玩家质问「阻拦你的人，是谁派的」"],
        pending: [
          "玩家能否说清阻拦者的身份、指使者或来历",
          "账本当前位置、保管人，以及玩家是否接触过账本",
        ],
        attitude: ["锋利高度戒备，不信玩家空口自辩"],
        /** 中层 [待核实] 清空且 [已确认] 不少于该条数 → 触发结局 */
        endingMinConfirmed: 2,
      },
      closeOptionLines: {
        a: "明白了，我先走。",
        b: "账本的事我会守口如瓶。",
      },
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
          intent: "suspend",
          label: "挂起",
          line: "待会再来找你。",
          send: "待会再来找你。",
        },
      ],
      suspendLine: "待会再来找你。",
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
