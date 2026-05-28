#!/usr/bin/env node

function extractConfirmedLines(text) {
  const lines = [];
  for (const line of String(text || "").split("\n")) {
    if (/\[已确认\]/.test(line)) lines.push(line);
  }
  return lines;
}

function extractPendingLines(text) {
  const items = [];
  for (const line of String(text || "").split("\n")) {
    const m = line.trim().match(/^[-*•]?\s*\[待核实#?\d*\]\s*(.*)$/i);
    if (m) items.push(m[1].trim());
  }
  return items;
}

function mastermindTrackSatisfied(blob) {
  const text = String(blob || "");
  if (/锋利供述[：:][^。\n]{0,48}(?:指使|指使者|主使)/.test(text)) return true;
  if (/唯一主使|就是主使|没有别人/.test(text)) return true;
  if (
    /(?:指使|指使者|主使).{0,16}[\u4e00-\u9fa5]{2,6}/.test(text)
  ) {
    return true;
  }
  return false;
}

function shouldClear(plot) {
  const blob = extractConfirmedLines(plot).join("\n");
  if (!extractPendingLines(plot).length) return false;
  return mastermindTrackSatisfied(blob) || /唯一主使|没有别人/.test(blob);
}

const plot = `【剧情档案】
- [已确认] 锋利供述：陈四背后指使者为账房总管赵德柱
- [已确认] 锋利供述：赵德柱是唯一主使，否认有更高层人物
- [待核实#1] 赵德柱是否就是最终指使者`;

if (!mastermindTrackSatisfied(extractConfirmedLines(plot).join(""))) {
  console.error("should detect 赵德柱 mastermind");
  process.exit(1);
}
if (!shouldClear(plot)) {
  console.error("should clear meta pending");
  process.exit(1);
}

console.log("verify-mastermind-generic: ok");
