#!/usr/bin/env node
/** 结局门：加载 onion.js，验证逻辑论证席语义 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = { window: {} };
vm.createContext(ctx);
for (const name of ["onion.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, `../js/${name}`), "utf8"), ctx);
}
const O = ctx.window.GameOnion;

const session = { keypointTurnCount: 2, spentPlayerKnowledge: [] };
const seed = {
  endingMinKeypointTurns: 2,
  endingCoreKeywords: ["否后", "未下雨"],
  goalTracks: { core: { keywords: ["否后"] } },
  argumentProfile: { minPremisesForEnding: 2 },
};

const pending = `【论证目标】
- 由「若下雨则地湿」与「地不湿」推出未下雨
【证明席】
【前提集】
- [前提] P1：若下雨则地湿
- [前提] P2：地不湿
【证明进程】
- [待证#1] L1：地不湿时可否后否前
- [依赖] 若要证 G，则需证 L1`;

const ready = `【论证目标】
- 由「若下雨则地湿」与「地不湿」推出未下雨
【证明席】
【前提集】
- [前提] P1：若下雨则地湿
- [前提] P2：地不湿
【证明进程】
- [已证] S1：地不湿，故下雨不成立，未下雨
- [证毕#1] L1：否后否前成立`;

if (O.isReadyForEnding(pending, seed, session)) {
  console.error("有待证时不应结局");
  process.exit(1);
}
if (!O.isReadyForEnding(ready, seed, session)) {
  console.error("引理证毕且关键词齐备时应可结局");
  process.exit(1);
}
if (!O.extractGoal(pending).includes("未下雨")) {
  console.error("extractGoal 应读出论证目标");
  process.exit(1);
}

console.log("verify-ending-ready: ok");
