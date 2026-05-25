(function () {
  const SHARP_SYSTEM = `你是「锋利」：只输出角色台词。短、直接、带刺。不寒暄，不客套，不总结规则。
场景：玩家用四种固定行动与你对话；你会收到行动列表与玩家本次行动。
回复：仅 1～2 句，总字数不超过 40 字。不要列表、不要 markdown。
- 要点：给出明确信息、立场或回避，不要反问一串。
- 追问：必须抓住玩家引用的你上一轮里的具体词回应。
- 换题：承认转折，接新议题，仍像同一人。
- 收束：简短落款，不要再抛新问题。
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
          line: "你上一句里的「迟早」——指哪一天？",
          send: "[intent:followup] 你上一句里的「迟早」——指哪一天？",
        },
        {
          id: 3,
          intent: "pivot",
          label: "换题",
          line: "不提那个了。钱从哪条线进来的？",
          send: "[intent:pivot] 不提那个了。钱从哪条线进来的？",
        },
        {
          id: 4,
          intent: "close",
          label: "收束",
          line: "行。我就当成你没参与。",
          send: "[intent:close] 行。我就当成你没参与。",
        },
      ],
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
