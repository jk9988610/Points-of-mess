(function () {
  /** 证明题选项 intent（面向玩家/UI） */
  const PROOF_OPTION_SPECS = [
    { id: 1, intent: "advance", label: "推证", engine: "keypoint" },
    { id: 2, intent: "clarify", label: "题意", engine: "followup" },
    { id: 3, intent: "explore", label: "证法", engine: "followup" },
    { id: 4, intent: "premise", label: "前提", engine: "followup" },
  ];

  const LEGACY_MAP = {
    keypoint: "advance",
    followup: "clarify",
  };

  const ENGINE_MAP = {
    advance: "keypoint",
    keypoint: "keypoint",
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
    const spec = PROOF_OPTION_SPECS.find((s) => s.intent === ui);
    return spec?.label || ui || "";
  }

  function isAdvanceIntent(intent) {
    return resolveEngineIntent(intent) === "keypoint";
  }

  function validateProofOptions(options) {
    const list = Array.isArray(options) ? options : [];
    const intents = list.map((o) => normalizeUiIntent(o?.intent)).filter(Boolean);
    const advanceCount = intents.filter((i) => i === "advance").length;
    if (advanceCount !== 1) {
      return { ok: false, reason: `advance 应为 1 条，实际 ${advanceCount}` };
    }
    const required = PROOF_OPTION_SPECS.map((s) => s.intent);
    for (const req of required) {
      if (!intents.includes(req)) {
        return { ok: false, reason: `缺少 intent ${req}` };
      }
    }
    return { ok: true };
  }

  function attachOptionIds(parsedList) {
    const byIntent = new Map();
    for (const item of parsedList) {
      const ui = normalizeUiIntent(item.intent);
      if (ui && item.line) {
        byIntent.set(ui, String(item.line).trim());
      }
    }
    return PROOF_OPTION_SPECS.map((spec) => {
      const line = byIntent.get(spec.intent) || "";
      return {
        id: spec.id,
        intent: spec.intent,
        label: spec.label,
        line,
        send: `[intent:${spec.intent}] ${line}`,
      };
    });
  }

  window.GameProofIntents = {
    PROOF_OPTION_SPECS,
    normalizeUiIntent,
    resolveEngineIntent,
    ariaLabel,
    isAdvanceIntent,
    validateProofOptions,
    attachOptionIds,
  };
})();
