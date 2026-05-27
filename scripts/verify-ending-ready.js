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

function isReadyForEnding(plotSummary, seed) {
  if (!extractGoal(plotSummary)) return false;
  if (extractPendingLines(plotSummary).length > 0) return false;
  const confirmed = (plotSummary.match(/\[已确认\]/g) || []).length;
  const min = seed?.endingMinConfirmed ?? 2;
  return confirmed >= min;
}

const pending = `【本局目标】\n- 弄清账本\n【剧情档案】\n- [已确认] a\n- [已确认] b\n- [待核实#1] x`;
const ready = `【本局目标】\n- 弄清账本\n【剧情档案】\n- [已确认] a\n- [已确认] b`;
if (isReadyForEnding(pending, { endingMinConfirmed: 2 })) {
  console.error("should not be ready with pending");
  process.exit(1);
}
if (!isReadyForEnding(ready, { endingMinConfirmed: 2 })) {
  console.error("should be ready");
  process.exit(1);
}
console.log("verify-ending-ready: ok");
