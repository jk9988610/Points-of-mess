#!/usr/bin/env node
/** aiDriven：L1 证毕且无待证时应可结局 */

const fs = require("fs");
const vm = require("vm");
vm.runInContext(fs.readFileSync(require("path").join(__dirname, "../js/onion.js"), "utf8"), vm.createContext({ window: {} }));
const G = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(require("path").join(__dirname, "../js/onion.js"), "utf8"), G);
const onion = G.window.GameOnion;

const seed = { aiDriven: true, endingMinKeypointTurns: 2, endingMinConfirmed: 3 };
const plot = `【论证目标】论题 G：素数有无穷多个。
【证明席】
【前提集】
- [前提] P1：素数定义
【证明进程】
- [已证] S1：N 除以表中素数均余 1，故其素因子不在表中。
- [证毕#1] L1：N 必有一个素因子不在表中。`;

const session = { keypointTurnCount: 1 };

if (!onion.isLemmaStackComplete(plot, seed)) {
  console.error("lemma stack should be complete");
  process.exit(1);
}
if (onion.extractPendingLines(plot).length !== 0) {
  console.error("should have no pending");
  process.exit(1);
}
if (!onion.isReadyForEnding(plot, seed, session)) {
  console.error("aiDriven should be ready for ending after L1 qed");
  process.exit(1);
}
if (onion.isReadyForEnding(plot, seed, { keypointTurnCount: 0 })) {
  console.error("should need at least 1 advance");
  process.exit(1);
}

console.log("verify-lemma-stack-ending: ok");
