#!/usr/bin/env node
/** 与 onion.js isReadyForEnding 同语义 */

function extractGoal(text) {
  const m = String(text || "").match(/【本局目标】\s*([\s\S]*?)(?=【|$)/);
  if (!m) return "";
  return m[1]
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .join("；");
}

function extractPendingLines(text) {
  const items = [];
  for (const line of String(text || "").split("\n")) {
    const m = line.trim().match(/^[-*•]?\s*\[待核实#?(\d+)?\]\s*(.*)$/);
    if (m) items.push(m[2].trim());
  }
  return items;
}

function extractConfirmedLines(text) {
  const lines = [];
  for (const line of String(text || "").split("\n")) {
    const t = line.trim();
    if (/\[已确认\]/.test(t)) lines.push(t);
  }
  return lines;
}

function hasCoreGoalAchieved(plotSummary, seed) {
  const keywords = seed?.endingCoreKeywords;
  if (!Array.isArray(keywords) || !keywords.length) return true;
  const blob = extractConfirmedLines(plotSummary).join("\n");
  return keywords.some((k) => blob.includes(k));
}

function isReadyForEnding(plotSummary, seed) {
  if (!extractGoal(plotSummary)) return false;
  if (extractPendingLines(plotSummary).length > 0) return false;
  const confirmed = (plotSummary.match(/\[已确认\]/g) || []).length;
  const min = seed?.endingMinConfirmed ?? 2;
  if (confirmed < min) return false;
  return hasCoreGoalAchieved(plotSummary, seed);
}

const seed = { endingMinConfirmed: 2, endingCoreKeywords: ["幕后"] };
const pending = `【本局目标】\n- 查明幕后\n【剧情档案】\n- [已确认] a\n- [待核实#1] x`;
const readyNoCore = `【本局目标】\n- 查明幕后\n【剧情档案】\n- [已确认] a\n- [已确认] b`;
const ready = `${readyNoCore}\n- [已确认] 老李幕后指使阻拦并转移账本`;
if (isReadyForEnding(pending, seed)) {
  console.error("should not be ready with pending");
  process.exit(1);
}
if (isReadyForEnding(readyNoCore, seed)) {
  console.error("should need core keyword");
  process.exit(1);
}
if (!isReadyForEnding(ready, seed)) {
  console.error("should be ready");
  process.exit(1);
}
console.log("verify-ending-ready: ok");
