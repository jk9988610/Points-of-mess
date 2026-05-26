(function () {
  const { characters, getArchetype, getCharacter } = window.GamePresets;
  const { createId, createInitialState, getSession, persist } = window.GameState;
  const { buildGameUserMessage, getHistoryForApi } = window.GameDialogue;
  const { presetOptions, requestCombinedTurn } = window.GameOptionsAi;
  const {
    draw,
    tickMove,
    canvasToWorld,
    worldToCanvas,
    hitCharacter,
    isNearPlayer,
    INTERACT_RADIUS,
  } = window.GameMap;

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const bubbleEl = document.getElementById("speechBubble");
  const bubbleTextEl = document.getElementById("speechBubbleText");
  const optionsBar = document.getElementById("optionsBar");
  const statusBannerEl = document.getElementById("statusBanner");
  const stopButtonEl = document.getElementById("stopGeneration");
  const hintEl = document.getElementById("mapHint");
  const configSetupEl = document.getElementById("configSetup");

  const CHAR_BUBBLE_GAP = 36;

  const state = createInitialState();
  state.currentOptions = null;
  state.optionsLoading = false;

  let abortController = null;
  let lastFrame = performance.now();
  let highlightId = null;

  function setBubble(text, streaming, options) {
    const thinking = Boolean(options?.thinking);
    state.bubbleText = text;
    bubbleTextEl.textContent = text || (streaming && !thinking ? "…" : "");
    bubbleEl.classList.toggle("visible", Boolean(state.talkingId));
    bubbleEl.classList.toggle("streaming", Boolean(streaming) && !thinking);
    bubbleEl.classList.toggle("thinking", thinking);
    positionBubble();
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
    window.PomDebug?.log(isError ? "错误" : "提示", text);
  }

  function setOptionsVisible(visible) {
    optionsBar.classList.toggle("hidden", !visible);
  }

  const INTENT_ARIA = {
    keypoint: "要点",
    followup: "追问",
    pivot: "换题",
    close: "结束对话",
  };

  function renderOptionButtons(options, loading) {
    const disabled = loading || state.isStreaming;
    optionsBar.classList.toggle("is-loading", loading);
    for (const btn of optionsBar.querySelectorAll(".option-btn")) {
      const id = Number(btn.dataset.optionId);
      const opt = options?.find((o) => o.id === id);
      const lineEl = btn.querySelector(".option-line");
      const lineText = loading ? "生成中…" : opt?.line || "—";
      if (lineEl) {
        lineEl.textContent = lineText;
      }
      if (opt?.intent) {
        const kind = INTENT_ARIA[opt.intent] || "";
        btn.setAttribute(
          "aria-label",
          kind && lineText !== "生成中…" && lineText !== "—"
            ? `${kind}：${lineText}`
            : lineText
        );
      }
      btn.classList.toggle("option-btn--close", opt?.intent === "close");
      btn.disabled = disabled || !opt?.line || loading;
    }
  }

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    positionBubble();
    renderMap();
  }

  function positionBubble() {
    if (!state.talkingId) {
      return;
    }
    const ch = getCharacter(state.talkingId);
    if (!ch) {
      return;
    }
    const { x, y, rect } = worldToCanvas(canvas, ch.x, ch.y);
    const bubbleRect = bubbleEl.getBoundingClientRect();
    const left = rect.left + x - bubbleRect.width / 2;
    const top = rect.top + y - CHAR_BUBBLE_GAP - bubbleRect.height;
    bubbleEl.style.left = `${Math.max(8, left)}px`;
    bubbleEl.style.top = `${Math.max(8, top)}px`;
  }

  function renderMap() {
    const near = characters.find((c) => isNearPlayer(state.player, c));
    highlightId = near?.id || null;
    draw(ctx, canvas, {
      player: state.player,
      characters,
      talkingId: state.talkingId,
      highlightId,
    });
    hintEl.textContent = state.talkingId
      ? state.isStreaming
        ? "等待角色回复…"
        : "点选下方句子"
      : near
        ? `点击「${near.name}」交谈`
        : "点击空地移动 · 靠近角色后点击交谈";
  }

  function endTalking() {
    if (state.talkingId) {
      const session = getSession(state, state.talkingId);
      session.messages = [];
      persist(state);
    }
    state.talkingId = null;
    state.currentOptions = null;
    state.optionsLoading = false;
    setBubble("");
    setOptionsVisible(false);
    stopButtonEl.disabled = true;
    renderMap();
    window.PomDebug?.log("结束对话");
  }

  function ensureApiConfig() {
    const status = window.PomConfig?.getConfigStatus?.();
    if (status && !status.ok) {
      setStatus(status.message, true);
      return false;
    }
    return true;
  }

  function startTalking(characterId) {
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
    const session = getSession(state, characterId);
    setStatus("", false);
    window.PomDebug?.log("开始对话", {
      character: character.name,
      historyTurns: window.GameDialogue.HISTORY_TURNS,
      messageCount: session.messages.length,
    });

    if (session.messages.length === 0) {
      session.messages.push({
        id: createId(),
        role: "assistant",
        content: archetype.opening,
        createdAt: Date.now(),
        status: "done",
      });
      persist(state);
      setBubble(archetype.opening, false);
    } else {
      const last = [...session.messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.status === "done");
      setBubble(last?.content || archetype.opening, false);
    }

    state.currentOptions = presetOptions(archetype);
    window.PomDebug?.log("首轮选项（程序预设）", state.currentOptions.map((o) => o.line));

    setOptionsVisible(true);
    stopButtonEl.disabled = true;
    state.optionsLoading = false;
    renderOptionButtons(state.currentOptions, false);
    renderMap();
    positionBubble();
  }

  async function pickOption(optionId) {
    if (!state.talkingId || state.isStreaming || state.optionsLoading) {
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

    const character = getCharacter(state.talkingId);
    const archetype = getArchetype(character.archetypeId);
    const session = getSession(state, state.talkingId);
    const optionsSnapshot = state.currentOptions.map((o) => ({ ...o }));
    const isClose = pick.intent === "close";

    window.PomDebug?.log("玩家选择", { intent: pick.intent, line: pick.line });

    session.messages.push({
      id: createId(),
      role: "user",
      content: pick.line,
      intent: pick.intent,
      createdAt: Date.now(),
      status: "done",
    });
    persist(state);

    const history = getHistoryForApi(session.messages);
    const apiUserContent = buildGameUserMessage(character, optionsSnapshot, pick, {
      jsonMode: true,
    });
    const apiMessages = [
      ...history.slice(0, -1),
      { role: "user", content: apiUserContent },
    ];

    state.isStreaming = true;
    state.optionsLoading = true;
    renderOptionButtons(state.currentOptions, true);
    stopButtonEl.disabled = false;
    const thinkingBubble =
      [...session.messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.status === "done")?.content || "";
    setBubble(thinkingBubble, true, { thinking: true });
    setStatus("锋利在想…", false);
    renderMap();

    abortController = new AbortController();

    try {
      const { reply, options } = await requestCombinedTurn({
        character,
        archetype,
        session,
        apiMessages,
        isClose,
        signal: abortController.signal,
      });

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

      if (isClose) {
        if (options) {
          window.PomDebug?.log("收束轮忽略多余 options", null);
        }
        setTimeout(() => endTalking(), 600);
      } else {
        state.currentOptions = options;
        window.PomDebug?.log("选项已更新", options.map((o) => o.line));
      }
    } catch (error) {
      if (error.name === "AbortError") {
        window.PomDebug?.log("已停止生成", null);
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
      abortController = null;
      stopButtonEl.disabled = true;
      if (state.talkingId && pick.intent !== "close") {
        renderOptionButtons(state.currentOptions, false);
      }
      renderMap();
      positionBubble();
    }
  }

  function handleMapClick(clientX, clientY) {
    if (state.isStreaming) {
      return;
    }

    const world = canvasToWorld(canvas, clientX, clientY);
    const hit = hitCharacter(characters, world);

    if (hit && isNearPlayer(state.player, hit)) {
      if (state.talkingId === hit.id) {
        return;
      }
      startTalking(hit.id);
      return;
    }

    if (state.talkingId) {
      return;
    }

    if (hit && !isNearPlayer(state.player, hit)) {
      state.moveTarget = { x: hit.x, y: hit.y - INTERACT_RADIUS * 0.85 };
      setStatus(`靠近「${hit.name}」后再点击`, false);
      return;
    }

    state.moveTarget = {
      x: Math.max(0.05, Math.min(0.95, world.x)),
      y: Math.max(0.05, Math.min(0.95, world.y)),
    };
    setStatus("", false);
  }

  function gameLoop(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;

    if (state.moveTarget && !state.talkingId) {
      state.player = tickMove(state.player, state.moveTarget, dt);
      if (
        Math.hypot(
          state.player.x - state.moveTarget.x,
          state.player.y - state.moveTarget.y
        ) < 0.004
      ) {
        state.moveTarget = null;
        persist(state);
      }
      renderMap();
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
    window.PomDebug?.log("停止生成");
  });

  document.getElementById("copyDebugBtn")?.addEventListener("click", () => {
    window.PomDebug?.copyAll();
  });
  document.getElementById("clearDebugBtn")?.addEventListener("click", () => {
    window.PomDebug?.clear();
  });

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("scroll", positionBubble, true);

  function showConfigSetupIfNeeded() {
    const status = window.PomConfig?.getConfigStatus?.();
    if (status && !status.ok) {
      configSetupEl.hidden = false;
      setStatus(status.message, true);
    } else {
      configSetupEl.hidden = true;
    }
  }

  resizeCanvas();
  setOptionsVisible(false);
  setBubble("");
  showConfigSetupIfNeeded();
  window.PomDebug?.log("Points-of-mess v0.1.3 已加载（首轮程序选项 + 合并 JSON API）");
  if (!window.GameState.PERSIST_SESSIONS) {
    window.PomDebug?.log(
      "测试模式",
      "每次刷新清空对话历史；仅保留地图位置。首轮选项为程序预设，之后每轮一次 API 返回台词+选项。"
    );
  }
  requestAnimationFrame(gameLoop);
})();
