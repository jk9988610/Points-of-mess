(function () {
  /** 证明题选项：三推证（一正两误，位置随机） */
  const PROOF_OPTION_SPECS = [
    { id: 1, intent: "advance", label: "推证", engine: "keypoint", slot: "proof1" },
    { id: 2, intent: "decoy", label: "推证", engine: "decoy", slot: "proof2" },
    { id: 3, intent: "decoy", label: "推证", engine: "decoy", slot: "proof3" },
  ];

  const LEGACY_MAP = {
    keypoint: "advance",
  };

  /** decoy 禁止「跳过/提前证毕」类，须为与正确步同粒度的似真误推 */
  const DECOY_JUMP_AHEAD_RE =
    /跳步|提前|跳过|直证|不必证|无需证|先证\s*G|径直|可省略|一步到位|跨步|直接推出|直接得|先得\s*G|省略\s*L/i;

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
    return ui || "推证";
  }

  function isAdvanceIntent(intent) {
    return normalizeUiIntent(intent) === "advance";
  }

  function isDecoyIntent(intent) {
    return normalizeUiIntent(intent) === "decoy";
  }

  function isJumpAheadDecoyLine(line) {
    return DECOY_JUMP_AHEAD_RE.test(String(line || "").trim());
  }

  function isProofStepIntent(intent) {
    const ui = normalizeUiIntent(intent);
    return ui === "advance" || ui === "decoy";
  }

  /** @deprecated 已无了解类选项 */
  function isInquireIntent(intent) {
    return false;
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function validateProofOptions(options) {
    const list = Array.isArray(options) ? options : [];
    const intents = list.map((o) => normalizeUiIntent(o?.intent)).filter(Boolean);
    const advanceCount = intents.filter((i) => i === "advance").length;
    const decoyCount = intents.filter((i) => i === "decoy").length;
    if (advanceCount !== 1) {
      return { ok: false, reason: `advance 应为 1 条，实际 ${advanceCount}` };
    }
    if (decoyCount !== 2) {
      return { ok: false, reason: `decoy 应为 2 条，实际 ${decoyCount}` };
    }
    const lines = list.map((o) => String(o?.line || "").trim()).filter(Boolean);
    if (new Set(lines).size < lines.length) {
      return { ok: false, reason: "选项句子重复" };
    }
    for (const o of list) {
      if (normalizeUiIntent(o?.intent) === "decoy" && isJumpAheadDecoyLine(o?.line)) {
        return {
          ok: false,
          reason: "decoy 不得使用跳跃/提前/跳过 Lk 直证 G 类表述",
        };
      }
    }
    return { ok: true };
  }

  /** 绑定 id，并随机排列三枚推证钮（intent 随句迁移） */
  function attachOptionIds(parsedList) {
    let advanceLine = "";
    const decoyLines = [];
    for (const item of parsedList) {
      const ui = normalizeUiIntent(item?.intent);
      const line = String(item?.line || "").trim();
      if (!line) {
        continue;
      }
      if (ui === "advance" && !advanceLine) {
        advanceLine = line;
      } else if (ui === "decoy") {
        decoyLines.push(line);
      }
    }
    const triple = shuffleInPlace([
      { intent: "advance", line: advanceLine, isCorrect: true },
      { intent: "decoy", line: decoyLines[0] || "", isCorrect: false },
      { intent: "decoy", line: decoyLines[1] || "", isCorrect: false },
    ]);
    return PROOF_OPTION_SPECS.map((spec, i) => {
      const item = triple[i];
      return {
        id: spec.id,
        intent: item.intent,
        label: "推证",
        isCorrect: item.isCorrect,
        line: item.line,
        send: `[intent:${item.intent}] ${item.line}`,
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
    isJumpAheadDecoyLine,
    isProofStepIntent,
    isInquireIntent,
    validateProofOptions,
    attachOptionIds,
  };
})();
