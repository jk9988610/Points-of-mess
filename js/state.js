(function () {
  const STORAGE_KEY = "points-of-mess-v0";

  function createId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function defaultPlayerPosition() {
    return { x: 0.28, y: 0.62 };
  }

  /** 刷新后清空对话，便于重复测试；仅保留玩家在地图上的位置 */
  const PERSIST_SESSIONS = false;

  window.GameState = {
    PERSIST_SESSIONS,
    createId,
    createInitialState() {
      const saved = loadFromStorage();
      return {
        player: saved?.player || defaultPlayerPosition(),
        moveTarget: null,
        talkingId: null,
        bubbleText: "",
        isStreaming: false,
        error: null,
        sessions: {},
      };
    },
    getSession(state, characterId) {
      if (!state.sessions[characterId]) {
        state.sessions[characterId] = { messages: [] };
      }
      return state.sessions[characterId];
    },
    persist(state) {
      try {
        const payload = {
          player: state.player,
          savedAt: Date.now(),
        };
        if (PERSIST_SESSIONS) {
          payload.sessions = state.sessions;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* quota / private mode */
      }
    },
  };
})();
