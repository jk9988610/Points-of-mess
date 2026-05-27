(function () {
  const { characters, getArchetype, getCharacter } = window.GamePresets;
  const { createId, createInitialState, getSession, persist } = window.GameState;
  const { getHistoryForApi } = window.GameDialogue;
  const { presetOptions, requestCombinedTurn } = window.GameOptionsAi;
  const {
    draw,
    tickMove,
    canvasToWorld,
    worldToCanvas,
    hitCharacter,
    isNearPlayer,
    isInTalkZone,
    INTERACT_RADIUS,
    TALK_ZONE_RADIUS,
  } = window.GameMap;

  const canvas = document.getElementById("gameCanvas");
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

  const CHAR_BUBBLE_GAP = 36;

  const state = createInitialState();
  state.currentOptions = null;
  state.optionsLoading = false;
  state.optionsPaused = false;
  state.playerBubbleText = "";

  let abortController = null;
  let lastFrame = performance.now();
  let highlightId = null;

  function isInTalkZoneNow() {
    const ch = state.talkingId ? getCharacter(state.talkingId) : null;
    return ch ? isInTalkZone(state.player, ch) : false;
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
    const inZone = isInTalkZoneNow();

    bubbleTextEl.textContent =
      state.bubbleText || (streaming && !thinking ? "…" : "");
    playerBubbleTextEl.textContent = state.playerBubbleText || "";

    bubbleEl.classList.toggle("streaming", Boolean(streaming) && !thinking);
    bubbleEl.classList.toggle("thinking", thinking);

    const showNpc =
      Boolean(state.talkingId) &&
      inZone &&
      (state.bubbleText || (streaming && !thinking));
    const showPlayer =
      Boolean(state.talkingId) && inZone && Boolean(state.playerBubbleText);

    bubbleEl.classList.toggle("visible", showNpc);
    playerBubbleEl.classList.toggle("visible", showPlayer);

    const suspended = Boolean(state.talkingId && !inZone);
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
      renderOptionButtons(state.currentOptions, state.optionsLoading);
    }

    if (!state.talkingId || !inZone) {
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

  function setMemoryInputVisible(visible) {
    memoryInputBar?.classList.toggle("hidden", !visible);
    if (memoryInputEl) {
      memoryInputEl.disabled = !visible;
    }
    if (memoryInputSendEl) {
      memoryInputSendEl.disabled = !visible || state.isStreaming;
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
    keypoint: "深挖",
    followup: "推进",
    pause: "待会再来",
    close: "结束对话",
  };

  function renderOptionButtons(options, loading) {
    const outOfZone = Boolean(state.talkingId && !isInTalkZoneNow());
    const disabled = loading || state.isStreaming || outOfZone;
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
      btn.classList.toggle(
        "option-btn--pause",
        opt?.intent === "pause" || opt?.intent === "close"
      );
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
    syncSpeechBubbles(false);
    renderMap();
  }

  function renderMap() {
    const near = characters.find((c) => isNearPlayer(state.player, c));
    const nearDoc = window.GameDesktop?.findNearDoc?.(state.player);
    highlightId = near?.id || null;
    draw(ctx, canvas, {
      player: state.player,
      characters,
      talkingId: state.talkingId,
      highlightId,
      highlightDocId: nearDoc?.id || null,
    });
    hintEl.textContent = state.talkingId
      ? state.isStreaming
        ? "等待角色回复… · 可在橙圈内移动"
        : getCharacter(state.talkingId) &&
            !isInTalkZone(state.player, getCharacter(state.talkingId))
          ? "回到橙圈内，对话气泡会恢复"
          : "点选下方句子 · 可在橙圈内点击移动"
      : near
        ? `点击「${near.name}」交谈`
        : nearDoc
          ? `点击「${nearDoc.title}」打开文档`
          : "点击空地移动 · 靠近📄或锋利";
  }

  function endTalking() {
    if (state.talkingId) {
      const session = getSession(state, state.talkingId);
      session.messages = [];
      session.plotSummary = "";
      session.lastSummaryAtOptionTurn = 0;
      persist(state);
    }
    state.talkingId = null;
    state.currentOptions = null;
    state.optionsLoading = false;
    state.optionsPaused = false;
    state.playerBubbleText = "";
    state.bubbleText = "";
    setBubble("");
    setOptionsVisible(false);
    setMemoryInputVisible(false);
    if (memoryInputEl) {
      memoryInputEl.value = "";
    }
    stopButtonEl.disabled = true;
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
    state.playerBubbleText = "";
    state.optionsPaused = false;
    const session = getSession(state, characterId);
    setStatus("", false);
    window.PomDebug?.logLocal("开始对话", {
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
    window.PomDebug?.logLocal(
      "首轮选项（预设·深挖/推进，不发 API）",
      state.currentOptions.map((o) => o.line)
    );

    setOptionsVisible(true);
    setMemoryInputVisible(true);
    stopButtonEl.disabled = true;
    state.optionsLoading = false;
    renderOptionButtons(state.currentOptions, false);
    renderMap();
    syncSpeechBubbles(false);
  }

  function resumeTalkOptions() {
    if (!state.talkingId || state.isStreaming) {
      return;
    }
    state.optionsPaused = false;
    setOptionsVisible(true);
    setMemoryInputVisible(true);
    renderOptionButtons(state.currentOptions, false);
    setStatus("", false);
    window.PomDebug?.logLocal("继续对话", "已恢复选项栏");
  }

  async function handlePauseOption(pick, character, archetype, session) {
    session.messages.push({
      id: createId(),
      role: "user",
      content: pick.line,
      intent: pick.intent,
      createdAt: Date.now(),
      status: "done",
    });
    const ack = String(archetype.pauseReply || "嗯。到时候再说。").trim();
    session.messages.push({
      id: createId(),
      role: "assistant",
      content: ack,
      createdAt: Date.now(),
      status: "done",
    });
    persist(state);
    setPlayerBubble(pick.line);
    setBubble(ack, false);
    state.optionsPaused = true;
    setOptionsVisible(false);
    setMemoryInputVisible(false);
    window.PomDebug?.logLocal("待会", "选项已隐藏；会话与摘要保留，再点锋利可继续");
    renderMap();
    syncSpeechBubbles(false);
  }

  async function sendFreeformMemoryQuestion() {
    if (!state.talkingId || state.isStreaming || state.optionsLoading) {
      return;
    }
    if (!isInTalkZoneNow()) {
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

    window.PomDebug?.logLocal("输入框原文", text);
    window.PomDebug?.logRequest(
      "输入框→AI（仅 messages）",
      JSON.stringify({ messages: apiMessages }, null, 2)
    );

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
    renderOptionButtons(state.currentOptions, true);
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
      window.PomDebug?.logResponse("输入框←AI", reply);
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
        renderOptionButtons(state.currentOptions, false);
      }
      renderMap();
      syncSpeechBubbles(false);
    }
  }

  async function pickOption(optionId) {
    if (!state.talkingId || state.isStreaming || state.optionsLoading) {
      return;
    }
    if (!isInTalkZoneNow()) {
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

    const character = getCharacter(state.talkingId);
    const archetype = getArchetype(character.archetypeId);
    const session = getSession(state, state.talkingId);
    const optionsSnapshot = state.currentOptions.map((o) => ({ ...o }));
    const isClose = pick.intent === "close";

    window.PomDebug?.logLocal("玩家选择（界面）", {
      intent: pick.intent,
      line: pick.line,
    });

    if (pick.intent === "pause") {
      await handlePauseOption(pick, character, archetype, session);
      return;
    }

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

    const apiMessages = getHistoryForApi(session.messages);
    if (session.plotSummary) {
      window.PomDebug?.logLocal(
        "剧情摘要（缓存，随 reply/选项 system 注入）",
        session.plotSummary
      );
    }
    window.PomDebug?.logLocal("本轮 messages 字数", String(
      apiMessages.reduce((n, m) => n + m.content.length, 0)
    ));

    state.isStreaming = true;
    state.optionsLoading = true;
    setMemoryInputBusy(true);
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
        turn: { character, options: optionsSnapshot, pick, isClose },
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
          window.PomDebug?.logLocal("收束轮忽略多余 options");
        }
        setTimeout(() => endTalking(), 600);
      } else {
        state.currentOptions = options;
        window.PomDebug?.logLocal("选项已更新（界面展示）", options.map((o) => o.line));
      }

      if (!isClose) {
        try {
          await window.GameSummary?.maybeRefreshPlotSummary(session, abortController?.signal);
          persist(state);
        } catch (e) {
          if (e.name !== "AbortError") {
            window.PomDebug?.logLocalWarn("剧情摘要失败", e.message);
          }
        }
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
      if (state.talkingId && pick.intent !== "close") {
        renderOptionButtons(state.currentOptions, false);
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
    const docHit = window.GameDesktop?.hitDesktopDoc?.(world, state.player);
    if (docHit && !state.talkingId) {
      window.GameDesktop.openDoc(docHit);
      return;
    }

    const hit = hitCharacter(characters, world);

    if (hit && isNearPlayer(state.player, hit)) {
      if (state.talkingId === hit.id) {
        if (state.optionsPaused) {
          resumeTalkOptions();
        }
        return;
      }
      startTalking(hit.id);
      return;
    }

    if (state.talkingId) {
      if (hit && hit.id !== state.talkingId) {
        return;
      }
      state.moveTarget = clampWorldToMap(world);
      setStatus("", false);
      persist(state);
      renderMap();
      return;
    }

    if (hit && !isNearPlayer(state.player, hit)) {
      state.moveTarget = { x: hit.x, y: hit.y - INTERACT_RADIUS * 0.85 };
      setStatus(`靠近「${hit.name}」后再点击`, false);
      return;
    }

    state.moveTarget = clampWorldToMap(world);
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
      "测试模式",
      "灰=本地 · 黄=发AI · 绿=AI回。每轮：①reply→②深挖/推进(AI)+③待会(固定)。"
    );
  }
  requestAnimationFrame(gameLoop);
})();
