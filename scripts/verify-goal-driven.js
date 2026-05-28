#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(path.join(__dirname, "../js/onion.js"), "utf8");
const ctx = { window: {} };
vm.runInContext(code, vm.createContext(ctx));
const G = ctx.window.GameOnion;

const seed = {
  neglectPrimaryFailAt: 5,
  goalTracks: {
    mastermind: { keywords: ["指使", "老九"] },
    ledger: { keywords: ["账本", "刘老三"] },
  },
  playerKnowledge: [
    {
      id: "blocker",
      match: "陈四",
      text: "陈四阻拦",
      offerLine: "阻拦的是陈四，换你说他背后是谁",
    },
  ],
};

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error(msg);
    failed++;
  }
}

const session = { spentPlayerKnowledge: [], neglectPrimaryRounds: 0 };
const plot = `【本局目标】\n- 查明\n【剧情档案】\n- [待核实#1] 指使者`;

G.bumpNeglectBeforeReply(session, "账本在刘老三手里，换线索", plot, seed);
assert(
  session.neglectPrimaryRounds === 0,
  "只推账本线不应累加回避"
);

session.neglectPrimaryRounds = 0;
G.bumpNeglectBeforeReply(session, "今天天气不错", plot, seed);
assert(session.neglectPrimaryRounds === 1, "无关台词应累加回避");

const reveal = G.pickProgramRevealLine(session, seed);
assert(reveal.includes("陈四"), "应能取到 offerLine");

G.markKnowledgeSpent(session, "阻拦的是陈四，换你说", seed);
assert(
  session.spentPlayerKnowledge.includes("blocker"),
  "亮牌后应消耗 knowledge"
);
assert(!G.pickProgramRevealLine(session, seed), "用尽后无 program reveal");

const dualTrack = `【本局目标】\n- 查明\n【剧情档案】
- [已确认] 老九指使陈四阻拦
- [已确认] 账本在刘老三手里
- [待核实#1] 仍有一问`;
assert(
  G.hasGoalTracksAchieved(dualTrack, seed) === true,
  "双轨 keyword 齐应达成"
);
assert(
  G.isReadyForEnding(dualTrack, {
    ...seed,
    endingMinConfirmed: 2,
    endingCoreKeywords: ["指使"],
  }),
  "有待核实也可结局（goalTracks）"
);

if (failed) {
  process.exit(1);
}
console.log("verify-goal-driven: ok");
