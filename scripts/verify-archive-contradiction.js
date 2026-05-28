#!/usr/bin/env node
/** A2: reconcileEvidenceSlots — 改口覆盖 + 删待核实…无 */

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
    const m = line.trim().match(/^[-*•]?\s*\[待核实#?(\d+)?\]\s*(.*)$/i);
    if (m) items.push(m[2].trim());
  }
  return items;
}

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
  result = result.replace(
    /\n- \[待核实#[^\]]*\]\s*[（(]?(?:无|暂无|待填|待剧情推进后填写)[）)]?[^\n]*/gi,
    ""
  );
  const archiveMatch = result.match(/(【证明席】[\s\S]*?)$/) || result.match(/(【剧情档案】[\s\S]*?)$/);
  if (!archiveMatch) return result.trim();

  const head = archiveMatch[1].split("\n").slice(0, 1);
  const bodyLines = archiveMatch[1].split("\n").slice(1);
  const slotIds = Object.keys(seed?.goalTracks || { mastermind: {} });

  for (const slotId of slotIds) {
    const kws = seed?.goalTracks?.[slotId]?.keywords || [];
    if (!kws.length) continue;
    const claims = [];
    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i];
      if (!/\[已确认\]/.test(line) || /\[已推翻\]/.test(line)) continue;
      if (!kws.some((k) => line.includes(k))) continue;
      const name = extractClaimName(line, slotId);
      if (name) claims.push({ i, name });
    }
    const uniqueNames = [...new Set(claims.map((c) => c.name))];
    if (uniqueNames.length <= 1) continue;
    const keep = claims[claims.length - 1];
    for (const c of claims) {
      if (c.i !== keep.i && !/\[已推翻\]/.test(bodyLines[c.i])) {
        bodyLines[c.i] = bodyLines[c.i].replace(/(\[已确认\])/, "$1 [已推翻]");
      }
    }
  }

  const newArchive = [...head, ...bodyLines].join("\n");
  return result.replace(archiveMatch[1], newArchive).trim();
}

const seed = {
  goalTracks: {
    mastermind: { keywords: ["主使", "指使", "赵爷", "老九"] },
  },
};

const dualMastermind = `【剧情档案】
- [已确认] 锋利供述：赵爷是主使
- [已确认] 锋利供述：老九才是唯一主使
- [待核实#1] 无`;

const out = reconcileEvidenceSlots(dualMastermind, seed);
const confirmed = extractConfirmedLines(out);

if (extractPendingLines(out).length !== 0) {
  console.error("vacuous pending 无 should be removed");
  process.exit(1);
}
const overturned = confirmed.filter((l) => /\[已推翻\]/.test(l));
const active = confirmed.filter((l) => !/\[已推翻\]/.test(l));
if (overturned.length !== 1) {
  console.error("expected 1 overturned mastermind line, got", overturned.length);
  process.exit(1);
}
if (!active.some((l) => /老九/.test(l) && /主使/.test(l))) {
  console.error("latest mastermind claim should remain active");
  process.exit(1);
}
if (active.some((l) => /赵爷/.test(l) && !/\[已推翻\]/.test(l))) {
  console.error("older mastermind claim should be overturned");
  process.exit(1);
}

console.log("verify-archive-contradiction: ok");
