#!/usr/bin/env node

function extractPendingLines(text) {
  const items = [];
  for (const line of String(text || "").split("\n")) {
    const m = line.trim().match(/\[待核实#?1?\]\s*(.*)$/i);
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

const MASTERMIND_RE =
  /(?:赵二爷|赵爷).{0,16}(?:主使|指使)|指使者(?:是|乃)(?:赵二爷|赵爷)/;

function isPlotReady(plot) {
  return extractPendingLines(plot).length === 0 && MASTERMIND_RE.test(extractConfirmedLines(plot).join(""));
}

function hasSessionProgress(session, seed, plot) {
  const minKp = seed.endingMinKeypointTurns ?? 2;
  if ((session.keypointTurnCount || 0) < minKp) return false;
  if (seed.endingSpendAllKnowledge) {
    const spent = session.spentPlayerKnowledge || [];
    const blob = plot;
    const blockerOk =
      spent.includes("blocker") ||
      (/陈四/.test(blob) && /指使|指使者|主使/.test(blob));
    const ledgerOk =
      spent.includes("ledger") ||
      (/刘老三/.test(blob) && /账本|经手|藏/.test(blob));
    if (!blockerOk || !ledgerOk) return false;
  }
  return true;
}

function isReady(plot, seed, session) {
  return isPlotReady(plot) && hasSessionProgress(session, seed, plot);
}

const seed = { endingMinKeypointTurns: 2, endingSpendAllKnowledge: true };
const plot = `【剧情档案】
- [已确认] 锋利供述：指使者是赵二爷，账本在他手里`;

const s1 = { keypointTurnCount: 1, spentPlayerKnowledge: ["blocker"] };
if (isReady(plot, seed, s1)) {
  console.error("1 keypoint should not end");
  process.exit(1);
}

const s2 = {
  keypointTurnCount: 2,
  spentPlayerKnowledge: ["blocker", "ledger"],
};
const plotLedger = `${plot}\n- [已确认] 锋利供述：刘老三藏匿账本`;
if (!isReady(plotLedger, seed, s2)) {
  console.error("2 keypoints + ledger in archive should end");
  process.exit(1);
}

console.log("verify-ending-pace: ok");
