#!/usr/bin/env node
/** 证毕 L1 后应自动挂 L2，且一步 advance 不可结局 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(name, ctx) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../js/${name}`), "utf8"), ctx);
}

const ctx = { window: {}, console };
load("proof-pool.js", ctx);
load("onion.js", ctx);

const pool = ctx.window.GameProofPool;
const onion = ctx.window.GameOnion;

const chain = pool.getLemmaChain("sqrt2-irrational");
if (chain.length < 3) {
  console.error("sqrt2 lemmaChain too short");
  process.exit(1);
}

const afterL1 = `【论证目标】论题 G：√2 不能表为既约分数 p/q。
【证明席】
【前提集】
- [前提] P1：若 n² 为偶数，则 n 为偶数；既约分数 p/q 中 p、q 互素。
【证明进程】
- [已证] S1：p² = 2q²，p² 为偶数。
- [证毕#1] L1：若 √2 = p/q（既约），则 p² 为偶数。`;

const seed = {
  aiDriven: true,
  problemId: "sqrt2-irrational",
  minLemmaStepsForEnding: chain.length,
  endingMinKeypointTurns: 2,
  endingCoreKeywords: ["矛盾", "无理"],
};

const continued = onion.ensureOpenLemmaTowardGoal(afterL1, seed);
if (!/\[待证#2\]/.test(continued)) {
  console.error("should append [待证#2] after L1 qed");
  process.exit(1);
}
if (onion.isReadyForEnding(continued, seed, { keypointTurnCount: 2 })) {
  console.error("should not be ready with only L1 qed + new L2 open");
  process.exit(1);
}

const sessionEarly = { keypointTurnCount: 1 };
if (onion.isReadyForEnding(afterL1, seed, sessionEarly)) {
  console.error("should not end with kp=1");
  process.exit(1);
}

const allQed = `【论证目标】论题 G：√2 不能表为既约分数 p/q。
【证明席】
【证明进程】
- [证毕#1] L1：a
- [证毕#2] L2：b
- [证毕#3] L3：c
- [证毕#4] L4：p、q 偶与互素矛盾，故无理。`;

if (!onion.isReadyForEnding(allQed, seed, { keypointTurnCount: 2 })) {
  console.error("should be ready when full chain qed and kp>=2");
  process.exit(1);
}

console.log("verify-lemma-chain-continuity: ok");
