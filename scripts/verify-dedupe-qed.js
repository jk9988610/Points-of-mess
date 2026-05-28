#!/usr/bin/env node
/** [证毕#k] 逻辑去重 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(name, ctx) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../js/${name}`), "utf8"), ctx);
}

const ctx = { window: { GameProofPool: {} }, console };
load("onion.js", ctx);
const O = ctx.window.GameOnion;

const text = `【论证目标】
- 论题 G：未下雨
【证明席】
【证明进程】
- [待证#1] L1：若地不湿则未下雨
- [证毕#1] L1：若地不湿则未下雨
- [证毕#1] L1：若地不湿则未下雨`;

const out = O.dedupeLogicalProofEntries(text);
const count = (out.match(/\[证毕#1\]/g) || []).length;
if (count !== 1) {
  console.error("expected 1 qed line, got", count);
  process.exit(1);
}

console.log("verify-dedupe-qed: ok");
