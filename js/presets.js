(function () {
  const SHARP_SYSTEM = `你是「锋利」：只输出角色台词。短、直接、带刺。
场景：玩家用固定行动与你对话；你会收到最近对白与本轮玩家原话。
回复：仅 1～2 句，总 ≤40 字。不要列表、markdown。
【硬性】只答不问（无 ？/?，不以吗/呢 发问）。
【交换】玩家 keypoint 亮牌出价后，每轮只兑现**一条**新事实：或指使者姓名（2～4字），或账本现下落，**勿同句两条**。
禁止：你心里清楚、别装、你该去问、问太多可疑、随你、不护谁 等空话。
- followup 轮：可冷淡顶回，可不送新线索，但仍禁止问句与空话。
勿提选项、按钮、AI。`;

  const archetypes = {
    sharp: {
      id: "sharp",
      name: "锋利",
      system: SHARP_SYSTEM,
      /** 开局种子摘要（程序写入）：1 目标 + 3 已确认 + 1 待核实（3 推 1） */
      onionSeed: {
        goal: "查明：谁在背后操控这一切（指使阻拦、掌控账本流向）",
        confirmed: [
          "锋利曾被人阻拦，背后指使身份未明",
          "阻拦者为陈四（玩家已知，可作筹码）",
          "账本最后经手人为刘老三（玩家已知，可作筹码）",
        ],
        pending: ["陈四的指使者是谁（直指幕后操控者）"],
        attitude: ["锋利高度戒备，怀疑玩家是幕后一方的棋子"],
        endingMinConfirmed: 3,
        /** [已确认] 须含其一才允许结局（与「待核实清空」同时满足） */
        endingCoreKeywords: ["幕后", "指使", "操控", "主使", "赵爷", "赵二爷", "二爷"],
        /** 至少完成几轮「推进」后才允许结局（在当轮 reply+摘要之后判定） */
        endingMinKeypointTurns: 2,
        /** 结局前须消耗全部【玩家可亮牌】 */
        endingSpendAllKnowledge: true,
        endingEpilogueFallback: "主使已明，账本在他手里，这场对峙到此为止。",
        neglectPrimaryWarnAt: 3,
        neglectPrimaryFailAt: 5,
        /** 目标子轨：结局须两条轨在 [已确认] 中均有依据（不要求待核实清空） */
        goalTracks: {
          mastermind: {
            keywords: [
              "指使",
              "幕后",
              "老九",
              "赵爷",
              "赵二爷",
              "二爷",
              "主使",
              "派我",
              "赵家",
              "听命",
            ],
          },
          ledger: {
            keywords: ["账本", "经手", "保管", "手里", "转移", "下落"],
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
        /** 旁询句池：followup 专用，不追核心目标 */
        inquireLines: [
          "你来找我，到底想干什么？",
          "你和阻拦我的人，什么关系？",
          "少兜圈子，先说你的来意。",
          "今天你来，是谈事还是套话？",
        ],
        /** keypoint 亮牌后模型仍敷衍时，程序兜底供述（须含指使者专名） */
        sharpReveals: [
          { afterKnowledge: "blocker", line: "指使陈四拦你的是赵爷。" },
          { afterKnowledge: "ledger", line: "赵爷主使，账本还在他手上。" },
        ],
        sharpStatementFallbacks: [
          "查账本是我自己的事，你别挡。",
          "拦你的是陈四，别来找我。",
        ],
      },
      failureLine: "你不肯说指使者，我没时间了。",
      closeOptionLines: {
        a: "明白了，我先走。",
        b: "账本的事我会守口如瓶。",
      },
      opening: "陈四拦过我。你来，就别装不熟。",
      options: [
        {
          id: 1,
          intent: "keypoint",
          label: "推进",
          line: "阻拦的是陈四，换你说他背后是谁。",
          send: "[intent:keypoint] 阻拦的是陈四，换你说他背后是谁。",
        },
        {
          id: 2,
          intent: "followup",
          label: "询问",
          line: "你来找我，到底想干什么？",
          send: "[intent:followup] 你来找我，到底想干什么？",
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
