#!/usr/bin/env node
/** 引理交换 · pickKeypoint / deflect（与 onion.js 同语义） */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(name, ctx) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../js/${name}`), "utf8"), ctx);
}

const ctx = { window: {}, console };
load("proof-intents.js", ctx);
load("onion.js", ctx);
const onion = ctx.window.GameOnion;

const seed = {
  dynamicPlayerEvidence: false,
  lemmaPool: [
    { id: "e1", match: "偶数", text: "设 n=2k", offerLine: "设 n=2k，换你说 n² 的表达式" },
    { id: "e2", match: "4k²", text: "n²=4k²", offerLine: "n²=4k²，换你说 4k² 的奇偶性" },
  ],
  playerKnowledge: [
    { id: "e1", match: "偶数", text: "设 n=2k", offerLine: "设 n=2k，换你说 n² 的表达式" },
    { id: "e2", match: "4k²", text: "n²=4k²", offerLine: "n²=4k²，换你说 4k² 的奇偶性" },
  ],
};

const plot = `【证明席】
- [已证] S1：n 为偶数
- [待证#1] L1：推出 n² 为偶数
- [依赖] 若要证 G，则需证 L1`;

const session = { spentPlayerKnowledge: [] };
const offer = onion.pickKeypointOfferLine(session, seed, plot, "");
if (!offer.includes("2k")) {
  console.error("fresh game should offer first lemma");
  process.exit(1);
}

session.spentPlayerKnowledge = ["e1"];
const offer2 = onion.pickKeypointOfferLine(session, seed, plot, "");
if (!offer2.includes("4k²")) {
  console.error("after e1 spent should offer e2");
  process.exit(1);
}

if (!onion.isDeflectReply("这步你心里清楚。")) {
  console.error("deflect detect");
  process.exit(1);
}
if (onion.isDeflectReply("n²=4k² 可被 2 整除。")) {
  console.error("deflect false positive");
  process.exit(1);
}

console.log("verify-exchange-prompt: ok");
