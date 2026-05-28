#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(name, ctx) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../js/${name}`), "utf8"), ctx);
}

const ctx = { window: { GameProofPool: {} }, console };
load("onion.js", ctx);
load("proof-board.js", ctx);
const B = ctx.window.GameProofBoard;

const archive = `【论证目标】
- 论题 G：及格者必已交卷
【证明席】
【前提集】
- [前提] P1：凡交卷者皆及格
- [前提] P2：小明已交卷
【证明进程】
- [待证#1] L1：小明及格
- [依赖] 若要证 G，则需证 L1`;

const model = B.parseProofBoardModel(archive);
if (!model || model.rows.length < 4) {
  console.error("expected G, P1, P2, L1 rows");
  process.exit(1);
}
const l1 = model.rows.find((r) => r.sym === "L1");
if (!l1 || l1.kind !== "pending" || !/小明及格/.test(l1.text)) {
  console.error("L1 pending missing");
  process.exit(1);
}
const html = B.renderProofBoardHtml(model);
if (!html.includes("L1") || !html.includes("小明及格")) {
  console.error("html should show L1 meaning");
  process.exit(1);
}

console.log("verify-proof-board: ok");
