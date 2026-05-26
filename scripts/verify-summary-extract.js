#!/usr/bin/env node
/** Phase A+ O3：摘录逻辑手测（与 options-ai.js extractPendingVerification 同语义） */

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
    if (/^[-*•]\s*\[待核实\]/.test(trimmed) || /^\[待核实\]/.test(trimmed)) {
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
    name: "A+ 多行待核实",
    input: `【剧情档案】
- [已确认] 林晨凌晨三点离开东门
- [待核实] 蓝色账本完整下落
- [待核实] 谁指使老张
【关系与态度】
- 锋利施压`,
    expect: (out) => out.includes("账本") && out.includes("老张"),
  },
  {
    name: "旧格式未解问题",
    input: `【已确认事实】林晨在场
【未解问题】
老张是谁
【关系与态度】暂无`,
    expect: (out) => out.includes("老张"),
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
