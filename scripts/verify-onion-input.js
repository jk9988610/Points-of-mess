#!/usr/bin/env node
/** onion 输入检测语义 */

function extractConfirmedLines(text) {
  const lines = [];
  for (const line of String(text || "").split("\n")) {
    if (/\[已确认\]/.test(line)) lines.push(line);
  }
  return lines;
}

const OFFER_KNOWN_RE = /我告诉|我说(?:出|了)?|拿.{0,8}换|用.{0,12}换/;
const ACTION_RE = /带我去|领我去|帮我找|陪我去/;

function normalizePlayerLineForApi(playerLine) {
  let s = String(playerLine || "").trim();
  if (ACTION_RE.test(s)) {
    const topic = s.replace(/带我去|领我去|帮我找|陪我去|跟我去|带我去找/g, "").trim();
    s = topic ? `关于${topic}，你有什么线索？` : "这事你还有别的线索吗？";
  }
  return s;
}

function detectRedundantPlayerOffer(playerLine, plotSummary) {
  const line = String(playerLine || "").trim();
  if (!OFFER_KNOWN_RE.test(line)) return false;
  const confirmed = extractConfirmedLines(plotSummary).join(" ");
  return confirmed.includes("老周") && line.includes("老周");
}

const plot = "- [已确认] 最后经手人是老周且已死";
if (!detectRedundantPlayerOffer("我告诉你账本最后经手人是老周", plot)) {
  console.error("redundant detect failed");
  process.exit(1);
}
const norm = normalizePlayerLineForApi("你带我去找老周女儿");
if (!/线索|在哪/.test(norm)) {
  console.error("normalize failed:", norm);
  process.exit(1);
}
console.log("verify-onion-input: ok");
