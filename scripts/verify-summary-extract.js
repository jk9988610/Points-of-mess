#!/usr/bin/env node
/** 证明席摘录逻辑（与 options-ai.js extractPendingVerification 同语义） */

function extractPendingVerification(plotSummary) {
  const text = String(plotSummary || "").trim();
  if (!text) {
    return "";
  }

  const pendingLines = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (
      /^[-*•]\s*\[待证#?\d*\]/i.test(trimmed) ||
      /^[-*•]\s*\[待核实#?\d*\]/i.test(trimmed) ||
      /^\[待证\]/i.test(trimmed) ||
      /^\[待核实\]/i.test(trimmed)
    ) {
      pendingLines.push(trimmed.replace(/^[-*•]\s*/, ""));
    }
  }
  if (pendingLines.length > 0) {
    return pendingLines.join("\n").slice(0, 400);
  }

  const legacy = text.match(/【未解问题】([\s\S]*?)(?=【|$)/);
  if (legacy) {
    return legacy[1].trim().slice(0, 400);
  }

  return text.slice(0, 400);
}

const cases = [
  {
    name: "证明体多行待证",
    input: `【证明席】
【证明进程】
- [已证] S1：n² 为偶数
- [待证#1] L1：推出 n 为偶数
- [依赖] 若要证 G，则需证 L1`,
    expect: (out) => out.includes("L1") && out.includes("待证"),
  },
  {
    name: "旧格式未解问题",
    input: `【已确认事实】P1 给定
【未解问题】
L1 如何由 n² 偶推出 n 偶`,
    expect: (out) => out.includes("L1"),
  },
  {
    name: "无标记回退截断",
    input: "x".repeat(500),
    expect: (out) => out.length === 400,
  },
];

let failed = 0;
for (const c of cases) {
  const out = extractPendingVerification(c.input);
  if (!c.expect(out)) {
    console.error(`FAIL: ${c.name}\n  got: ${JSON.stringify(out.slice(0, 80))}`);
    failed += 1;
  } else {
    console.log(`OK: ${c.name}`);
  }
}

if (failed > 0) {
  process.exit(1);
}
console.log("All extract tests passed.");
