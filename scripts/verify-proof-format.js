#!/usr/bin/env node
/** 证明体：证毕后开放引理为空；[依赖] 为命题间关系 */

function extractPendingLines(text) {
  const qed = new Set();
  for (const line of String(text || "").split("\n")) {
    const m = line.trim().match(/\[证毕#?(\d+)?\]/i);
    if (m) qed.add(m[1] || "1");
  }
  const items = [];
  for (const line of String(text || "").split("\n")) {
    const m = line.trim().match(/^[-*•]?\s*\[待证#?(\d+)?\]\s*(.*)$/i);
    if (m && !qed.has(m[1] || "1")) items.push(m[2].trim());
  }
  return items;
}

const open = `【论证目标】
- 论题 G：证明 n² 偶则 n 偶
【证明席】
【证明进程】
- [待证#1] L1：由 n² 偶推出 n 偶
- [依赖] 若要证 G，则需证 L1`;

const closed = `【论证目标】
- 论题 G：证明 n² 偶则 n 偶
【证明席】
【证明进程】
- [证毕#1] L1：n=2k 故 n 偶
- [已证] S1：设 n² 为偶数`;

if (extractPendingLines(open).length !== 1) {
  console.error("open lemma");
  process.exit(1);
}
if (extractPendingLines(closed).length !== 0) {
  console.error("qed should close lemma");
  process.exit(1);
}
if (!open.includes("[依赖] 若要证 G，则需证 L1")) {
  console.error("dependency format");
  process.exit(1);
}

console.log("verify-proof-format: ok");
