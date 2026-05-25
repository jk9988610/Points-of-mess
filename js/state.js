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

  window.GameState = {
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
        sessions: saved?.sessions || {},
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
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            player: state.player,
            sessions: state.sessions,
            savedAt: Date.now(),
          })
        );
      } catch {
        /* quota / private mode */
      }
    },
  };
})();
