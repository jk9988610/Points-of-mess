#!/usr/bin/env node
/** 与 js/onion.js buildSeedPlotSummary / extract 同语义 */

function buildSeedPlotSummary(seed) {
  const goal = String(seed?.goal || "").trim();
  const confirmed = (seed?.confirmed || []).map((s) => String(s).trim()).filter(Boolean);
  const pending = (seed?.pending || []).map((s) => String(s).trim()).filter(Boolean);
  const attitude = (seed?.attitude || []).map((s) => String(s).trim()).filter(Boolean);
  const lines = [];
  if (goal) {
    lines.push("【本局目标】（唯一，仅此一条）", `- ${goal}`, "");
  }
  lines.push("【剧情档案】");
  for (const c of confirmed) {
    lines.push(`- [已确认] ${c}`);
  }
  pending.forEach((p, i) => {
    lines.push(`- [待核实#${i + 1}] ${p}`);
  });
  if (attitude.length) {
    lines.push("", "【关系与态度】");
    for (const a of attitude) {
      lines.push(`- ${a}`);
    }
  }
  return lines.join("\n").trim();
}

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
    const trimmed = line.trim();
    const m = trimmed.match(/^[-*•]?\s*\[待核实#?(\d+)?\]\s*(.*)$/);
    if (m) {
      items.push({ order: m[1] ? Number(m[1]) : items.length + 1, text: m[2].trim() });
    }
  }
  items.sort((a, b) => a.order - b.order);
  return items.map((x) => x.text);
}

const seed = {
  goal: "查明：谁在背后操控这一切",
  confirmed: ["前提甲", "前提乙", "前提丙"],
  pending: ["待证：幕后者是谁"],
  attitude: ["戒备"],
};
const plot = buildSeedPlotSummary(seed);
const confirmedCount = (plot.match(/\[已确认\]/g) || []).length;
if (!plot.includes("【本局目标】（唯一") || !plot.includes("[待核实#1]")) {
  console.error("seed format missing sections");
  process.exit(1);
}
if (!extractGoal(plot).includes("操控")) {
  console.error("extractGoal failed");
  process.exit(1);
}
if (confirmedCount !== 3) {
  console.error("seed expects 3 [已确认], got", confirmedCount);
  process.exit(1);
}
if (extractPendingLines(plot).length !== 1) {
  console.error("extractPendingLines expects 1 pending");
  process.exit(1);
}

const twoClaimSeed = {
  goal: "查明",
  confirmed: ["甲", "乙"],
  pending: ["论断A", "论断B"],
  maxOpenClaims: 2,
};
const plot2 = buildSeedPlotSummary(twoClaimSeed);
if (extractPendingLines(plot2).length !== 2) {
  console.error("maxOpenClaims=2 seed expects 2 pending, got", extractPendingLines(plot2).length);
  process.exit(1);
}
if (!plot2.includes("[待核实#2]")) {
  console.error("missing [待核实#2]");
  process.exit(1);
}

console.log("verify-onion-seed: ok");
