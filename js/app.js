(function () {
  const { characters, getArchetype, getCharacter } = window.GamePresets;
  const { createId, createInitialState, getSession, persist } = window.GameState;
  const { getHistoryForApi } = window.GameDialogue;
  const {
    presetOptions,
    requestCombinedTurn,
    requestEndingSequence,
    requestFailureSequence,
  } = window.GameOptionsAi;
  const {
    draw,
    tickMove,
    canvasToWorld,
    worldToCanvas,
    hitCharacter,
    isNearPlayer,
    isInTalkZone,
    HIT_CHARACTER_RADIUS,
    INTERACT_RADIUS,
    TALK_ZONE_RADIUS,
  } = window.GameMap;

  function getSessionSeed(session, archetype) {
    return (
      window.GameProofPool?.getSessionSeed?.(session, archetype) ||
      archetype?.onionSeed ||
      null
    );
  }

  function resolveArchetype(archetype, session) {
    const bundle = session?.proofBundle;
    if (!bundle) {
      return archetype;
    }
    return {
      ...archetype,
      system: bundle.system || archetype.system,
      opening: bundle.opening || archetype.opening,
      options: bundle.options || archetype.options,
      failureLine: bundle.failureLine || archetype.failureLine,
      closeOptionLines: bundle.closeOptionLines || archetype.closeOptionLines,
      displayTitle: bundle.displayTitle || archetype.displayTitle,
      onionSeed: bundle.onionSeed || archetype.onionSeed,
    };
  }

  function resolveProver(character, session) {
    const name =
      session?.proverDisplayName ||
      session?.proofBundle?.proverName ||
      character?.name ||
      "证官";
    return { ...character, name };
  }

  /** 记忆测试输入框（暂隐藏，保留代码便于恢复） */
  const MEMORY_INPUT_ENABLED = false;

  const canvas = document.getElementById("gameCanvas");
  if (!canvas) {
    console.error("Points-of-mess: #gameCanvas 未找到，请确认 boot.js 在 </body> 前加载");
    window.PomDebug?.logLocalError(
      "启动失败",
      "游戏画布未就绪（脚本加载顺序错误）"
    );
    return;
  }
  const ctx = canvas.getContext("2d");
  const bubbleEl = document.getElementById("speechBubble");
  const bubbleTextEl = document.getElementById("speechBubbleText");
  const playerBubbleEl = document.getElementById("playerSpeechBubble");
  const playerBubbleTextEl = document.getElementById("playerSpeechBubbleText");
  const optionsBar = document.getElementById("optionsBar");
  const memoryInputBar = document.getElementById("memoryInputBar");
  const memoryInputEl = document.getElementById("memoryInput");
  const memoryInputSendEl = document.getElementById("memoryInputSend");
  const statusBannerEl = document.getElementById("statusBanner");
  const stopButtonEl = document.getElementById("stopGeneration");
  const hintEl = document.getElementById("mapHint");
  const proofBlackboardEl = document.getElementById("proofBlackboard");
  const dialogueLogEl = document.getElementById("dialogueLog");
  const dialogueLogScrollEl = document.getElementById("dialogueLogScroll");

  function syncProofBlackboard() {
    if (!proofBlackboardEl) {
      return;
    }
    const session = state.talkingId ? getSession(state, state.talkingId) : null;
    const plot = session?.plotSummary || "";
    const show = Boolean(state.talkingId && String(plot).trim());
    if (!show) {
      proofBlackboardEl.classList.add("hidden");
      proofBlackboardEl.classList.remove("proof-blackboard--active");
      const body = document.getElementById("proofBlackboardBody");
      if (body) {
        body.innerHTML = "";
      }
    } else {
      window.GameProofBoard?.updateProofBoard?.(proofBlackboardEl, plot);
    }
    syncDialogueLog();
  }

  function syncDialogueLog() {
    if (!dialogueLogEl || !dialogueLogScrollEl) {
      return;
    }
    if (!state.talkingId) {
      dialogueLogEl.classList.add("hidden");
      dialogueLogScrollEl.innerHTML = "";
      return;
    }
    dialogueLogEl.classList.remove("hidden");
    const session = getSession(state, state.talkingId);
    const character = getCharacter(state.talkingId);
    const archetype = resolveArchetype(getArchetype(character.archetypeId), session);
    const prover = resolveProver(character, session);
    const seed = getSessionSeed(session, archetype);
    const playerLabel = seed?.playerRoleLabel || "证辩者";
    const npcLabel = prover.name || seed?.roleLabel || "证官";
    const messages = [...(session.messages || [])];
    if (state.isStreaming && state.bubbleText) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.status !== "done") {
        messages[messages.length - 1] = {
          ...last,
          content: state.bubbleText,
          status: "streaming",
        };
      } else if (!last || last.role !== "assistant") {
        messages.push({
          id: "streaming-live",
          role: "assistant",
          content: state.bubbleText,
          createdAt: Date.now(),
          status: "streaming",
        });
      }
    }
    window.GameDialogueLog?.render(dialogueLogScrollEl, messages, {
      playerLabel,
      npcLabel,
      emptyText: state.optionsLoading ? "证官准备论题…" : "尚无对白记录",
    });
  }

  const CHAR_BUBBLE_GAP = 36;

  const state = createInitialState();
  state.currentOptions = null;
  state.optionsLoading = false;
  state.dialogueHungUp = false;
  state.episodeAwaitingRestart = false;
  state.playerBubbleText = "";

  let abortController = null;
  let lastFrame = performance.now();
  let highlightId = null;
  let lastInZone = null;

  function isInTalkZoneNow() {
    const ch = state.talkingId ? getCharacter(state.talkingId) : null;
    return ch ? isInTalkZone(state.player, ch) : false;
  }

  /** 挂起按钮或走出橙圈：对话 UI 暂停，等同离圈 */
  function isDialogueSuspended() {
    return Boolean(state.talkingId && (state.dialogueHungUp || !isInTalkZoneNow()));
  }

  function isDialogueUiActive() {
    return Boolean(state.talkingId && isInTalkZoneNow() && !state.dialogueHungUp);
  }

  function bubbleRect(left, top, width, height) {
    return { left, top, right: left + width, bottom: top + height, width, height };
  }

  function rectsOverlap(a, b, pad = 10) {
    return !(
      a.right + pad < b.left ||
      b.right + pad < a.left ||
      a.bottom + pad < b.top ||
      b.bottom + pad < a.top
    );
  }

  function measureBubble(el) {
    const wasVisible = el.classList.contains("visible");
    el.classList.add("visible");
    el.style.visibility = "hidden";
    el.style.left = "-9999px";
    el.style.top = "0";
    const width = el.offsetWidth || 120;
    const height = el.offsetHeight || 40;
    if (!wasVisible) {
      el.classList.remove("visible");
    }
    el.style.visibility = "";
    return { width, height };
  }

  function getUiBlockerTop() {
    let top = window.innerHeight;
    for (const el of [memoryInputBar, optionsBar]) {
      if (!el || el.classList.contains("hidden")) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.top > 0) {
        top = Math.min(top, rect.top);
      }
    }
    return top;
  }

  function clampBubblePosition(left, top, width, height) {
    const margin = 8;
    const vw = window.innerWidth;
    const uiTop = getUiBlockerTop();
    const maxBottom = uiTop - margin;
    let x = left;
    let y = top;
    if (x < margin) {
      x = margin;
    }
    if (x + width > vw - margin) {
      x = vw - width - margin;
    }
    if (y < margin) {
      y = margin;
    }
    if (y + height > maxBottom) {
      y = Math.max(margin, maxBottom - height);
    }
    return { left: x, top: y };
  }

  function bubblePositionCandidates(anchorX, anchorY, size, options) {
    const gap = options?.gap ?? CHAR_BUBBLE_GAP;
    const preferBelow = Boolean(options?.preferBelow);
    const { width, height } = size;
    const half = width / 2;
    const tops = preferBelow
      ? [anchorY + gap, anchorY - gap - height, anchorY + gap + 12]
      : [anchorY - gap - height, anchorY + gap, anchorY - gap - height - 12];
    const xOffsets = [0, -width * 0.35, width * 0.35, -width * 0.55, width * 0.55];
    const list = [];
    for (const top of tops) {
      for (const dx of xOffsets) {
        list.push(clampBubblePosition(anchorX - half + dx, top, width, height));
      }
    }
    return list;
  }

  function pickBubblePosition(el, anchorX, anchorY, options) {
    const size = measureBubble(el);
    const avoid = options?.avoidRects || [];
    const candidates = bubblePositionCandidates(anchorX, anchorY, size, options);
    for (const pos of candidates) {
      const rect = bubbleRect(pos.left, pos.top, size.width, size.height);
      if (!avoid.some((r) => rectsOverlap(rect, r))) {
        return { ...pos, rect };
      }
    }
    const fallback = candidates[0] || clampBubblePosition(anchorX - size.width / 2, anchorY, size.width, size.height);
    return {
      ...fallback,
      rect: bubbleRect(fallback.left, fallback.top, size.width, size.height),
    };
  }

  function applyBubblePosition(el, pos) {
    el.style.left = `${pos.left}px`;
    el.style.top = `${pos.top}px`;
  }

  function syncSpeechBubbles(streaming, options) {
    const thinking = Boolean(options?.thinking);
    const ch = state.talkingId ? getCharacter(state.talkingId) : null;
    const active = isDialogueUiActive();

    bubbleTextEl.textContent =
      state.bubbleText || (streaming && !thinking ? "…" : "");
    playerBubbleTextEl.textContent = state.playerBubbleText || "";

    bubbleEl.classList.toggle("streaming", Boolean(streaming) && !thinking);
    bubbleEl.classList.toggle("thinking", thinking);

    const showNpc =
      Boolean(state.talkingId) &&
      active &&
      (state.bubbleText || (streaming && !thinking));
    const showPlayer =
      Boolean(state.talkingId) && active && Boolean(state.playerBubbleText);

    bubbleEl.classList.toggle("visible", showNpc);
    playerBubbleEl.classList.toggle("visible", showPlayer);

    const suspended = isDialogueSuspended();
    optionsBar.classList.toggle("options-bar--suspended", suspended);
    if (state.talkingId) {
      if (memoryInputEl) {
        memoryInputEl.disabled =
          suspended || state.isStreaming || state.optionsLoading;
      }
      if (memoryInputSendEl) {
        memoryInputSendEl.disabled =
          suspended ||
          state.isStreaming ||
          state.optionsLoading ||
          !state.talkingId;
      }
      if (!state.optionsLoading) {
        setOptionsVisible(shouldShowOptionsBar());
        if (shouldShowOptionsBar()) {
          renderOptionButtons(state.currentOptions, false);
        }
      } else {
        setOptionsVisible(false);
      }
    }

    syncProofBlackboard();

    if (!state.talkingId || !active) {
      return;
    }

    const npcAnchor = worldToCanvas(canvas, ch.x, ch.y);
    const npcScreenX = npcAnchor.rect.left + npcAnchor.x;
    const npcScreenY = npcAnchor.rect.top + npcAnchor.y;

    let npcRect = null;
    if (showNpc) {
      const npcPos = pickBubblePosition(bubbleEl, npcScreenX, npcScreenY, {
        preferBelow: false,
      });
      applyBubblePosition(bubbleEl, npcPos);
      npcRect = npcPos.rect;
    }

    if (showPlayer) {
      const pl = worldToCanvas(canvas, state.player.x, state.player.y);
      const plScreenX = pl.rect.left + pl.x;
      const plScreenY = pl.rect.top + pl.y;
      const playerPos = pickBubblePosition(playerBubbleEl, plScreenX, plScreenY, {
        preferBelow: true,
        gap: 32,
        avoidRects: npcRect ? [npcRect] : [],
      });
      applyBubblePosition(playerBubbleEl, playerPos);
    }
  }

  function setBubble(text, streaming, options) {
    const thinking = Boolean(options?.thinking);
    state.bubbleText = text;
    syncSpeechBubbles(streaming, { thinking });
  }

  function setPlayerBubble(text) {
    state.playerBubbleText = String(text || "").trim();
    syncSpeechBubbles(state.isStreaming, { thinking: false });
  }

  function setStatus(text, isError) {
    state.error = isError ? text : null;
    if (!text) {
      statusBannerEl.classList.remove("visible", "error");
      statusBannerEl.textContent = "";
      return;
    }
    statusBannerEl.textContent = text;
    statusBannerEl.classList.add("visible");
    statusBannerEl.classList.toggle("error", Boolean(isError));
    if (isError) {
      window.PomDebug?.logLocalError("错误", text);
    } else {
      window.PomDebug?.logLocal("提示", text);
    }
  }

  function setOptionsVisible(visible) {
    optionsBar.classList.toggle("hidden", !visible);
  }

  function shouldShowOptionsBar() {
    if (!state.talkingId || !isDialogueUiActive()) {
      return false;
    }
    if (state.optionsLoading) {
      return false;
    }
    const opts = state.currentOptions;
    return Array.isArray(opts) && opts.length > 0;
  }

  function refreshOptionsBar() {
    setOptionsVisible(shouldShowOptionsBar());
    if (shouldShowOptionsBar()) {
      renderOptionButtons(state.currentOptions, false);
    }
  }

  function setMemoryInputVisible(visible) {
    const show = MEMORY_INPUT_ENABLED && visible;
    memoryInputBar?.classList.toggle("hidden", !show);
    if (memoryInputEl) {
      memoryInputEl.disabled = !show;
    }
    if (memoryInputSendEl) {
      memoryInputSendEl.disabled = !show || state.isStreaming;
    }
  }

  function setMemoryInputBusy(busy) {
    if (memoryInputEl) {
      memoryInputEl.disabled = busy || !state.talkingId;
    }
    if (memoryInputSendEl) {
      memoryInputSendEl.disabled = busy || !state.talkingId;
    }
  }

  const INTENT_ARIA = {
    advance: "推证",
    decoy: "推证",
    clarify: "题意",
    explore: "证法",
    premise: "前提",
    keypoint: "推证",
    followup: "了解",
    close: "结束对话",
    continue: "继续补论",
    reargue: "重证论题",
  };

  function placeholderProofOptions() {
    return (window.GameProofIntents?.PROOF_OPTION_SPECS || []).map((spec) => ({
      ...spec,
      line: "",
      send: "",
    }));
  }

  function renderOptionButtons(options, loading) {
    const disabled = loading || state.isStreaming || isDialogueSuspended();
    optionsBar.classList.toggle("is-loading", loading);
    for (const btn of optionsBar.querySelectorAll(".option-btn")) {
      const id = Number(btn.dataset.optionId);
      const opt = options?.find((o) => o.id === id);
      const lineEl = btn.querySelector(".option-line");
      const lineText = loading ? "生成中…" : opt?.line || "";
      if (lineEl) {
        lineEl.textContent = lineText;
      }
      if (opt?.intent) {
        const kind =
          window.GameProofIntents?.ariaLabel?.(opt.intent) ||
          INTENT_ARIA[opt.intent] ||
          "";
        btn.setAttribute(
          "aria-label",
          kind && lineText !== "生成中…" && lineText !== "—"
            ? `${kind}：${lineText}`
            : lineText
        );
        btn.dataset.intent = opt.intent;
      }
      btn.classList.toggle(
        "option-btn--advance",
        window.GameProofIntents?.isProofStepIntent?.(opt?.intent) ||
          opt?.intent === "keypoint"
      );
      btn.classList.toggle("option-btn--close", opt?.intent === "close");
      btn.classList.toggle(
        "option-btn--ending-extra",
        opt?.intent === "continue" || opt?.intent === "reargue"
      );
      btn.disabled = disabled || !opt?.line || loading;
      btn.classList.toggle("hidden", !opt);
    }
    optionsBar.classList.toggle(
      "options-bar--ending",
      options?.some((o) => ["continue", "reargue"].includes(o?.intent))
    );
  }

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    syncSpeechBubbles(false);
    renderMap();
  }

  function renderMap() {
    const near = characters.find((c) => isNearPlayer(state.player, c));
    highlightId = near?.id || null;
    draw(ctx, canvas, {
      player: state.player,
      characters,
      talkingId: state.talkingId,
      highlightId,
      highlightDocId: null,
    });
    if (state.talkingId) {
      hintEl.textContent = "";
      hintEl.classList.add("map-hint--hidden");
    } else {
      hintEl.classList.remove("map-hint--hidden");
      hintEl.textContent = near
        ? `点击「${near.name}」交谈`
        : "点击空地移动 · 靠近证官";
    }
  }

  function endTalking() {
    if (state.talkingId) {
      const session = getSession(state, state.talkingId);
      session.messages = [];
      session.plotSummary = "";
      session.lastSummaryAtOptionTurn = 0;
      session.endingOffered = false;
      session.inEndingCloseChoices = false;
      resetSessionProgressFlags(session);
      window.GameProofPool?.clearSessionProof?.(session);
      persist(state);
    }
    state.talkingId = null;
    state.currentOptions = null;
    state.optionsLoading = false;
    state.dialogueHungUp = false;
    state.episodeAwaitingRestart = false;
    state.playerBubbleText = "";
    state.bubbleText = "";
    setBubble("");
    setOptionsVisible(false);
    setMemoryInputVisible(false);
    if (memoryInputEl) {
      memoryInputEl.value = "";
    }
    stopButtonEl.disabled = true;
    syncProofBlackboard();
    renderMap();
    window.PomDebug?.logLocal("结束对话");
  }

  function ensureApiConfig() {
    const status = window.PomConfig?.getConfigStatus?.();
    if (status && !status.ok) {
      if (status.reason === "login") {
        window.PomAuth?.showGate?.();
        setStatus("", false);
      } else {
        setStatus(status.message, true);
      }
      return false;
    }
    return true;
  }

  function ensureOnionSeedPlotSummary(session, archetype) {
    if (String(session.plotSummary || "").trim()) {
      return false;
    }
    window.GameProofPool?.initSession?.(session, archetype);
    const seed = getSessionSeed(session, archetype);
    if (!seed || !window.GameOnion?.buildSeedPlotSummary) {
      return false;
    }
    session.plotSummary = window.GameOnion.buildSeedPlotSummary(seed);
    return true;
  }

  async function startTalking(characterId) {
    const character = getCharacter(characterId);
    const archetype = getArchetype(character.archetypeId);
    if (!character || !archetype) {
      return;
    }
    if (!isNearPlayer(state.player, character)) {
      setStatus("再靠近一点才能交谈。", false);
      return;
    }

    state.talkingId = characterId;
    state.playerBubbleText = "";
    state.dialogueHungUp = false;
    const session = getSession(state, characterId);
    window.GameProofPool?.initSession?.(session, archetype);
    const liveArchetype = resolveArchetype(archetype, session);
    const prover = resolveProver(character, session);
    if (!Array.isArray(session.spentPlayerKnowledge)) {
      session.spentPlayerKnowledge = [];
    }
    if (!Array.isArray(session.playerEvidence)) {
      session.playerEvidence = [];
    }
    if (typeof session.keypointTurnCount !== "number") {
      session.keypointTurnCount = 0;
    }

    setOptionsVisible(false);
    setMemoryInputVisible(true);
    stopButtonEl.disabled = true;
    renderMap();
    syncSpeechBubbles(false);

    const needsBootstrap =
      session.messages.length === 0 && !session.proofBundle?.bootstrapped;

    if (needsBootstrap) {
      if (!ensureApiConfig()) {
        state.talkingId = null;
        setOptionsVisible(false);
        return;
      }
      state.optionsLoading = true;
      state.currentOptions = null;
      setOptionsVisible(false);
      setStatus("证官准备论题…", false);
      setBubble("", false);

      try {
        const proverForBoot = resolveProver(character, session);
        const liveArchetypeForBoot = resolveArchetype(archetype, session);
        const boot = await window.GameProofBootstrap.bootstrapProofSession({
          session,
          blueprint: session.proofBundle,
          signal: undefined,
          character: proverForBoot,
          archetype: liveArchetypeForBoot,
        });
        persist(state);
        setBubble(boot.opening, false);
        state.currentOptions = boot.options;
        const goal = window.GameOnion?.extractGoal?.(session.plotSummary) || "";
        window.PomDebug?.logLocal(
          "开局·流程完成",
          `${window.GameOnion.formatLayersDebug(session.plotSummary, boot.seed)}${goal ? `\n论题：${goal}` : ""}`,
          ["summary-out", "bootstrap"]
        );
      } catch (e) {
        window.PomDebug?.logLocalError("开局生成失败", e.message || String(e));
        setStatus(e.message || "开局生成失败，请重试", true);
        endTalking();
        return;
      } finally {
        state.optionsLoading = false;
      }
    } else {
      const openingLine =
        window.GameProofPool?.getSessionOpening?.(session, archetype) ||
        liveArchetype.opening;
      const last = [...session.messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.status === "done");
      setBubble(last?.content || openingLine, false);
      state.currentOptions =
        session.proofBundle?.options?.length >= 3
          ? session.proofBundle.options
          : presetOptions(liveArchetype);
    }

    setStatus("", false);
    window.PomDebug?.logUser("开始对话", {
      character: prover.name,
      problem: session.proofBundle?.problemId || "preset",
      bootstrapped: Boolean(session.proofBundle?.bootstrapped),
      messageCount: session.messages.length,
    });

    refreshOptionsBar();
    syncProofBlackboard();
  }

  function resumeDialogueUi(reason) {
    if (!state.talkingId || state.isStreaming) {
      return;
    }
    if (!isInTalkZoneNow()) {
      return;
    }
    if (state.episodeAwaitingRestart) {
      state.episodeAwaitingRestart = false;
      state.dialogueHungUp = false;
      startTalking(state.talkingId);
      return;
    }
    state.dialogueHungUp = false;
    setMemoryInputVisible(true);
    refreshOptionsBar();
    setStatus("", false);
    window.PomDebug?.logUser("恢复对话 UI", reason || "回到橙圈内");
    renderMap();
    syncSpeechBubbles(false);
  }

  async function finishEpisodeAfterClose() {
    const characterId = state.talkingId;
    if (characterId) {
      const session = getSession(state, characterId);
      session.messages = [];
      session.plotSummary = "";
      session.lastSummaryAtOptionTurn = 0;
      resetSessionProgressFlags(session);
      persist(state);
    }
    state.currentOptions = null;
    state.optionsLoading = false;
    state.playerBubbleText = "";
    stopButtonEl.disabled = true;
    window.PomDebug?.logLocal(
      "本局结局结束",
      "自动从池中抽取下一题",
      ["ui"]
    );
    if (characterId && isNearPlayer(state.player, getCharacter(characterId))) {
      setStatus("论证闭合，抽取下一题…", false);
      state.episodeAwaitingRestart = false;
      state.dialogueHungUp = false;
      renderMap();
      syncSpeechBubbles(false);
      await startTalking(characterId);
      return;
    }
    state.episodeAwaitingRestart = true;
    state.dialogueHungUp = true;
    setOptionsVisible(false);
    setMemoryInputVisible(false);
    setStatus("本局已结束。靠近证官可继续下一题。", false);
    renderMap();
    syncSpeechBubbles(false);
  }

  async function finishEpisodeAfterFailure() {
    const characterId = state.talkingId;
    if (characterId) {
      const session = getSession(state, characterId);
      session.messages = [];
      session.plotSummary = "";
      session.lastSummaryAtOptionTurn = 0;
      resetSessionProgressFlags(session);
      persist(state);
    }
    state.currentOptions = null;
    state.optionsLoading = false;
    state.playerBubbleText = "";
    stopButtonEl.disabled = true;
    window.PomDebug?.logLocal(
      "本局失败",
      "自动从池中抽取下一题",
      ["ui"]
    );
    if (characterId && isNearPlayer(state.player, getCharacter(characterId))) {
      setStatus("本局未证毕，抽取下一题…", false);
      state.episodeAwaitingRestart = false;
      state.dialogueHungUp = false;
      renderMap();
      syncSpeechBubbles(false);
      await startTalking(characterId);
      return;
    }
    state.episodeAwaitingRestart = true;
    state.dialogueHungUp = true;
    setOptionsVisible(false);
    setMemoryInputVisible(false);
    setStatus("本局失败。靠近证官可继续下一题。", false);
    renderMap();
    syncSpeechBubbles(false);
  }

  function resetSessionProgressFlags(session) {
    session.stallTurns = 0;
    session.lastConfirmedCount = 0;
    session.neglectPrimaryRounds = 0;
    session.endingOffered = false;
    session.inEndingCloseChoices = false;
    session.endingContinued = false;
    session.emptyPromiseCount = 0;
    session.spentPlayerKnowledge = [];
    session.playerEvidence = [];
    session.lastEvidenceGrantKey = "";
    session.inquireLineIndex = 0;
    session.lastPickIntent = "";
    session.keypointTurnCount = 0;
    window.GameProofPool?.clearSessionProof?.(session);
  }

  async function restartProofOnSameTopic(character, archetype, session) {
    const bundle = session.proofBundle || {};
    const keptBlueprint = {
      problemId: bundle.problemId,
      theorem: bundle.theorem,
      mathematician: bundle.mathematician,
      proverName: bundle.proverName,
      displayTitle: bundle.displayTitle,
      system: bundle.system,
      topicHint: bundle.topicHint,
      failureLine: bundle.failureLine,
      closeOptionLines: bundle.closeOptionLines,
    };
    session.messages = [];
    session.plotSummary = "";
    session.lastSummaryAtOptionTurn = 0;
    resetSessionProgressFlags(session);
    session.proofBundle = { ...keptBlueprint, bootstrapped: false };
    session.proverDisplayName = keptBlueprint.proverName;
    persist(state);

    if (!ensureApiConfig()) {
      return;
    }
    state.isStreaming = true;
    state.optionsLoading = true;
    state.currentOptions = null;
    setOptionsVisible(false);
    setStatus("同一论题重开论证…", false);
    setBubble("", false);

    try {
      const prover = resolveProver(character, session);
      const liveArchetype = resolveArchetype(archetype, session);
      const boot = await window.GameProofBootstrap.bootstrapProofSession({
        session,
        blueprint: session.proofBundle,
        signal: undefined,
        character: prover,
        archetype: liveArchetype,
      });
      persist(state);
      setBubble(boot.opening, false);
      state.currentOptions = boot.options;
      window.PomDebug?.logLocal("重证·开局完成", keptBlueprint.theorem || keptBlueprint.problemId, [
        "bootstrap",
      ]);
    } catch (e) {
      window.PomDebug?.logLocalError("重证开局失败", e.message || String(e));
      setStatus(e.message || "重证失败，请再试", true);
      endTalking();
      return;
    } finally {
      state.isStreaming = false;
      state.optionsLoading = false;
      refreshOptionsBar();
      setStatus("", false);
      renderMap();
      syncSpeechBubbles(false);
    }
  }

  function handleSuspendOption() {
    /** 第三钮：挂起，等同走出检测圈；不写入 session、不告知 AI */
    state.dialogueHungUp = true;
    state.playerBubbleText = "";
    window.PomDebug?.logUser("挂起对话", {
      note: "等同离圈：隐藏气泡、禁用选项；不写入 session、不调用 AI",
    });
    renderMap();
    syncSpeechBubbles(false);
  }

  async function sendFreeformMemoryQuestion() {
    if (!state.talkingId || state.isStreaming || state.optionsLoading) {
      return;
    }
    if (!isDialogueUiActive()) {
      setStatus("回到橙圈内再继续输入。", false);
      return;
    }
    if (!ensureApiConfig()) {
      return;
    }

    const text = memoryInputEl?.value?.trim();
    if (!text) {
      setStatus("请先输入要问的话", false);
      return;
    }

    const session = getSession(state, state.talkingId);
    const apiMessages = [{ role: "user", content: text }];

    window.PomDebug?.logUser("输入框原文", text);

    session.messages.push({
      id: createId(),
      role: "user",
      content: text,
      intent: "freeform",
      createdAt: Date.now(),
      status: "done",
    });
    persist(state);
    setPlayerBubble(text);

    state.isStreaming = true;
    setMemoryInputBusy(true);
    setOptionsVisible(false);
    stopButtonEl.disabled = false;
    setBubble("", true);
    setStatus("等待回复…", false);
    renderMap();

    abortController = new AbortController();
    let reply = "";

    try {
      await window.ChatApi.streamChat({
        messages: apiMessages,
        messagesOnly: true,
        temperature: 0.5,
        max_tokens: window.PomTokens?.FREEFORM ?? 512,
        signal: abortController.signal,
        debugLabel: "输入框→AI",
        onDelta(chunk) {
          reply += chunk;
          setBubble(reply, true);
        },
      });

      reply = reply.trim() || "……";
      session.messages.push({
        id: createId(),
        role: "assistant",
        content: reply,
        createdAt: Date.now(),
        status: "done",
      });
      persist(state);
      setBubble(reply, false);
      setStatus("", false);
      window.PomDebug?.logLocal(
        "本地会话（未发给 AI，仅备忘）",
        window.GameMemoryChat.formatLocalTranscript(session.messages)
      );
      if (memoryInputEl) {
        memoryInputEl.value = "";
      }
    } catch (error) {
      if (error.name === "AbortError") {
        window.PomDebug?.logLocal("已停止生成");
      } else {
        session.messages.pop();
        persist(state);
        setStatus(error.message || "发送失败", true);
        const prev = [...session.messages]
          .reverse()
          .find((m) => m.role === "assistant" && m.status === "done");
        setBubble(prev?.content || "", false);
      }
    } finally {
      state.isStreaming = false;
      setMemoryInputBusy(false);
      abortController = null;
      stopButtonEl.disabled = true;
      if (state.talkingId) {
        refreshOptionsBar();
      }
      renderMap();
      syncSpeechBubbles(false);
    }
  }

  async function pickOption(optionId) {
    if (!state.talkingId || state.isStreaming || state.optionsLoading) {
      return;
    }
    if (!isDialogueUiActive()) {
      setStatus("回到橙圈内再选选项。", false);
      return;
    }
    if (!ensureApiConfig()) {
      return;
    }

    const pick = state.currentOptions?.find((o) => o.id === optionId);
    if (!pick?.line) {
      setStatus("选项尚未就绪", true);
      return;
    }

    const session = getSession(state, state.talkingId);
    const optionsSnapshot = state.currentOptions.map((o) => ({ ...o }));
    const character = resolveProver(getCharacter(state.talkingId), session);
    const archetype = resolveArchetype(getArchetype(character.archetypeId), session);
    const seed = getSessionSeed(session, archetype);

    if (session.inEndingCloseChoices && pick.intent === "continue") {
      window.PomDebug?.logUser("证辩者选择", {
        intent: "continue",
        line: pick.line,
        phase: "结局·继续补论",
      });
      session.inEndingCloseChoices = false;
      session.endingContinued = true;
      session.messages.push({
        id: createId(),
        role: "user",
        content: pick.line,
        intent: pick.intent,
        createdAt: Date.now(),
        status: "done",
      });
      persist(state);
      setPlayerBubble(pick.line);
      setStatus("论题已证毕，可继续补论；靠近证官选推证或输入框发言。", false);
      state.currentOptions = null;
      refreshOptionsBar();
      return;
    }

    if (session.inEndingCloseChoices && pick.intent === "reargue") {
      window.PomDebug?.logUser("证辩者选择", {
        intent: "reargue",
        line: pick.line,
        phase: "结局·重证",
      });
      session.messages.push({
        id: createId(),
        role: "user",
        content: pick.line,
        intent: pick.intent,
        createdAt: Date.now(),
        status: "done",
      });
      persist(state);
      setPlayerBubble(pick.line);
      await restartProofOnSameTopic(character, archetype, session);
      return;
    }

    if (pick.intent === "suspend") {
      return;
    }

    const plotBefore = session.plotSummary;
    const rawLine = pick.line;
    const apiLine =
      window.GameOnion?.normalizePlayerLineForApi?.(rawLine) || rawLine;
    const redundantOffer = Boolean(
      window.GameOnion?.detectRedundantPlayerOffer?.(apiLine, plotBefore)
    );
    const playerNamesMastermind = Boolean(
      window.GameOnion?.detectPlayerNamesMastermind?.(apiLine)
    );
    const playerConcreteReveal = Boolean(
      window.GameOnion?.isPlayerLineConcrete?.(apiLine, seed, session)
    );
    const hollowTradeOffer = Boolean(
      window.GameOnion?.detectHollowTradeOffer?.(apiLine, seed)
    );
    const tradeOfferNeedsPlayerFirst = Boolean(
      window.GameOnion?.detectTradeOfferNeedsPlayerFirst?.(apiLine, seed)
    );
    const emptyPromiseCount = window.GameOnion?.trackEmptyPromise?.(
      session,
      apiLine,
      seed,
      pick.intent
    );
    const emptyPromiseBankrupt = Boolean(
      window.GameOnion?.isEmptyPromiseBankrupt?.(session)
    );
    const neglectBefore =
      window.GameOnion?.bumpNeglectBeforeReply?.(
        session,
        apiLine,
        plotBefore,
        seed,
        pick.intent
      ) || { shouldWarn: false, shouldFail: false };

    session.lastPickIntent = pick.intent;
    if (window.GameProofIntents?.isInquireIntent?.(pick.intent)) {
      window.GameOnion?.advanceInquireIndex?.(session);
    }

    const wrongProofPick = Boolean(
      window.GameProofIntents?.isDecoyIntent?.(pick.intent) || pick.isCorrect === false
    );

    window.PomDebug?.logUser("证辩者选择", {
      intent: pick.intent,
      line: rawLine,
      apiLine: apiLine !== rawLine ? apiLine : undefined,
      redundantOffer,
      hollowTradeOffer,
      playerConcreteReveal,
      emptyPromiseCount,
      neglectRounds: neglectBefore.neglectPrimaryRounds,
    });

    session.messages.push({
      id: createId(),
      role: "user",
      content: apiLine,
      intent: pick.intent,
      createdAt: Date.now(),
      status: "done",
    });
    if (window.GameProofIntents?.isAdvanceIntent?.(pick.intent)) {
      window.GameOnion?.markKnowledgeSpent?.(session, apiLine, seed);
    }
    persist(state);
    setPlayerBubble(rawLine);

    const apiMessages = getHistoryForApi(session.messages);

    if (neglectBefore.shouldFail && !session.endingOffered) {
      state.isStreaming = true;
      state.optionsLoading = true;
      setMemoryInputBusy(true);
      setOptionsVisible(false);
      stopButtonEl.disabled = false;
      setBubble(
        [...session.messages]
          .reverse()
          .find((m) => m.role === "assistant" && m.status === "done")?.content || "",
        true,
        { thinking: true }
      );
      setStatus("证官休庭收束…", false);
      abortController = new AbortController();
      try {
        const fail = await requestFailureSequence({
          character,
          archetype,
          session,
          apiMessages,
          signal: abortController.signal,
        });
        session.messages.push({
          id: createId(),
          role: "assistant",
          content: fail.reply,
          createdAt: Date.now(),
          status: "done",
        });
        persist(state);
        setBubble(fail.reply, false, { thinking: false });
        await finishEpisodeAfterFailure();
      } catch (e) {
        if (e.name !== "AbortError") {
          setStatus(e.message || "生成失败", true);
        }
      } finally {
        state.isStreaming = false;
        state.optionsLoading = false;
        setMemoryInputBusy(false);
        abortController = null;
        stopButtonEl.disabled = true;
        renderMap();
        syncSpeechBubbles(false);
      }
      return;
    }

    state.isStreaming = true;
    state.optionsLoading = true;
    setMemoryInputBusy(true);
    setOptionsVisible(false);
    stopButtonEl.disabled = false;
    const thinkingBubble =
      [...session.messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.status === "done")?.content || "";
    setBubble(thinkingBubble, true, { thinking: true });
    setStatus("证官推导中…", false);
    renderMap();

    abortController = new AbortController();

    const signal = abortController.signal;
    const onionExtra = {
      redundantOffer,
      playerNamesMastermind,
      neglectWarn: neglectBefore.shouldWarn,
      hollowTradeOffer,
      tradeOfferNeedsPlayerFirst,
      playerConcreteReveal,
      playerLine: apiLine,
      emptyPromiseBankrupt,
      emptyPromiseCount,
      wrongProofPick,
      recordMethodHint:
        wrongProofPick || (session.stallTurns ?? 0) >= 2,
    };

    const willSummary = window.GameSummary?.willRefreshPlotSummaryThisPick?.(session);
    const seedForTurn = getSessionSeed(session, archetype);

    const apiSteps = willSummary
      ? ["①reply", "②选项", "③摘要"]
      : ["①reply", "②选项"];
    window.PomDebug?.logLocal(
      "API 路径",
      `串行 · ${apiSteps.join(" → ")}${willSummary ? "（③在 assistant 写入后）" : ""}`,
      ["ui"]
    );

    try {
      let reply;
      let options;

      const turn = await requestCombinedTurn({
        character,
        archetype,
        session,
        apiMessages,
        turn: {
          character,
          options: optionsSnapshot,
          pick,
          isClose: false,
          onionExtra,
        },
        isClose: false,
        signal,
      });
      reply = turn.reply;
      options = turn.options;

      session.messages.push({
        id: createId(),
        role: "assistant",
        content: reply,
        createdAt: Date.now(),
        status: "done",
      });
      persist(state);
      setBubble(reply, false, { thinking: false });
      setStatus("", false);

      state.currentOptions = options;

      if (willSummary) {
        try {
          const summaryOk = await window.GameSummary.maybeRefreshPlotSummary(
            session,
            signal,
            seedForTurn,
            {
              wrongProofPick,
              stallTurns: session.stallTurns ?? 0,
            }
          );
          if (summaryOk) {
            persist(state);
            const pendingAfter =
              window.GameOnion?.extractPendingLines?.(session.plotSummary) || [];
            const lemmaDone = window.GameOnion?.isLemmaStackComplete?.(
              session.plotSummary,
              seedForTurn
            );
            if (!pendingAfter.length) {
              state.currentOptions = null;
              window.PomDebug?.logLocal(
                "选项清空",
                lemmaDone ? "引理栈已证毕，等待结局判定" : "摘要后无开放引理",
                ["options-skip"]
              );
            } else if (
              pendingAfter.length &&
              (!state.currentOptions || !state.currentOptions.length)
            ) {
              try {
                const regen = await window.GameOptionsAi?.generateOptions?.({
                  character,
                  archetype,
                  session,
                  signal,
                  plotSummary: session.plotSummary,
                  onionContext: {
                    ...onionExtra,
                    stallTurns: session.stallTurns ?? 0,
                    plotSummary: session.plotSummary,
                    session,
                    seed: seedForTurn,
                  },
                  logTag: "拆分·②选项·摘要后补发",
                });
                if (regen?.length) {
                  state.currentOptions = regen;
                  window.PomDebug?.logLocal(
                    "选项补发",
                    `摘要后挂出 ${pendingAfter.length} 条待证`,
                    ["options-regen"]
                  );
                }
              } catch (e) {
                if (e.name !== "AbortError") {
                  window.PomDebug?.logLocalWarn("选项补发失败", e.message, [
                    "options-regen",
                  ]);
                }
              }
            }
          }
        } catch (e) {
          if (e.name !== "AbortError") {
            window.PomDebug?.logLocalWarn("证明席摘要失败", e.message, ["summary"]);
          }
        }
      }

      if (window.GameProofIntents?.isAdvanceIntent?.(pick.intent)) {
        session.keypointTurnCount = (session.keypointTurnCount || 0) + 1;
      }

      if (
        !session.endingOffered &&
        !session.inEndingCloseChoices &&
        window.GameOnion?.isReadyForEnding?.(
          session.plotSummary,
          seed,
          session
        )
      ) {
        session.endingOffered = true;
        const ending = await requestEndingSequence({
          character,
          archetype,
          session,
          apiMessages: getHistoryForApi(session.messages),
          signal,
        });
        session.messages.push({
          id: createId(),
          role: "assistant",
          content: ending.reply,
          createdAt: Date.now(),
          status: "done",
        });
        persist(state);
        setBubble(`${reply}\n\n${ending.reply}`, false, { thinking: false });
        state.currentOptions = ending.options;
        session.inEndingCloseChoices = true;
        setStatus("目标已达成，选继续补论或重证论题。", false);
      }

      const stall = window.GameOnion?.updateStallCounters?.(session, session.plotSummary);
      if (stall && stall.stallTurns >= 2) {
        window.PomDebug?.logLocalWarn(
          "论证·僵局",
          `连续 ${stall.stallTurns} 轮 [已证] 无增加 · 下轮 reply/选项已加强让步与破局提示`,
          ["summary"]
        );
      }
      if (
        stall &&
        stall.stallTurns >= 3 &&
        !session.endingOffered &&
        !session.inEndingCloseChoices
      ) {
        const forcedReply =
          window.GameOnion?.buildStallForceReply?.(session.plotSummary) ||
          "最终推理：前提已足，依否后律得证。论证结束。";
        session.plotSummary =
          window.GameOnion?.applyStallForceQedToArchive?.(
            session.plotSummary,
            seedForTurn
          ) || session.plotSummary;
        const minKp =
          Number(seedForTurn?.endingMinKeypointTurns) > 0
            ? seedForTurn.endingMinKeypointTurns
            : 2;
        session.keypointTurnCount = Math.max(
          session.keypointTurnCount || 0,
          minKp
        );
        session.stallTurns = 0;
        session.messages.push({
          id: createId(),
          role: "assistant",
          content: forcedReply,
          createdAt: Date.now(),
          status: "done",
        });
        persist(state);
        setBubble(`${reply}\n\n${forcedReply}`, false, { thinking: false });
        state.currentOptions = null;
        window.PomDebug?.logLocal(
          "论证·僵局终局",
          "连续无进展达阈值，已强制证毕并收束选项",
          ["summary", "stall-force"]
        );
        if (
          window.GameOnion?.isReadyForEnding?.(
            session.plotSummary,
            seedForTurn,
            session
          )
        ) {
          session.endingOffered = true;
          const ending = await requestEndingSequence({
            character,
            archetype,
            session,
            apiMessages: getHistoryForApi(session.messages),
            signal,
          });
          session.messages.push({
            id: createId(),
            role: "assistant",
            content: ending.reply,
            createdAt: Date.now(),
            status: "done",
          });
          persist(state);
          setBubble(`${reply}\n\n${forcedReply}\n\n${ending.reply}`, false, {
            thinking: false,
          });
          state.currentOptions = ending.options;
          session.inEndingCloseChoices = true;
          setStatus("僵局破局后论证闭合，选继续补论或重证论题。", false);
        }
      }
      const neglect = window.GameOnion?.resetNeglectAfterPlotProgress?.(
        session,
        plotBefore,
        session.plotSummary,
        apiLine,
        seed
      );
      if (neglect?.shouldWarn) {
        window.PomDebug?.logLocalWarn(
          "论证·回避 Lk",
          `已连续 ${neglect.neglectPrimaryRounds} 轮未推进待证 Lk · 下轮加压`,
          ["summary"]
        );
      }
      if (redundantOffer) {
        window.PomDebug?.logLocalWarn(
          "信息价值",
          "证辩者复读【已证】前提报价 · reply 应拒绝交换",
          ["summary"]
        );
      }
      if (emptyPromiseBankrupt) {
        window.PomDebug?.logLocalWarn(
          "交易·信用破产",
          `空头承诺 ${emptyPromiseCount} 次`,
          ["summary"]
        );
      } else if (hollowTradeOffer) {
        window.PomDebug?.logLocalWarn(
          "交换·未出示引理",
          "证辩者空头交换 · reply 须拒先给推导步",
          ["summary"]
        );
      }
    } catch (error) {
      if (error.name === "AbortError") {
        window.PomDebug?.logLocal("已停止生成");
      } else {
        session.messages.pop();
        persist(state);
        setStatus(error.message || "生成失败", true);
        const prev = [...session.messages]
          .reverse()
          .find((m) => m.role === "assistant" && m.status === "done");
        setBubble(prev?.content || "", false, { thinking: false });
        setStatus("", false);
      }
    } finally {
      state.isStreaming = false;
      state.optionsLoading = false;
      setMemoryInputBusy(false);
      abortController = null;
      stopButtonEl.disabled = true;
      if (state.talkingId) {
        refreshOptionsBar();
      }
      renderMap();
      syncSpeechBubbles(false);
    }
  }

  function clampWorldToMap(point) {
    return {
      x: Math.max(0.05, Math.min(0.95, point.x)),
      y: Math.max(0.05, Math.min(0.95, point.y)),
    };
  }

  function handleMapClick(clientX, clientY) {
    if (state.isStreaming) {
      return;
    }

    const world = canvasToWorld(canvas, clientX, clientY);
    const hit = hitCharacter(characters, world, HIT_CHARACTER_RADIUS);

    if (state.talkingId) {
      const talking = getCharacter(state.talkingId);
      if (hit?.id === state.talkingId) {
        window.PomDebug?.logUser("地图点击", {
          action: "点角色",
          character: talking?.name,
          hungUp: state.dialogueHungUp,
        });
        if (state.dialogueHungUp && isInTalkZoneNow()) {
          if (state.episodeAwaitingRestart) {
            state.episodeAwaitingRestart = false;
            state.dialogueHungUp = false;
            startTalking(hit.id);
          } else {
            resumeDialogueUi("点击角色");
          }
        }
        return;
      }
      if (hit && hit.id !== state.talkingId) {
        return;
      }
      const target = clampWorldToMap(world);
      state.moveTarget = target;
      window.PomDebug?.logUser("地图点击", {
        action: "对话中移动",
        target,
        inZone: talking ? isInTalkZone(target, talking) : false,
      });
      setStatus("", false);
      persist(state);
      renderMap();
      return;
    }

    if (hit && isNearPlayer(state.player, hit)) {
      window.PomDebug?.logUser("地图点击", { action: "开始交谈", character: hit.name });
      startTalking(hit.id);
      return;
    }

    if (hit && !isNearPlayer(state.player, hit)) {
      state.moveTarget = { x: hit.x, y: hit.y - INTERACT_RADIUS * 0.85 };
      window.PomDebug?.logUser("地图点击", {
        action: "靠近角色",
        character: hit.name,
        moveTarget: state.moveTarget,
      });
      setStatus(`靠近「${hit.name}」后再点击`, false);
      return;
    }

    const target = clampWorldToMap(world);
    state.moveTarget = target;
    window.PomDebug?.logUser("地图点击", { action: "移动", target });
    setStatus("", false);
  }

  function gameLoop(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;

    if (state.moveTarget) {
      state.player = tickMove(state.player, state.moveTarget, dt);
      if (
        Math.hypot(
          state.player.x - state.moveTarget.x,
          state.player.y - state.moveTarget.y
        ) < 0.004
      ) {
        state.moveTarget = null;
        persist(state);
      } else {
        persist(state);
      }
      renderMap();
      if (state.talkingId) {
        syncSpeechBubbles(state.isStreaming, {
          thinking: state.isStreaming && state.optionsLoading,
        });
      }
    } else if (state.talkingId) {
      syncSpeechBubbles(state.isStreaming, {
        thinking: state.isStreaming && state.optionsLoading,
      });
    }

    if (state.talkingId) {
      const ch = getCharacter(state.talkingId);
      if (ch) {
        const inZone = isInTalkZone(state.player, ch);
        if (lastInZone !== null && lastInZone !== inZone) {
          window.PomDebug?.logUser(inZone ? "进入对话圈" : "离开对话圈", {
            character: ch.name,
            distance: window.GameMap.dist(state.player, ch).toFixed(3),
          });
          if (inZone && state.dialogueHungUp && !state.episodeAwaitingRestart) {
            resumeDialogueUi("走进橙圈");
          }
        }
        lastInZone = inZone;
      }
    } else {
      lastInZone = null;
    }

    requestAnimationFrame(gameLoop);
  }

  canvas.addEventListener("click", (e) => handleMapClick(e.clientX, e.clientY));
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) {
        return;
      }
      e.preventDefault();
      const t = e.touches[0];
      handleMapClick(t.clientX, t.clientY);
    },
    { passive: false }
  );

  optionsBar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-option-id]");
    if (btn) {
      pickOption(Number(btn.dataset.optionId));
    }
  });

  stopButtonEl.addEventListener("click", () => {
    abortController?.abort();
    window.PomDebug?.logLocal("停止生成");
  });

  document.getElementById("copyTurnDebugBtn")?.addEventListener("click", () => {
    window.PomDebug?.copyCurrentTurn?.();
  });
  document.getElementById("copyDebugBtn")?.addEventListener("click", () => {
    window.PomDebug?.copyAll();
  });
  document.getElementById("clearDebugBtn")?.addEventListener("click", () => {
    window.PomDebug?.clear();
  });
  memoryInputSendEl?.addEventListener("click", () => {
    sendFreeformMemoryQuestion();
  });
  memoryInputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendFreeformMemoryQuestion();
    }
  });
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("scroll", () => syncSpeechBubbles(state.isStreaming), true);

  function refreshAuthStatus() {
    const status = window.PomConfig?.getConfigStatus?.();
    if (status && !status.ok && status.reason === "login") {
      window.PomAuth?.showGate?.();
      setStatus("", false);
    } else if (status && !status.ok) {
      setStatus(status.message, true);
    } else {
      setStatus("", false);
    }
  }

  document.addEventListener("pom-auth-login", refreshAuthStatus);
  document.addEventListener("pom-auth-logout", refreshAuthStatus);

  resizeCanvas();
  setOptionsVisible(false);
  setMemoryInputVisible(false);
  setBubble("");
  refreshAuthStatus();
  const ver = window.POM_VERSION || "?";
  window.PomDebug?.logLocal(`Points-of-mess v${ver} 已加载（调试分色=内联样式）`);
  if (!window.GameState.PERSIST_SESSIONS) {
    window.PomDebug?.logLocal(
      "调试说明",
      "打印选择=过滤面板+复制。黄/绿=①②③ API。开局注入证明席种子摘要。详见 docs/DEBUG-API-SPLIT.md",
      ["ui"]
    );
  }
  requestAnimationFrame(gameLoop);
})();
