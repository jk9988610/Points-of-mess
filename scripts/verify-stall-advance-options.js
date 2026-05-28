#!/usr/bin/env node
/** 僵局：3×advance 选项校验 */

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
  { intent: "advance", line: "由 P1、P2，依否后律得 L1。" },
  { intent: "advance", line: "后件假，故前件假，未下雨。" },
  { intent: "advance", line: "地不湿，由 P1 否后得未下雨。" },
];

const check = I.validateStallAdvanceOptions(raw);
if (!check.ok) {
  console.error("validateStallAdvanceOptions failed", check.reason);
  process.exit(1);
}

const opts = I.attachStallAdvanceIds(raw);
if (opts.length !== 3 || opts.some((o) => o.intent !== "advance")) {
  console.error("expected 3 advance buttons");
  process.exit(1);
}
if (!opts.every((o) => o.isCorrect)) {
  console.error("stall advances should all be correct");
  process.exit(1);
}

console.log("verify-stall-advance-options: ok");
