#!/usr/bin/env node
/** 逻辑题：证毕 L1 后应续挂 L2 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(name, ctx) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../js/${name}`), "utf8"), ctx);
}

const ctx = { window: { PomDebug: { logLocal() {} } }, console };
load("proof-pool.js", ctx);
load("onion.js", ctx);

const pool = ctx.window.GameProofPool;
const onion = ctx.window.GameOnion;

const chain = pool.getLemmaChain("rain-wet-ground");
if (chain.length < 2) {
  console.error("rain-wet lemmaChain too short");
  process.exit(1);
}

const afterL1 = `【论证目标】论题 G：由「若下雨则地湿」与「地不湿」推出未下雨。
【证明席】
【证明进程】
- [已证] S1：后件地湿为假。
- [证毕#1] L1：后件「地湿」为假。`;

const seed = {
  aiDriven: true,
  problemId: "rain-wet-ground",
  minLemmaStepsForEnding: chain.length,
  endingMinKeypointTurns: 2,
  endingCoreKeywords: ["未下雨"],
};

const continued = onion.ensureOpenLemmaTowardGoal(afterL1, seed);
if (!/\[待证#2\]/.test(continued)) {
  console.error("should append [待证#2]");
  process.exit(1);
}

console.log("verify-lemma-chain-continuity: ok");
