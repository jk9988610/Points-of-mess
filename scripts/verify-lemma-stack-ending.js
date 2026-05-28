#!/usr/bin/env node
/** aiDriven：须满足 minLemmaSteps + minKeypointTurns 才可结局 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = vm.createContext({ window: {}, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/proof-pool.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/onion.js"), "utf8"), ctx);
const onion = ctx.window.GameOnion;

const seed = {
  aiDriven: true,
  problemId: "infinitude-primes",
  minLemmaStepsForEnding: 2,
  endingMinKeypointTurns: 2,
  endingCoreKeywords: ["无穷", "素数"],
};

const plotOneQed = `【论证目标】论题 G：素数有无穷多个。
【证明席】
【证明进程】
- [已证] S1：N 除以表中素数均余 1。
- [证毕#1] L1：N 必有一个素因子不在表中。`;

const session = { keypointTurnCount: 2 };

if (onion.isReadyForEnding(plotOneQed, seed, session)) {
  console.error("should not end after only 1 [证毕] when minLemmaSteps=2");
  process.exit(1);
}

const plotTwoQed = `${plotOneQed}
- [证毕#2] L2：故素数无穷。`;

if (!onion.isLemmaStackComplete(plotTwoQed, seed)) {
  console.error("lemma stack should be complete");
  process.exit(1);
}
if (!onion.isReadyForEnding(plotTwoQed, seed, session)) {
  console.error("should be ready after full chain qed and kp>=2");
  process.exit(1);
}
if (onion.isReadyForEnding(plotTwoQed, seed, { keypointTurnCount: 1 })) {
  console.error("should need minKeypointTurns=2");
  process.exit(1);
}

console.log("verify-lemma-stack-ending: ok");
