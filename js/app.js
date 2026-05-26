(function () {
  const { characters, getArchetype, getCharacter } = window.GamePresets;
  const { createId, createInitialState, getSession, persist } = window.GameState;
  const { buildGameUserMessage, getHistoryForApi } = window.GameDialogue;
  const { streamChat } = window.ChatApi;
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
  let abortController = null;
  let lastFrame = performance.now();
  let highlightId = null;

  function setBubble(text, streaming) {
    state.bubbleText = text;
    bubbleTextEl.textContent = text || (streaming ? "…" : "");
    bubbleEl.classList.toggle("visible", Boolean(state.talkingId));
    bubbleEl.classList.toggle("streaming", Boolean(streaming));
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
  }

  function setOptionsVisible(visible) {
    optionsBar.classList.toggle("hidden", !visible);
    optionsBar.querySelectorAll("button").forEach((btn) => {
      btn.disabled = state.isStreaming;
    });
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
      ? "选择下方选项"
      : near
        ? `点击「${near.name}」交谈`
        : "点击空地移动 · 靠近角色后点击交谈";
  }

  function endTalking() {
    state.talkingId = null;
    setBubble("");
    setOptionsVisible(false);
    stopButtonEl.disabled = true;
    renderMap();
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

    if (session.messages.length === 0) {
      const openingMsg = {
        id: createId(),
        role: "assistant",
        content: archetype.opening,
        createdAt: Date.now(),
        status: "done",
      };
      session.messages.push(openingMsg);
      persist(state);
      setBubble(archetype.opening, false);
    } else {
      const last = [...session.messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.status === "done");
      setBubble(last?.content || archetype.opening, false);
    }

    setOptionsVisible(true);
    stopButtonEl.disabled = true;
    renderMap();
    positionBubble();
  }

  function ensureApiConfig() {
    const status = window.PomConfig?.getConfigStatus?.();
    if (status && !status.ok) {
      setStatus(status.message, true);
      return false;
    }
    return true;
  }

  async function pickOption(optionId) {
    if (!state.talkingId || state.isStreaming) {
      return;
    }
    if (!ensureApiConfig()) {
      return;
    }

    const character = getCharacter(state.talkingId);
    const archetype = getArchetype(character.archetypeId);
    const pick = archetype.options.find((o) => o.id === optionId);
    if (!pick) {
      return;
    }

    const session = getSession(state, state.talkingId);

    const userMessage = {
      id: createId(),
      role: "user",
      content: pick.line,
      intent: pick.intent,
      createdAt: Date.now(),
      status: "done",
    };

    session.messages.push(userMessage);
    persist(state);

    const history = getHistoryForApi(session.messages);
    const apiUserContent = buildGameUserMessage(character, archetype, pick);
    const apiMessages = [
      ...history.slice(0, -1),
      { role: "user", content: apiUserContent },
    ];

    state.isStreaming = true;
    setOptionsVisible(true);
    stopButtonEl.disabled = false;
    setBubble("", true);
    setStatus("", false);

    let assistantContent = "";
    abortController = new AbortController();

    try {
      const closeTokens = pick.intent === "close" ? 50 : undefined;
      await streamChat({
        systemPrompt: archetype.system,
        messages: apiMessages,
        max_tokens: closeTokens,
        signal: abortController.signal,
        onDelta(chunk) {
          assistantContent += chunk;
          setBubble(assistantContent, true);
        },
      });

      const assistantMessage = {
        id: createId(),
        role: "assistant",
        content: assistantContent,
        createdAt: Date.now(),
        status: "done",
      };
      session.messages.push(assistantMessage);
      persist(state);
      setBubble(assistantContent, false);

      if (pick.intent === "close") {
        setTimeout(() => endTalking(), 600);
      }
    } catch (error) {
      if (error.name === "AbortError") {
        if (assistantContent) {
          session.messages.push({
            id: createId(),
            role: "assistant",
            content: assistantContent,
            createdAt: Date.now(),
            status: "done",
          });
          persist(state);
          setBubble(assistantContent, false);
        }
      } else {
        session.messages.pop();
        persist(state);
        const msg = error.message || "生成失败，请稍后重试。";
        setStatus(msg, true);
        const prev = [...session.messages]
          .reverse()
          .find((m) => m.role === "assistant" && m.status === "done");
        setBubble(prev?.content || "", false);
      }
    } finally {
      state.isStreaming = false;
      abortController = null;
      stopButtonEl.disabled = true;
      setOptionsVisible(state.talkingId !== null);
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
      const next = tickMove(state.player, state.moveTarget, dt);
      state.player = next;
      if (
        Math.hypot(next.x - state.moveTarget.x, next.y - state.moveTarget.y) < 0.004
      ) {
        state.moveTarget = null;
        persist(state);
      }
      renderMap();
    }

    requestAnimationFrame(gameLoop);
  }

  canvas.addEventListener("click", (e) => {
    handleMapClick(e.clientX, e.clientY);
  });

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
    if (!btn) {
      return;
    }
    pickOption(Number(btn.dataset.optionId));
  });

  stopButtonEl.addEventListener("click", () => {
    abortController?.abort();
  });

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("scroll", positionBubble, true);

  function showConfigSetupIfNeeded() {
    const status = window.PomConfig?.getConfigStatus?.();
    if (status && !status.ok) {
      if (configSetupEl) {
        configSetupEl.hidden = false;
      }
      setStatus(status.message, true);
    } else if (configSetupEl) {
      configSetupEl.hidden = true;
    }
  }

  resizeCanvas();
  setOptionsVisible(false);
  setBubble("");
  showConfigSetupIfNeeded();
  requestAnimationFrame(gameLoop);
})();
