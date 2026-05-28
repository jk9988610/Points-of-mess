#!/usr/bin/env node
/** 双推证选项：1 advance + 1 decoy，随机排列 */

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
  { intent: "advance", line: "设 n=2k+1，展开 n² 得 2m+1 形。" },
  { intent: "decoy", line: "奇数乘奇数得奇数，故 n² 奇。" },
];

const jumpDecoy = I.validateProofOptions([
  { intent: "advance", line: "P 假，故 Q 真。" },
  { intent: "decoy", line: "跳过 L1，直接证 G。" },
]);
if (jumpDecoy.ok) {
  console.error("jump-ahead decoy should be rejected");
  process.exit(1);
}

const check = I.validateProofOptions(raw);
if (!check.ok) {
  console.error("validate failed", check.reason);
  process.exit(1);
}

const permutations = new Set();
for (let i = 0; i < 60; i++) {
  const opts = I.attachOptionIds(raw);
  if (opts.length !== 2) {
    console.error("expected 2 buttons");
    process.exit(1);
  }
  const correct = opts.filter((o) => o.isCorrect);
  if (correct.length !== 1 || correct[0].intent !== "advance") {
    console.error("exactly one advance");
    process.exit(1);
  }
  if (opts.filter((o) => o.intent === "decoy").length !== 1) {
    console.error("one decoy");
    process.exit(1);
  }
  permutations.add(opts.map((o) => (o.isCorrect ? "A" : "D")).join(""));
}
if (permutations.size < 2) {
  console.error("shuffle not exercised");
  process.exit(1);
}

console.log("verify-proof-options-ab: ok");
