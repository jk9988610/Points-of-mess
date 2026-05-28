#!/usr/bin/env node
/** 数学证明体种子格式 */

function formatDependencyLine(from, to) {
  return `- [依赖] 若要证 ${from}，则需证 ${to}`;
}

function buildSeedPlotSummary(seed) {
  const goal = String(seed?.goal || "").trim();
  const confirmed = (seed?.confirmed || []).map((s) => String(s).trim()).filter(Boolean);
  const pending = (seed?.pending || []).map((s) => String(s).trim()).filter(Boolean);
  const lines = [];
  if (goal) {
    lines.push("【论证目标】", `- 论题 G：${goal}`, "");
  }
  lines.push("【证明席】", "【前提集】");
  confirmed.forEach((c, i) => {
    lines.push(`- [前提] P${i + 1}：${c}`);
  });
  lines.push("", "【证明进程】");
  pending.forEach((p, i) => {
    const n = i + 1;
    lines.push(`- [待证#${n}] L${n}：${p}`);
    lines.push(formatDependencyLine("G", `L${n}`));
  });
  return lines.join("\n").trim();
}

function extractGoal(text) {
  const block = text.match(/【论证目标】[\s\S]*?(?=【|$)/)?.[0] || "";
  const items = [];
  for (const line of block.split("\n")) {
    const m = line.trim().match(/^[-*•]\s+(?:论题\s*G[：:]\s*)?(.+)$/);
    if (m) {
      items.push(m[1].trim());
    }
  }
  return items.join("；");
}

function extractPendingLines(text) {
  const items = [];
  for (const line of String(text || "").split("\n")) {
    const m = line.trim().match(/^[-*•]?\s*\[待证#?(\d+)?\]\s*(?:L\d+[：:])?\s*(.*)$/i);
    if (m) items.push(m[2].trim());
  }
  return items;
}

const seed = {
  goal: "证明 √2 不能表为既约分数 p/q",
  confirmed: ["若 n² 为偶数，则 n 为偶数", "既约分数 p/q 中 p、q 互素"],
  pending: ["推出 p、q 均为偶数，与互素矛盾"],
};
const plot = buildSeedPlotSummary(seed);
if (!plot.includes("【论证目标】") || !plot.includes("【证明席】")) {
  console.error("proof seed sections missing");
  process.exit(1);
}
if (!plot.includes("[前提] P1") || !plot.includes("[待证#1]")) {
  console.error("proof markers missing");
  process.exit(1);
}
if (!plot.includes("[依赖] 若要证 G，则需证 L1")) {
  console.error("dependency line missing");
  process.exit(1);
}
if (plot.includes("若要证 G，则需证 L1：")) {
  console.error("dependency should not repeat lemma body");
  process.exit(1);
}
if ((plot.match(/\[前提\]/g) || []).length !== 2) {
  console.error("expected 2 premises");
  process.exit(1);
}
if (extractPendingLines(plot).length !== 1) {
  console.error("expected 1 open lemma");
  process.exit(1);
}
if (!extractGoal(plot).includes("√2")) {
  console.error("extractGoal failed");
  process.exit(1);
}

console.log("verify-onion-seed: ok");
