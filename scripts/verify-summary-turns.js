#!/usr/bin/env node
/** 与 summary.js 同语义：第 4/8… 轮应触发摘要压缩 */

const SUMMARY_EVERY_OPTION_TURNS = 4;

function countOptionTurns(sessionMessages) {
  return sessionMessages.filter(
    (m) => m.role === "user" && m.intent && m.intent !== "freeform"
  ).length;
}

function willRefreshPlotSummaryThisPick(session) {
  const optionTurns = countOptionTurns(session.messages);
  if (optionTurns < SUMMARY_EVERY_OPTION_TURNS) {
    return false;
  }
  if (optionTurns % SUMMARY_EVERY_OPTION_TURNS !== 0) {
    return false;
  }
  return session.lastSummaryAtOptionTurn !== optionTurns;
}

function mkMessages(n) {
  const msgs = [];
  for (let i = 0; i < n; i++) {
    msgs.push({ role: "user", intent: "keypoint", content: `p${i}` });
    msgs.push({ role: "assistant", content: `a${i}`, status: "done" });
  }
  return msgs;
}

let failed = 0;
for (let n = 1; n <= 8; n++) {
  const session = { messages: mkMessages(n), lastSummaryAtOptionTurn: 0 };
  const will = willRefreshPlotSummaryThisPick(session);
  const expect = n >= 4 && n % 4 === 0;
  if (will !== expect) {
    console.error(`n=${n}: got ${will}, want ${expect}`);
    failed++;
  }
}
if (failed) {
  process.exit(1);
}
console.log("verify-summary-turns: ok (4/8 轮触发)");
