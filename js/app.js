(function () {
  const { characters, getArchetype, getCharacter } = window.GamePresets;
  const { createId, createInitialState, getSession, persist } = window.GameState;
  const { buildGameUserMessage } = window.GameDialogue;
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
    if (isError) {
      window.PomDebug?.logLocalError("错误", text);
    } else {
      window.PomDebug?.logLocal("提示", text);
    }
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

  function ensureMemoryProbe(session) {
    if (!session.memoryProbe) {
      session.memoryProbe = window.GameMemoryProbe.createCodeword();
      session.memoryProbeInjected = false;
      window.PomDebug?.logLocal(
        "记忆探测",
        `本局暗号：${session.memoryProbe}\n仅第 1 次「发AI」携带 [memory_probe]；之后点「测记忆」看宿主是否自动带全文。`
      );
    }
  }

  function endTalking() {
    if (state.talkingId) {
      const session = getSession(state, state.talkingId);
      session.messages = [];
      delete session.memoryProbe;
      delete session.memoryProbeInjected;
      persist(state);
    }
    state.talkingId = null;
    state.currentOptions = null;
    state.optionsLoading = false;
    setBubble("");
    setOptionsVisible(false);
    stopButtonEl.disabled = true;
    renderMap();
    window.PomDebug?.logLocal("结束对话");
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
    ensureMemoryProbe(session);
    setStatus("", false);
    window.PomDebug?.logLocal("开始对话", {
      character: character.name,
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
    window.PomDebug?.logLocal(
      "首轮选项（程序预设，不发 API）",
      state.currentOptions.map((o) => o.line)
    );

    setOptionsVisible(true);
    stopButtonEl.disabled = true;
    state.optionsLoading = false;
    renderOptionButtons(state.currentOptions, false);
    renderMap();
    positionBubble();
  }

  async function sendDialogueTurn(pick, { isMemoryTest = false, logLabel } = {}) {
    if (!state.talkingId || state.isStreaming || state.optionsLoading) {
      return;
    }
    if (!ensureApiConfig()) {
      return;
    }

    const character = getCharacter(state.talkingId);
    const archetype = getArchetype(character.archetypeId);
    const session = getSession(state, state.talkingId);
    ensureMemoryProbe(session);
    const optionsSnapshot = state.currentOptions.map((o) => ({ ...o }));
    const isClose = !isMemoryTest && pick.intent === "close";
    const includeProbe = Boolean(
      session.memoryProbe && !session.memoryProbeInjected && !isMemoryTest
    );

    window.PomDebug?.logLocal(logLabel || "玩家选择（界面）", {
      intent: pick.intent,
      line: pick.line,
      memoryProbeInPayload: includeProbe ? session.memoryProbe : null,
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

    const apiUserContent = buildGameUserMessage(character, optionsSnapshot, pick, {
      jsonMode: true,
      memoryProbe: includeProbe ? session.memoryProbe : null,
      memoryTest: isMemoryTest,
    });
    const apiMessages = [{ role: "user", content: apiUserContent }];

    state.isStreaming = true;
    state.optionsLoading = true;
    renderOptionButtons(state.currentOptions, true);
    stopButtonEl.disabled = false;
    const thinkingBubble =
      [...session.messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.status === "done")?.content || "";
    setBubble(thinkingBubble, true, { thinking: true });
    setStatus(isMemoryTest ? "记忆测试中…" : "锋利在想…", false);
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

      if (includeProbe) {
        session.memoryProbeInjected = true;
        window.PomDebug?.logLocal("记忆探测", "首包已发送 [memory_probe]，后续包不再附带");
      }

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

      if (isMemoryTest) {
        const hit = window.GameMemoryProbe.replyContainsCodeword(
          reply,
          session.memoryProbe
        );
        window.PomDebug?.logLocal(
          hit ? "记忆探测·命中" : "记忆探测·未命中",
          hit
            ? `reply 含暗号「${session.memoryProbe}」→ 宿主可能自动带了全文`
            : `期望暗号「${session.memoryProbe}」\nreply：${reply}\n→ 宿主可能未带上文，或模型未遵守回忆测试格式`
        );
        state.currentOptions = options || state.currentOptions;
        if (options) {
          window.PomDebug?.logLocal("选项已更新（界面展示）", options.map((o) => o.line));
        }
      } else if (isClose) {
        if (options) {
          window.PomDebug?.logLocal("收束轮忽略多余 options");
        }
        setTimeout(() => endTalking(), 600);
      } else {
        state.currentOptions = options;
        window.PomDebug?.logLocal("选项已更新（界面展示）", options.map((o) => o.line));
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
      abortController = null;
      stopButtonEl.disabled = true;
      if (state.talkingId && pick.intent !== "close") {
        renderOptionButtons(state.currentOptions, false);
      }
      renderMap();
      positionBubble();
    }
  }

  async function pickOption(optionId) {
    const pick = state.currentOptions?.find((o) => o.id === optionId);
    if (!pick?.line) {
      setStatus("选项尚未就绪", true);
      return;
    }
    await sendDialogueTurn(pick);
  }

  async function runMemoryProbeTest() {
    if (!state.talkingId) {
      window.PomDebug?.logLocalWarn("测记忆", "请先与角色开聊");
      return;
    }
    const session = getSession(state, state.talkingId);
    if (!session.memoryProbeInjected) {
      window.PomDebug?.logLocalWarn("测记忆", "请先至少发送 1 次普通选项（首包会带暗号）");
      return;
    }
    const pick = {
      id: 0,
      intent: "keypoint",
      line: window.GameMemoryProbe.MEMORY_TEST_LINE,
    };
    await sendDialogueTurn(pick, {
      isMemoryTest: true,
      logLabel: "回忆测试（测记忆按钮）",
    });
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
    window.PomDebug?.logLocal("停止生成");
  });

  document.getElementById("copyDebugBtn")?.addEventListener("click", () => {
    window.PomDebug?.copyAll();
  });
  document.getElementById("clearDebugBtn")?.addEventListener("click", () => {
    window.PomDebug?.clear();
  });
  document.getElementById("memoryTestBtn")?.addEventListener("click", () => {
    runMemoryProbeTest();
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
  const ver = window.POM_VERSION || "?";
  window.PomDebug?.logLocal(`Points-of-mess v${ver} 已加载（调试分色=内联样式）`);
  if (!window.GameState.PERSIST_SESSIONS) {
    window.PomDebug?.logLocal(
      "测试模式",
      "灰=本地 · 黄=发AI · 绿=AI回。首轮选项不发 API。开聊后首包带暗号，点「测记忆」验证宿主是否自动带全文。"
    );
  }
  requestAnimationFrame(gameLoop);
})();
