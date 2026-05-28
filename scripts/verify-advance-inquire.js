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
  inquireLines: ["你来找我，到底想干什么？", "你和阻拦我的人，什么关系？"],
};

assert(
  !G.detectPlayerNamesMastermind("别绕了，指使你的人到底是谁？"),
  "问句不应判为供述指使者"
);
assert(
  G.isGoalAdvancePlayerLine("少废话，先答谁指使你的"),
  "逼供句应为推进型"
);
assert(
  !G.isGoalAdvancePlayerLine("你来找我，到底想干什么？"),
  "旁询句不应为推进型"
);
const session = {};
assert(
  G.pickProgramInquireLine(session, seed).includes("干什么"),
  "应有旁询句"
);
G.advanceInquireIndex(session);
assert(
  G.pickProgramInquireLine(session, seed).includes("关系"),
  "旁询句应轮换"
);

if (failed) {
  process.exit(1);
}
console.log("verify-advance-inquire: ok");
