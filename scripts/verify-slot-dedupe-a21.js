#!/usr/bin/env node
/** A2.1: 用户日志句式 — 改口覆盖 + 矛盾 block 结局 */

function extractClaimName(line, slotId) {
  const t = String(line || "");
  if (slotId === "mastermind") {
    const patterns = [
      /而是([\u4e00-\u9fa5]{2,6})/,
      /的是([\u4e00-\u9fa5]{2,6})(?:[，。；]|$)/,
      /指使[\u4e00-\u9fa5]{0,8}的是([\u4e00-\u9fa5]{2,6})/,
      /(赵二爷|赵爷|老九|赵德柱)/,
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (m?.[1]) return m[1].trim();
    }
  }
  return "";
}

function reconcileEvidenceSlots(text, seed) {
  let result = String(text || "").trim();
  const archiveMatch = result.match(/(【证明席】[\s\S]*?)$/) || result.match(/(【剧情档案】[\s\S]*?)$/);
  if (!archiveMatch) return result.trim();
  const head = archiveMatch[1].split("\n").slice(0, 1);
  const bodyLines = archiveMatch[1].split("\n").slice(1);
  const slotIds = Object.keys(seed?.goalTracks || { mastermind: {} });
  for (const slotId of slotIds) {
    const kws = seed?.goalTracks?.[slotId]?.keywords || [];
    const claims = [];
    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i];
      if (!/\[已确认\]/.test(line) || /\[已推翻\]/.test(line)) continue;
      if (!kws.some((k) => line.includes(k))) continue;
      const name = extractClaimName(line, slotId);
      if (name) claims.push({ i, name });
    }
    if ([...new Set(claims.map((c) => c.name))].length <= 1) continue;
    const keep = claims[claims.length - 1];
    for (const c of claims) {
      if (c.i !== keep.i) {
        bodyLines[c.i] = bodyLines[c.i].replace(/(\[已确认\])/, "$1 [已推翻]");
      }
    }
  }
  return result.replace(archiveMatch[1], [...head, ...bodyLines].join("\n")).trim();
}

function hasUnresolvedSlotContradiction(plotSummary, seed) {
  const archiveMatch =
    String(plotSummary || "").match(/(【证明席】[\s\S]*?)$/) ||
    String(plotSummary || "").match(/(【剧情档案】[\s\S]*?)$/);
  if (!archiveMatch) return false;
  const bodyLines = archiveMatch[1].split("\n").slice(1);
  for (const slotId of Object.keys(seed?.goalTracks || {})) {
    const kws = seed?.goalTracks?.[slotId]?.keywords || [];
    const names = [];
    for (const line of bodyLines) {
      if (!/\[已确认\]/.test(line) || /\[已推翻\]/.test(line)) continue;
      if (!kws.some((k) => line.includes(k))) continue;
      const name = extractClaimName(line, slotId);
      if (name) names.push(name);
    }
    if ([...new Set(names)].length > 1) return true;
  }
  return false;
}

const seed = {
  goalTracks: { mastermind: { keywords: ["指使", "主使", "赵二爷", "刘老三"] } },
};

const userLog = `【剧情档案】
- [已确认] 锋利供述：指使陈四阻拦的是刘老三
- [已确认] 锋利供述：指使陈四阻拦的并非刘老三，而是赵二爷
- [已确认] 锋利供述：账本不在刘老三手里`;

const out = reconcileEvidenceSlots(userLog, seed);
if (!/\[已推翻\].*刘老三/.test(out)) {
  console.error("刘老三主使行应标 [已推翻]");
  process.exit(1);
}
if (!/而是赵二爷/.test(out) || /\[已推翻\].*赵二爷/.test(out)) {
  console.error("赵二爷行应保留为有效供述");
  process.exit(1);
}
if (hasUnresolvedSlotContradiction(out, seed)) {
  console.error("reconcile 后不应仍有 slot 矛盾");
  process.exit(1);
}
if (!hasUnresolvedSlotContradiction(userLog, seed)) {
  console.error("reconcile 前应有矛盾");
  process.exit(1);
}

console.log("verify-slot-dedupe-a21: ok");
