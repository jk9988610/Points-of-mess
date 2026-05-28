#!/usr/bin/env node
/** [提示]/[已证部分] 中间进度补全 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(name, ctx) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../js/${name}`), "utf8"), ctx);
}

const ctx = {
  window: { GameProofPool: {}, GameProofIntents: {} },
  console,
};
load("proof-intents.js", ctx);
load("onion.js", ctx);
const O = ctx.window.GameOnion;
const I = ctx.window.GameProofIntents;

const archive = `【论证目标】
- 论题 G：未下雨
【证明席】
【前提集】
- [前提] P1：若下雨则地湿
- [前提] P2：地面不湿
【证明进程】
- [待证#1] L1：若地面不湿则未下雨
- [依赖] 若要证 G，则需证 L1`;

const session = {
  stallTurns: 0,
  messages: [
    { role: "user", intent: "decoy", content: "肯定后件", status: "done" },
    {
      role: "assistant",
      content: "错误：肯定后件。正确应使用否后律。",
      status: "done",
    },
  ],
};

const out = O.captureMidProgressFromTurn(session, archive, { aiDriven: true }, {
  optionTurns: 1,
  wrongProofPick: true,
});

if (!/\[提示\].*否后律/.test(out)) {
  console.error("expected [提示] for 否后律");
  process.exit(1);
}
if (!/\[待证#1\]/.test(out)) {
  console.error("pending L1 should remain");
  process.exit(1);
}

const stallBefore = O.countStallProgress(archive);
const stallAfter = O.countStallProgress(out);
if (stallAfter !== stallBefore) {
  console.error("hint should not increase stall progress count");
  process.exit(1);
}

const session2 = {
  stallTurns: 2,
  messages: [
    {
      role: "assistant",
      content: "否后律：若下雨则地湿，现地不湿，则未下雨。请确认。",
      status: "done",
    },
  ],
};
const out2 = O.captureMidProgressFromTurn(session2, archive, {}, {
  optionTurns: 3,
  stallTurns: 2,
});
if (!/\[已证部分\]/.test(out2)) {
  console.error("expected [已证部分] for half-hint");
  process.exit(1);
}

console.log("verify-mid-progress: ok");
