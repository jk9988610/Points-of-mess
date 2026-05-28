#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const onionCode = fs.readFileSync(path.join(__dirname, "../js/onion.js"), "utf8");
const evidenceCode = fs.readFileSync(path.join(__dirname, "../js/evidence.js"), "utf8");
const ctx = {
  window: {
    PomJsonParse: {
      extractJsonObject(s) {
        return JSON.parse(String(s).trim());
      },
    },
    GameOnion: {},
    GameDialogue: { getDoneMessages: (m) => m },
    PomDebug: { logLocal() {}, logLocalWarn() {} },
    ChatApi: {},
  },
};
vm.runInContext(onionCode, vm.createContext(ctx));
ctx.window.GameOnion = ctx.window.GameOnion;
vm.runInContext(evidenceCode, vm.createContext(ctx));
const G = ctx.window.GameOnion;
const E = ctx.window.GameEvidence;

const seed = {
  dynamicPlayerEvidence: true,
  goal: "查明幕后",
  evidenceSeedHints: ["见陈四拦锋利"],
  endingMinEvidenceSpent: 2,
  endingSpendAllKnowledge: true,
  endingMinKeypointTurns: 2,
};

const session = {
  playerEvidence: [
    {
      id: "ev-1-1",
      text: "玩家见陈四拦锋利",
      offerLine: "阻拦的是陈四，换你说背后是谁",
      match: "陈四",
    },
  ],
  spentPlayerKnowledge: [],
  keypointTurnCount: 2,
};

const item = E.parseEvidenceGrant(
  '{"text":"玩家证据：见陈四拦人","offerLine":"陈四拦的你，换你说指使者","match":"陈四"}'
);
if (!item?.offerLine) {
  console.error("parseEvidenceGrant failed");
  process.exit(1);
}

const avail = G.getAvailableKnowledge(session, seed);
if (avail.length !== 1 || !avail[0].offerLine.includes("陈四")) {
  console.error("dynamic evidence pool");
  process.exit(1);
}

const fmt = G.formatPlayerKnowledgeForOptions(session, seed);
if (!fmt.includes("【证辩者引理】")) {
  console.error("options block label");
  process.exit(1);
}

session.spentPlayerKnowledge = ["ev-1-1"];
if (G.hasSessionEndingProgress(session, seed, "")) {
  console.error("1 spent evidence should not pass ending gate");
  process.exit(1);
}
session.playerEvidence.push({
  id: "ev-2-1",
  text: "账本经刘老三",
  offerLine: "账本在刘老三手里，换你说指使者",
  match: "刘老三",
});
session.spentPlayerKnowledge = ["ev-1-1", "ev-2-1"];
if (!G.hasSessionEndingProgress(session, seed, "")) {
  console.error("2 spent evidence should pass");
  process.exit(1);
}

console.log("verify-dynamic-evidence: ok");
