#!/usr/bin/env node

const fs = require("fs");
const vm = require("vm");
const code = fs.readFileSync(require("path").join(__dirname, "../js/onion.js"), "utf8");
const ctx = { window: {} };
vm.runInContext(code, vm.createContext(ctx));
const G = ctx.window.GameOnion;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error(msg);
    failed++;
  }
}

const seed = {
  inquireLines: ["你打算用反证还是直接证？", "本步关键引理是什么？"],
};

assert(
  !G.detectPlayerNamesMastermind("L1 与前提 P1 如何衔接？"),
  "了解句不应判为供述指使者"
);
assert(
  G.isGoalAdvancePlayerLine("设 n=2k，换你说 n² 的表达式"),
  "引理交换句应为推进型"
);
assert(
  !G.isGoalAdvancePlayerLine("这题适合用反证吗？"),
  "了解句不应为推进型"
);
const session = {};
assert(
  G.pickProgramInquireLine(session, seed).includes("反证"),
  "应有了解句"
);
G.advanceInquireIndex(session);
assert(
  G.pickProgramInquireLine(session, seed).includes("引理"),
  "了解句应轮换"
);

if (failed) {
  process.exit(1);
}
console.log("verify-advance-inquire: ok");
