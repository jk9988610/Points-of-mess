(function () {
  const STORAGE_KEY = "pom_debug_copy_prefs";

  const GROUPS = [
    { id: "aiOut", label: "发AI", match: (e) => e.audience === "ai-out" },
    { id: "aiIn", label: "AI回", match: (e) => e.audience === "ai-in" },
    { id: "local", label: "本地", match: (e) => e.audience === "local" },
    { id: "localWarn", label: "本地·警", match: (e) => e.audience === "local-warn" },
    { id: "localError", label: "本地·错", match: (e) => e.audience === "local-error" },
  ];

  const DEFAULT_PREFS = {
    aiOut: true,
    aiIn: true,
    local: true,
    localWarn: true,
    localError: true,
  };

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_PREFS };
      }
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }

  function savePrefs(prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* quota */
    }
  }

  function entryAllowed(entry, prefs) {
    const group = GROUPS.find((g) => g.match(entry));
    if (!group) {
      return true;
    }
    return prefs[group.id] !== false;
  }

  function filterEntries(entries, prefs) {
    return entries.filter((e) => entryAllowed(e, prefs));
  }

  function entriesToPlain(entries) {
    return entries
      .map((e) => {
        const tag =
          e.audience === "ai-out"
            ? "发AI"
            : e.audience === "ai-in"
              ? "AI回"
              : e.audience === "local-error"
                ? "本地·错"
                : e.audience === "local-warn"
                  ? "本地·警"
                  : "本地";
        return e.body === undefined || e.body === ""
          ? `[${e.time}] [${tag}] ${e.title}`
          : `[${e.time}] [${tag}] ${e.title}\n${e.body}`;
      })
      .join("\n");
  }

  function bindDialog() {
    const dialog = document.getElementById("debugCopyPrefsDialog");
    const form = document.getElementById("debugCopyPrefsForm");
    const openBtn = document.getElementById("debugCopyPrefsBtn");
    if (!dialog || !form) {
      return;
    }

    function renderForm() {
      const prefs = loadPrefs();
      form.innerHTML = GROUPS.map(
        (g) =>
          `<label class="debug-prefs-row"><input type="checkbox" name="${g.id}" ${
            prefs[g.id] ? "checked" : ""
          } /> ${g.label}</label>`
      ).join("");
      form.innerHTML +=
        '<div class="debug-prefs-actions">' +
        '<button type="submit" class="debug-btn">保存</button>' +
        '<button type="button" class="debug-btn" data-prefs-cancel>取消</button>' +
        "</div>";
    }

    openBtn?.addEventListener("click", () => {
      renderForm();
      if (dialog.showModal) {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "open");
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const prefs = { ...DEFAULT_PREFS };
      for (const g of GROUPS) {
        const input = form.querySelector(`[name="${g.id}"]`);
        prefs[g.id] = Boolean(input?.checked);
      }
      savePrefs(prefs);
      dialog.close?.();
      dialog.removeAttribute("open");
      window.PomDebug?.logLocal("调试复制偏好已保存", prefs);
    });

    form.addEventListener("click", (e) => {
      if (e.target.matches("[data-prefs-cancel]")) {
        dialog.close?.();
        dialog.removeAttribute("open");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindDialog);
  } else {
    bindDialog();
  }

  window.PomDebugCopyPrefs = {
    loadPrefs,
    savePrefs,
    filterEntries,
    entriesToPlain,
    GROUPS,
  };
})();
