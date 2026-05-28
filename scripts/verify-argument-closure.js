#!/usr/bin/env node
/** A3: isArgumentClosed — 开放论断 + slot 闭合，非单纯数 [已确认] */

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
    const m = line.trim().match(/^[-*•]?\s*\[待核实#?(\d+)?\]\s*(.*)$/i);
    if (m) items.push(m[2].trim());
  }
  return items;
}

function extractConfirmedLines(text) {
  const lines = [];
  for (const line of String(text || "").split("\n")) {
    if (/\[已确认\]/.test(line)) lines.push(line);
  }
  return lines;
}

function getMaxOpenClaims(seed) {
  const profile = seed?.argumentProfile || {};
  return Number(profile.maxOpenClaims ?? seed?.maxOpenClaims) > 0
    ? Number(profile.maxOpenClaims ?? seed?.maxOpenClaims)
    : 1;
}

function mastermindTrackSatisfied(blob) {
  const text = String(blob || "");
  if (/锋利供述[：:][^。\n]{0,48}(?:指使|指使者|主使)/.test(text)) return true;
  if (/唯一主使|就是主使|没有别人/.test(text)) return true;
  if (/(?:指使|指使者|主使).{0,16}[\u4e00-\u9fa5]{2,6}/.test(text)) return true;
  return false;
}

function hasCoreGoalAchieved(plotSummary, seed) {
  const keywords = seed?.endingCoreKeywords;
  if (!Array.isArray(keywords) || !keywords.length) return true;
  const blob = extractConfirmedLines(plotSummary).join("\n");
  return keywords.some((k) => blob.includes(k)) || mastermindTrackSatisfied(blob);
}

function hasGoalTracksAchieved(plotSummary, seed) {
  const tracks = seed?.goalTracks;
  if (!tracks) return null;
  const blob = extractConfirmedLines(plotSummary).join("\n");
  for (const key of Object.keys(tracks)) {
    if (key === "mastermind" && mastermindTrackSatisfied(blob)) continue;
    const kws = tracks[key]?.keywords;
    if (!kws?.some((k) => blob.includes(k))) return false;
  }
  return true;
}

function isVacuousPendingText(text) {
  const p = String(text || "").trim();
  return !p || /^(?:[（(]?无[）)]?|暂无|未知|待填|待剧情推进后填写)$/.test(p);
}

function pendingIsResolvedMeta(pendingText, plotSummary) {
  const blob = extractConfirmedLines(plotSummary).join("\n");
  if (!mastermindTrackSatisfied(blob)) return false;
  return /是否|需核实|矛盾|身份与|实际在|最终指使者|更高层|另有/.test(pendingText);
}

function shouldClearPendingLine(pendingText, plotSummary) {
  const p = String(pendingText || "").trim();
  if (isVacuousPendingText(p)) return true;
  if (pendingIsResolvedMeta(p, plotSummary)) return true;
  const blob = extractConfirmedLines(plotSummary).join("\n");
  if (/指使者|主使|幕后|谁派|指使/.test(p)) {
    return mastermindTrackSatisfied(blob) || /唯一主使|就是主使|没有别人/.test(blob);
  }
  return false;
}

function isArgumentClosed(plotSummary, seed) {
  if (!extractGoal(plotSummary)) return false;
  const claims = extractPendingLines(plotSummary);
  if (claims.length > getMaxOpenClaims(seed)) return false;
  if (claims.filter((p) => !shouldClearPendingLine(p, plotSummary)).length > 0) {
    return false;
  }
  if (!hasCoreGoalAchieved(plotSummary, seed)) return false;
  const tracksOk = hasGoalTracksAchieved(plotSummary, seed);
  if (tracksOk === false) return false;
  return true;
}

const seed = {
  maxOpenClaims: 1,
  endingCoreKeywords: ["指使", "幕后"],
  goalTracks: {
    mastermind: { keywords: ["老九", "指使"] },
    ledger: { keywords: ["经手", "账本"] },
  },
};

const open = `【本局目标】\n- 查明幕后
【剧情档案】
- [已确认] 前提甲
- [已确认] 前提乙
- [待核实#1] 指使者是谁`;

const closedSlots = `【本局目标】\n- 查明幕后
【剧情档案】
- [已确认] 老九指使陈四
- [已确认] 账本经手为刘老三`;

const metaPending = `【本局目标】\n- 查明幕后
【剧情档案】
- [已确认] 锋利供述：老九是唯一主使
- [已确认] 账本经手为刘老三
- [待核实#1] 老九是否还有更高层（需核实）`;

if (isArgumentClosed(open, seed)) {
  console.error("open claim should block closure");
  process.exit(1);
}
if (!isArgumentClosed(closedSlots, seed)) {
  console.error("slots closed should allow closure");
  process.exit(1);
}
if (!isArgumentClosed(metaPending, seed)) {
  console.error("meta pending after mastermind named should be clearable → closed");
  process.exit(1);
}

const twoClaimSeed = { maxOpenClaims: 2, endingCoreKeywords: ["指使"] };
const threePending = `【本局目标】\n- 查明
【剧情档案】
- [待核实#1] a
- [待核实#2] b
- [待核实#3] c`;
if (isArgumentClosed(threePending, twoClaimSeed)) {
  console.error("3 pending exceeds maxOpenClaims=2");
  process.exit(1);
}

console.log("verify-argument-closure: ok");
