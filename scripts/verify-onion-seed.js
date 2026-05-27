#!/usr/bin/env node
/** 与 js/onion.js buildSeedPlotSummary / extract 同语义 */

function buildSeedPlotSummary(seed) {
  const goal = String(seed?.goal || "").trim();
  const confirmed = (seed?.confirmed || []).map((s) => String(s).trim()).filter(Boolean);
  const pending = (seed?.pending || []).map((s) => String(s).trim()).filter(Boolean);
  const attitude = (seed?.attitude || []).map((s) => String(s).trim()).filter(Boolean);
  const lines = [];
  if (goal) {
    lines.push("【本局目标】", `- ${goal}`, "");
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
  goal: "弄清账本",
  confirmed: ["开场质问"],
  pending: ["阻拦者是谁", "账本在哪"],
  attitude: ["戒备"],
};
const plot = buildSeedPlotSummary(seed);
if (!plot.includes("【本局目标】") || !plot.includes("[待核实#1]")) {
  console.error("seed format missing sections");
  process.exit(1);
}
if (!extractGoal(plot).includes("账本")) {
  console.error("extractGoal failed");
  process.exit(1);
}
if (extractPendingLines(plot).length !== 2) {
  console.error("extractPendingLines failed");
  process.exit(1);
}
console.log("verify-onion-seed: ok");
