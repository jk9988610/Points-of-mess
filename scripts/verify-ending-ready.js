#!/usr/bin/env node
/** 与 onion.js isReadyForEnding 同语义 */

function extractGoal(text) {
  const block = String(text || "").match(/【本局目标】[\s\S]*?(?=【|$)/)?.[0];
  if (!block) return "";
  const items = [];
  for (const line of block.split("\n")) {
    const m = line.trim().match(/^[-*•]\s+(.+)$/);
    if (m) items.push(m[1].trim());
  }
  return items.join("；");
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

function hasGoalTracksAchieved(plotSummary, seed) {
  const tracks = seed?.goalTracks;
  if (!tracks) return null;
  const blob = extractConfirmedLines(plotSummary).join("\n");
  for (const key of Object.keys(tracks)) {
    const kws = tracks[key]?.keywords;
    if (!kws?.some((k) => blob.includes(k))) return false;
  }
  return true;
}

function isPlotReadyForEnding(plotSummary, seed) {
  if (!extractGoal(plotSummary)) return false;
  if (extractPendingLines(plotSummary).length > 0) return false;
  const confirmed = (plotSummary.match(/\[已确认\]/g) || []).length;
  const min = seed?.endingMinConfirmed ?? 2;
  if (confirmed < min) return false;
  if (!hasCoreGoalAchieved(plotSummary, seed)) return false;
  const tracksOk = hasGoalTracksAchieved(plotSummary, seed);
  if (tracksOk === false) return false;
  return true;
}

function hasSessionEndingProgress(session, seed) {
  const minKp = seed?.endingMinKeypointTurns ?? 0;
  if ((session?.keypointTurnCount || 0) < minKp) return false;
  if (seed?.endingSpendAllKnowledge) {
    const spent = session?.spentPlayerKnowledge || [];
    if (!spent.includes("blocker") || !spent.includes("ledger")) return false;
  }
  return true;
}

function isReadyForEnding(plotSummary, seed, session) {
  return (
    isPlotReadyForEnding(plotSummary, seed) &&
    hasSessionEndingProgress(session, seed)
  );
}

const sessionOpen = { keypointTurnCount: 0, spentPlayerKnowledge: [] };
const seed = {
  endingMinConfirmed: 2,
  endingCoreKeywords: ["幕后"],
  endingMinKeypointTurns: 0,
};
const pending = `【本局目标】\n- 查明幕后\n【剧情档案】\n- [已确认] a\n- [待核实#1] x`;
const readyNoCore = `【本局目标】\n- 查明幕后\n【剧情档案】\n- [已确认] a\n- [已确认] b`;
const ready = `${readyNoCore}\n- [已确认] 老李幕后指使阻拦并转移账本`;
if (isReadyForEnding(pending, seed, sessionOpen)) {
  console.error("should not be ready with pending");
  process.exit(1);
}
if (isReadyForEnding(readyNoCore, seed, sessionOpen)) {
  console.error("should need core keyword");
  process.exit(1);
}
if (!isReadyForEnding(ready, seed, sessionOpen)) {
  console.error("should be ready");
  process.exit(1);
}

const trackSeed = {
  endingMinConfirmed: 2,
  endingCoreKeywords: ["指使"],
  endingMinKeypointTurns: 0,
  goalTracks: {
    mastermind: { keywords: ["老九"] },
    ledger: { keywords: ["经手"] },
  },
};
const tracksWithPending = `【本局目标】\n- 查明幕后
【剧情档案】
- [已确认] 老九指使陈四
- [已确认] 账本经手为刘老三
- [待核实#1] 细节未清`;
if (isReadyForEnding(tracksWithPending, trackSeed, sessionOpen)) {
  console.error("3推1: should not end while [待核实#1] remains");
  process.exit(1);
}

const tracksReady = `【本局目标】\n- 查明幕后
【剧情档案】
- [已确认] 老九指使陈四阻拦
- [已确认] 账本经手为刘老三`;
if (!isReadyForEnding(tracksReady, trackSeed, sessionOpen)) {
  console.error("goalTracks: should be ready when pending cleared");
  process.exit(1);
}

const sharpSeed = {
  endingMinConfirmed: 3,
  endingCoreKeywords: ["指使", "幕后", "操控", "主使"],
  endingMinKeypointTurns: 2,
  endingSpendAllKnowledge: true,
  requireIds: ["blocker", "ledger"],
  goalTracks: {
    mastermind: { keywords: ["指使", "幕后", "老九", "主使", "派我", "赵家"] },
    ledger: { keywords: ["账本", "经手", "保管", "手里", "转移", "下落"] },
  },
};
const openingPlot = `【本局目标】（唯一，仅此一条）
- 查明：谁在背后操控这一切
【剧情档案】
- [已确认] 锋利曾被人阻拦，背后指使身份未明
- [已确认] 阻拦者为陈四（玩家已知，可作筹码）
- [已确认] 账本最后经手人为刘老三（玩家已知，可作筹码）
- [待核实#1] 陈四的指使者是谁（直指幕后操控者）`;
if (isPlotReadyForEnding(openingPlot, sharpSeed)) {
  console.error("opening plot must not be plot-ready");
  process.exit(1);
}
if (isReadyForEnding(openingPlot, sharpSeed, sessionOpen)) {
  console.error("opening session must not trigger full ending");
  process.exit(1);
}
if (!extractGoal(openingPlot).includes("操控")) {
  console.error("extractGoal should read bullet only, not header");
  process.exit(1);
}

console.log("verify-ending-ready: ok");
