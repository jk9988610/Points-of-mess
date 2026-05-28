#!/usr/bin/env node
/** 交换契约 · pickKeypoint / deflect / program reveal（与 onion.js 同语义片段） */

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
    const m = line.trim().match(/\[待核实#?1?\]\s*(.*)$/);
    if (m) items.push(m[2].trim());
  }
  return items;
}

const DEFLECT_RE =
  /你心里|别装|你该去问|去问陈四|问太多|反倒可疑|不护谁|疑心太重|随你/;

function isDeflectReply(t) {
  return DEFLECT_RE.test(String(t || "").trim());
}

function pickKeypointOfferLine(spent, plot) {
  const avail = [
    { id: "blocker", match: "陈四", offerLine: "阻拦的是陈四，换你说他背后是谁" },
    { id: "ledger", match: "刘老三", offerLine: "账本在刘老三手里，换你说指使者是谁" },
  ].filter((k) => !spent.includes(k.id));
  if (avail[0]) return avail[0].offerLine;
  const blob = extractConfirmedLines(plot).join("");
  if (!/老九/.test(blob)) return "你已认了陈四，换你说他背后主使是谁。";
  return "";
}

const plot = `【剧情档案】
- [已确认] 阻拦者为陈四
- [待核实#1] 指使者`;

if (!pickKeypointOfferLine([], plot).includes("陈四")) {
  console.error("fresh game should offer blocker");
  process.exit(1);
}
if (!pickKeypointOfferLine(["blocker"], plot).includes("刘老三")) {
  console.error("after blocker spent should offer ledger");
  process.exit(1);
}
if (!isDeflectReply("真相背后的人，你心里清楚。")) {
  console.error("deflect detect");
  process.exit(1);
}
if (isDeflectReply("指使陈四的是老九。")) {
  console.error("deflect false positive");
  process.exit(1);
}

console.log("verify-exchange-prompt: ok");
