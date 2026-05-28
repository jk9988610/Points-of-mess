#!/usr/bin/env node
/** 交易先亮牌、空头承诺、回避 #1 计数 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(path.join(__dirname, "../js/onion.js"), "utf8");
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
  neglectPrimaryWarnAt: 3,
  neglectPrimaryFailAt: 5,
  playerKnowledge: [
    {
      id: "blocker",
      match: "陈四",
      offerLine: "阻拦的是陈四，换你说他背后是谁",
    },
  ],
};

assert(G.detectHollowTradeOffer("账本下落换你一句实话", seed), "应识别空头交易");
assert(
  !G.detectHollowTradeOffer("账本在刘老三手里，换你说陈四背后是谁", seed),
  "含具体信息不应算空头"
);
assert(
  !G.detectHollowTradeOffer("阻拦的是陈四，换你说他背后是谁", seed),
  "预设亮牌句不应判空头"
);
assert(
  G.detectTradeOfferNeedsPlayerFirst("若我说指使者，你就告诉我老九", seed),
  "若我说…就应先亮牌"
);

const session = { neglectPrimaryRounds: 0 };
const plot = `【本局目标】\n- 查明幕后\n【剧情档案】\n- [待核实#1] 指使者是谁`;

for (let i = 0; i < 4; i++) {
  G.bumpNeglectBeforeReply(session, "账本在哪？", plot, seed);
}
assert(session.neglectPrimaryRounds === 4, `回避计数应为 4，得 ${session.neglectPrimaryRounds}`);
G.bumpNeglectBeforeReply(session, "账本在哪？", plot, seed);
assert(G.getNeglectState(session, seed).shouldFail, "第 5 轮回避应触发 shouldFail");

session.neglectPrimaryRounds = 0;
session.emptyPromiseCount = 0;
G.trackEmptyPromise(session, "账本下落换你一句实话", seed);
G.trackEmptyPromise(session, "若我说指使者你就说老九", seed);
assert(G.isEmptyPromiseBankrupt(session), "两次空头承诺应信用破产");

if (failed) {
  process.exit(1);
}
console.log("verify-trade-onion: ok");
