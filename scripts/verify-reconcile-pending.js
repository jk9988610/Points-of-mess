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
    const m = line.trim().match(/\[待核实#?1?\]\s*(.*)$/i);
    if (m) items.push(m[2].trim());
  }
  return items;
}

const MASTERMIND_NAMED_IN_ARCHIVE_RE =
  /(?:赵爷|老九).{0,16}(?:主使|指使)|听命于(?:赵爷|老九)/;

function mastermindNamedInArchive(plotSummary) {
  return MASTERMIND_NAMED_IN_ARCHIVE_RE.test(
    extractConfirmedLines(plotSummary).join("\n")
  );
}

function reconcilePlotSummary(plotSummary) {
  let text = String(plotSummary || "").trim();
  if (mastermindNamedInArchive(text)) {
    text = text.replace(/\n- \[待核实#1\][^\n]*/gi, "");
  }
  return text.trim();
}

const bloated = `【剧情档案】
- [已确认] 锋利供述：赵爷是主使且持有账本
- [待核实#1] 赵爷是否就是幕后操控者（需核实）`;

const out = reconcilePlotSummary(bloated);
if (extractPendingLines(out).length !== 0) {
  console.error("pending should clear when 赵爷+主使 in confirmed");
  process.exit(1);
}
if (!mastermindNamedInArchive(out)) {
  console.error("mastermind detect");
  process.exit(1);
}

console.log("verify-reconcile-pending: ok");
