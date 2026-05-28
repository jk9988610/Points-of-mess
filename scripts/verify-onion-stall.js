#!/usr/bin/env node
/** updateStallCounters 语义 */

function countConfirmed(text) {
  return (String(text || "").match(/\[已确认\]/g) || []).length;
}

function updateStallCounters(session, plotSummary) {
  const confirmed = countConfirmed(plotSummary);
  const prev = session.lastConfirmedCount ?? 0;
  if (confirmed > prev) {
    session.stallTurns = 0;
  } else {
    session.stallTurns = (session.stallTurns || 0) + 1;
  }
  session.lastConfirmedCount = confirmed;
  return { stallTurns: session.stallTurns, confirmed };
}

const session = { stallTurns: 0, lastConfirmedCount: 1 };
const s1 = "- [已确认] a\n- [待核实#1] x";
updateStallCounters(session, s1);
if (session.stallTurns !== 1) {
  console.error("stall should be 1 when no new confirmed");
  process.exit(1);
}
const s2 = "- [已确认] a\n- [已确认] b\n- [待核实#1] x";
updateStallCounters(session, s2);
if (session.stallTurns !== 0) {
  console.error("stall should reset");
  process.exit(1);
}
console.log("verify-onion-stall: ok");
