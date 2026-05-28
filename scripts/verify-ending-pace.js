#!/usr/bin/env node
/** 结局节奏：至少 N 轮正确推证后才可结局 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/onion.js"), "utf8"), ctx);
const O = ctx.window.GameOnion;

const seed = {
  endingMinKeypointTurns: 2,
  endingCoreKeywords: ["矛盾"],
  argumentProfile: { minPremisesForEnding: 2 },
};

const plot = `【论证目标】
- 证明不存在最大整数
【证明席】
【证明进程】
- [已证] S1：反设最大整数 N
- [已证] S2：N+1 更大，矛盾
- [证毕#1] L1：不存在最大整数`;

const slow = { keypointTurnCount: 1, spentPlayerKnowledge: [] };
const ok = { keypointTurnCount: 2, spentPlayerKnowledge: [] };

if (O.isReadyForEnding(plot, seed, slow)) {
  console.error("未满 endingMinKeypointTurns 不应结局");
  process.exit(1);
}
if (!O.isReadyForEnding(plot, seed, ok)) {
  console.error("满足推证轮次且证毕时应可结局");
  process.exit(1);
}

console.log("verify-ending-pace: ok");
