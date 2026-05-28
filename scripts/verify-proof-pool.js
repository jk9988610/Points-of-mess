#!/usr/bin/env node
/** 证明题随机池：bundle 结构、摘要、开局选项 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadProofPool() {
  const onionSrc = fs.readFileSync(path.join(__dirname, "../js/onion.js"), "utf8");
  const poolSrc = fs.readFileSync(path.join(__dirname, "../js/proof-pool.js"), "utf8");
  const ctx = { window: {}, console };
  vm.runInNewContext(onionSrc, ctx);
  vm.runInNewContext(poolSrc, ctx);
  return ctx.window.GameProofPool;
}

const pool = loadProofPool();
if (!pool?.CURATED_PROBLEMS?.length) {
  console.error("CURATED_PROBLEMS empty");
  process.exit(1);
}

const bundle = pool.createSessionBundle();
const required = [
  "onionSeed",
  "opening",
  "options",
  "proverName",
  "system",
  "theorem",
];
for (const k of required) {
  if (!bundle[k]) {
    console.error(`bundle missing ${k}`);
    process.exit(1);
  }
}

const plot = (() => {
  const ctx2 = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/onion.js"), "utf8"), ctx2);
  return ctx2.window.GameOnion.buildSeedPlotSummary(bundle.onionSeed);
})();

if (!plot.includes("【论证目标】") || !plot.includes("[前提]")) {
  console.error("seed plot missing proof sections");
  process.exit(1);
}

const badNames = /α|β|Λ|陈四|刘老三|锋利|账本|指使者|赵爷|马奎/;
if (badNames.test(bundle.opening)) {
  console.error("opening contains legacy narrative terms:", bundle.opening);
  process.exit(1);
}
if (badNames.test(bundle.onionSeed.goal)) {
  console.error("goal contains legacy terms");
  process.exit(1);
}

const kp = bundle.options.find((o) => o.intent === "keypoint");
if (!kp?.line || kp.line.length < 4) {
  console.error("keypoint option missing");
  process.exit(1);
}

if (!bundle.onionSeed.poolLemmaGrant || !bundle.onionSeed.lemmaPool?.length) {
  console.error("lemmaPool not configured");
  process.exit(1);
}

const composed = pool.composeRandomProblem();
if (!composed.lemmaPool?.length || !composed.goal) {
  console.error("composeRandomProblem invalid");
  process.exit(1);
}

console.log("verify-proof-pool: ok");
