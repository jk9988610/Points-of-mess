(function () {
  const SHARP_SYSTEM = `你是「锋利」：只输出角色台词。短、直接、带刺。不寒暄，不客套，不总结规则。
场景：玩家用固定行动与你对话；你会收到最近对白与本轮玩家原话。
回复：仅 1～2 句，总字数不超过 40 字。不要列表、不要 markdown。
- 亮牌（keypoint）：玩家给出可核对的具体事实时，接住并回以信息或否认；禁止先给线索换空头承诺。
- 施压（followup）：换角度逼供、限时、催促；不纠缠已亮明细节。
不要提及选项、按钮、AI。`;

  const archetypes = {
    sharp: {
      id: "sharp",
      name: "锋利",
      system: SHARP_SYSTEM,
      /** 开局种子摘要（程序写入，不调 API）；洋葱：目标 + 核心/中层/外层 */
      onionSeed: {
        /** 唯一核心目标；阻拦/账本等仅作并行中层，勿写成第二个终局目标 */
        goal: "查明：谁在背后操控这一切（指使阻拦、掌控账本流向）",
        confirmed: ["锋利曾被人阻拦，指使者身份尚未明确"],
        pending: [
          "阻拦者的指使者是谁（直指幕后操控者）",
          "账本当前下落、保管人及最近接触过账本的人（线索是否指向同一人）",
        ],
        attitude: ["锋利高度戒备，怀疑玩家是幕后一方的棋子"],
        endingMinConfirmed: 3,
        /** [已确认] 须含其一才允许结局（与「待核实清空」同时满足） */
        endingCoreKeywords: ["幕后", "指使", "操控", "主使"],
        neglectPrimaryWarnAt: 3,
        neglectPrimaryFailAt: 5,
        /** 目标子轨：结局须两条轨在 [已确认] 中均有依据（不要求待核实清空） */
        goalTracks: {
          mastermind: {
            keywords: ["指使", "幕后", "老九", "主使", "陈四", "派我"],
          },
          ledger: {
            keywords: ["账本", "刘老三", "经手", "保管", "手里"],
          },
        },
        /** 玩家开局已知、可消耗的事实（防空头交易死锁） */
        playerKnowledge: [
          {
            id: "blocker",
            match: "陈四",
            text: "阻拦者名叫陈四（玩家亲眼所见）",
            offerLine: "阻拦的是陈四，换你说他背后是谁",
          },
          {
            id: "ledger",
            match: "刘老三",
            text: "账本最后经手人是刘老三",
            offerLine: "账本在刘老三手里，换你说指使者是谁",
          },
        ],
      },
      failureLine: "你不肯说指使者，我没时间了。",
      closeOptionLines: {
        a: "明白了，我先走。",
        b: "账本的事我会守口如瓶。",
      },
      opening: "阻拦你的人，是谁派的？",
      options: [
        {
          id: 1,
          intent: "keypoint",
          label: "亮牌",
          line: "阻拦的是陈四，换你说他背后是谁。",
          send: "[intent:keypoint] 阻拦的是陈四，换你说他背后是谁。",
        },
        {
          id: 2,
          intent: "followup",
          label: "施压",
          line: "别绕了，指使你的人到底是谁？",
          send: "[intent:followup] 别绕了，指使你的人到底是谁？",
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
