#!/usr/bin/env node
/** 逻辑论题池：蓝本 + 无公式推导题 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(name, ctx) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../js/${name}`), "utf8"), ctx);
}

const ctx = { window: { PomDebug: { logLocalWarn() {} } }, console };
load("proof-intents.js", ctx);
load("onion.js", ctx);
load("proof-pool.js", ctx);

const pool = ctx.window.GameProofPool;
const intents = ctx.window.GameProofIntents;
const re = pool.FORMULA_DERIVATION_RE;

const bannedIds = [
  "sqrt2-irrational",
  "sum-formula",
  "fermat-little",
  "triangle-angle-sum",
  "infinitude-primes",
  "comp-even-impl",
  "comp-odd-square",
];

for (const id of bannedIds) {
  const hit = pool.CURATED_PROBLEMS.find((p) => p.id === id);
  if (hit) {
    console.error("banned formula-style problem still in pool:", id);
    process.exit(1);
  }
}

const blueprint = pool.createTopicBlueprint();
if (!blueprint.topicHint || !blueprint.proverName || !blueprint.system) {
  console.error("blueprint incomplete");
  process.exit(1);
}

if (!/逻辑|命题|假言|三段|否后|矛盾/.test(blueprint.topicHint)) {
  console.error("topicHint should read as logic reasoning");
  process.exit(1);
}

const prob = pool.findProblemById(blueprint.problemId);
const pickBlob = [blueprint.theorem, prob?.goal, ...(prob?.lemmaChain || [])].join(' ');
if (re.test(pickBlob)) {
  console.error("picked blueprint looks formula-heavy");
  process.exit(1);
}

const badNames = /α|β|Λ|陈四|刘老三|锋利|账本|指使者|赵爷|马奎|休庭/;
if (badNames.test(blueprint.topicHint)) {
  console.error("topicHint has legacy terms");
  process.exit(1);
}

for (const p of pool.CURATED_PROBLEMS) {
  if (!Array.isArray(p.lemmaChain) || p.lemmaChain.length < 2) {
    console.error("curated problem missing lemmaChain:", p.id);
    process.exit(1);
  }
  const blob = [p.theorem, p.goal, ...p.lemmaChain].join(" ");
  if (re.test(blob)) {
    console.error("curated problem matches formula ban:", p.id);
    process.exit(1);
  }
}

const sample = intents.attachOptionIds([
  { intent: "advance", line: "地不湿，故按若下雨则地湿，下雨不成立" },
  { intent: "decoy", line: "地不湿，故原命题不成立" },
]);
const check = intents.validateProofOptions(sample);
if (!check.ok) {
  console.error("validateProofOptions failed", check.reason);
  process.exit(1);
}

const bootstrap = fs.readFileSync(path.join(__dirname, "../js/proof-bootstrap.js"), "utf8");
if (!bootstrap.includes("严禁") || !bootstrap.includes("逻辑推断")) {
  console.error("proof-bootstrap should ban formula derivation");
  process.exit(1);
}

console.log("verify-proof-pool: ok", `(${pool.CURATED_PROBLEMS.length} curated logic problems)`);
