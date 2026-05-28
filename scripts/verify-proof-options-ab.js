#!/usr/bin/env node
/** A/B 推证选项：校验 + 洗牌 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(name, ctx) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../js/${name}`), "utf8"), ctx);
}

const ctx = { window: {}, console, Math };
load("proof-intents.js", ctx);
const I = ctx.window.GameProofIntents;

const raw = [
  { intent: "advance", line: "设 n=2k，换你说 n²" },
  { intent: "decoy", line: "直接证 G，跳过 L1" },
  { intent: "clarify", line: "G 指什么？" },
  { intent: "explore", line: "用反证吗？" },
];

const check = I.validateProofOptions(raw);
if (!check.ok) {
  console.error("validate failed", check.reason);
  process.exit(1);
}

let sawSwap = false;
let sawNoSwap = false;
for (let i = 0; i < 40; i++) {
  const opts = I.attachOptionIds(raw);
  const p1 = opts.find((o) => o.id === 1);
  const p2 = opts.find((o) => o.id === 2);
  if (!p1?.isCorrect && p2?.isCorrect) sawSwap = true;
  if (p1?.isCorrect && !p2?.isCorrect) sawNoSwap = true;
  if (p1.intent === p2.intent) {
    console.error("proof pair must differ");
    process.exit(1);
  }
  if (!I.isProofStepIntent(p1.intent) || !I.isProofStepIntent(p2.intent)) {
    console.error("ids 1/2 must be proof steps");
    process.exit(1);
  }
}
if (!sawSwap || !sawNoSwap) {
  console.error("shuffle not exercised");
  process.exit(1);
}

console.log("verify-proof-options-ab: ok");
