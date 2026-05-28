(function () {
  /** 证明题选项：两推证（一正一误，位置随机）+ 两了解 */
  const PROOF_OPTION_SPECS = [
    { id: 1, intent: "advance", label: "推证", engine: "keypoint", slot: "proofA" },
    { id: 2, intent: "decoy", label: "推证", engine: "decoy", slot: "proofB" },
    { id: 3, intent: "clarify", label: "题意", engine: "followup" },
    { id: 4, intent: "explore", label: "证法", engine: "followup" },
  ];

  const LEGACY_MAP = {
    keypoint: "advance",
    followup: "clarify",
    premise: "explore",
  };

  const ENGINE_MAP = {
    advance: "keypoint",
    keypoint: "keypoint",
    decoy: "decoy",
    clarify: "followup",
    explore: "followup",
    premise: "followup",
    followup: "followup",
  };

  function normalizeUiIntent(intent) {
    const t = String(intent || "").trim();
    return LEGACY_MAP[t] || t;
  }

  function resolveEngineIntent(intent) {
    const ui = normalizeUiIntent(intent);
    return ENGINE_MAP[ui] || ENGINE_MAP[intent] || "followup";
  }

  function ariaLabel(intent) {
    const ui = normalizeUiIntent(intent);
    if (ui === "advance" || ui === "decoy") {
      return "推证";
    }
    const spec = PROOF_OPTION_SPECS.find((s) => s.intent === ui);
    return spec?.label || ui || "";
  }

  function isAdvanceIntent(intent) {
    return normalizeUiIntent(intent) === "advance";
  }

  function isDecoyIntent(intent) {
    return normalizeUiIntent(intent) === "decoy";
  }

  function isProofStepIntent(intent) {
    const ui = normalizeUiIntent(intent);
    return ui === "advance" || ui === "decoy";
  }

  function isInquireIntent(intent) {
    const ui = normalizeUiIntent(intent);
    return ui === "clarify" || ui === "explore" || ui === "premise";
  }

  function validateProofOptions(options) {
    const list = Array.isArray(options) ? options : [];
    const intents = list.map((o) => normalizeUiIntent(o?.intent)).filter(Boolean);
    const required = ["advance", "decoy", "clarify", "explore"];
    for (const req of required) {
      const count = intents.filter((i) => i === req).length;
      if (count !== 1) {
        return { ok: false, reason: `${req} 应为 1 条，实际 ${count}` };
      }
    }
    return { ok: true };
  }

  /** 绑定 id，并随机交换两枚推证钮位置（intent 随句迁移） */
  function attachOptionIds(parsedList) {
    const byIntent = new Map();
    for (const item of parsedList) {
      const ui = normalizeUiIntent(item.intent);
      if (ui && item.line) {
        byIntent.set(ui, String(item.line).trim());
      }
    }
    let proofA = { intent: "advance", line: byIntent.get("advance") || "" };
    let proofB = { intent: "decoy", line: byIntent.get("decoy") || "" };
    if (Math.random() < 0.5) {
      const tmp = proofA;
      proofA = proofB;
      proofB = tmp;
    }
    const ordered = [
      proofA,
      proofB,
      { intent: "clarify", line: byIntent.get("clarify") || "" },
      { intent: "explore", line: byIntent.get("explore") || "" },
    ];
    return PROOF_OPTION_SPECS.map((spec, i) => {
      const item = ordered[i];
      const ui = item.intent;
      const line = item.line;
      return {
        id: spec.id,
        intent: ui,
        label: ui === "advance" || ui === "decoy" ? "推证" : spec.label,
        isCorrect: ui === "advance",
        line,
        send: `[intent:${ui}] ${line}`,
      };
    });
  }

  window.GameProofIntents = {
    PROOF_OPTION_SPECS,
    normalizeUiIntent,
    resolveEngineIntent,
    ariaLabel,
    isAdvanceIntent,
    isDecoyIntent,
    isProofStepIntent,
    isInquireIntent,
    validateProofOptions,
    attachOptionIds,
  };
})();
