#!/usr/bin/env node
/** 与 options-ai.js isCharacterReplyQuestion / filterCharacterReply 同语义 */

function isCharacterReplyQuestion(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (/[？?]/.test(t)) return true;
  if (/吗[。！]?$/.test(t) || /呢[。！]?$/.test(t)) return true;
  return false;
}

function filterCharacterReply(reply) {
  const t = String(reply || "").trim();
  if (!t || isCharacterReplyQuestion(t)) return "";
  return t;
}

const ok = ["陈四背后是老九。", "账本经手是刘老三，别绕。", "你心里清楚，别装。"];
const bad = ["谁派的？", "你敢接吗？", "来意是什么吗"];

for (const line of ok) {
  if (isCharacterReplyQuestion(line)) {
    console.error("false positive:", line);
    process.exit(1);
  }
}
for (const line of bad) {
  if (!isCharacterReplyQuestion(line)) {
    console.error("should be question:", line);
    process.exit(1);
  }
  if (filterCharacterReply(line)) {
    console.error("filter should drop:", line);
    process.exit(1);
  }
}

console.log("verify-character-no-question: ok");
