#!/usr/bin/env node
/** 证明题随机池：蓝本 + intent 校验 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(name, ctx) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../js/${name}`), "utf8"), ctx);
}

const ctx = { window: {}, console };
load("proof-intents.js", ctx);
load("onion.js", ctx);
load("proof-pool.js", ctx);

const pool = ctx.window.GameProofPool;
const intents = ctx.window.GameProofIntents;

const blueprint = pool.createTopicBlueprint();
if (!blueprint.topicHint || !blueprint.proverName || !blueprint.system) {
  console.error("blueprint incomplete");
  process.exit(1);
}

const badNames = /α|β|Λ|陈四|刘老三|锋利|账本|指使者|赵爷|马奎|休庭/;
if (badNames.test(blueprint.topicHint)) {
  console.error("topicHint has legacy terms");
  process.exit(1);
}

const sample = intents.attachOptionIds([
  { intent: "advance", line: "设 n 为偶数，换你说 n² 的表达式" },
  { intent: "decoy", line: "直接断言 n² 偶，跳过 L1" },
  { intent: "decoy", line: "由结论反推，故前提成立" },
]);
const check = intents.validateProofOptions(sample);
if (!check.ok) {
  console.error("validateProofOptions failed", check.reason);
  process.exit(1);
}

const bootstrap = fs.readFileSync(path.join(__dirname, "../js/proof-bootstrap.js"), "utf8");
if (!bootstrap.includes("advance") || !bootstrap.includes("plotSummary")) {
  console.error("proof-bootstrap missing fields");
  process.exit(1);
}

console.log("verify-proof-pool: ok");
