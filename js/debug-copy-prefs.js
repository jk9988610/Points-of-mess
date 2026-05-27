(function () {
  const STORAGE_KEY = "pom_debug_copy_prefs_v2";

  const GROUPS = [
    { id: "apiReplyOut", label: "发AI·角色回复", tag: "api-reply-out" },
    { id: "apiReplyIn", label: "AI回·角色回复", tag: "api-reply-in" },
    { id: "apiOptionsOut", label: "发AI·选项", tag: "api-options-out" },
    { id: "apiOptionsIn", label: "AI回·选项", tag: "api-options-in" },
    { id: "apiSummaryOut", label: "发AI·摘要压缩", tag: "api-summary-out" },
    { id: "apiSummaryIn", label: "AI回·摘要压缩", tag: "api-summary-in" },
    { id: "apiCombinedOut", label: "发AI·合并(备用)", tag: "api-combined-out" },
    { id: "apiCombinedIn", label: "AI回·合并(备用)", tag: "api-combined-in" },
    { id: "apiFreeformOut", label: "发AI·输入框(隐藏)", tag: "api-freeform-out" },
    { id: "apiFreeformIn", label: "AI回·输入框(隐藏)", tag: "api-freeform-in" },
    { id: "apiOtherOut", label: "发AI·其它", tag: "api-other-out" },
    { id: "apiOtherIn", label: "AI回·其它", tag: "api-other-in" },
    { id: "user", label: "用户操作", tag: "user" },
    { id: "ui", label: "程序状态", tag: "ui" },
    { id: "uiWarn", label: "程序·警告", tag: "ui-warn" },
    { id: "uiError", label: "程序·错误", tag: "ui-error" },
  ];

  const DEFAULT_PREFS = Object.fromEntries(GROUPS.map((g) => [g.id, true]));

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
    const tags = entry.tags || [];
    for (const g of GROUPS) {
      if (prefs[g.id] === false && tags.includes(g.tag)) {
        return false;
      }
    }
    if (tags.length === 0) {
      return prefs.ui !== false;
    }
    return tags.some((t) => {
      const group = GROUPS.find((g) => g.tag === t);
      if (!group) {
        return prefs.ui !== false;
      }
      return prefs[group.id] !== false;
    });
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
      .join("\n\n");
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
      const sections = [
        { title: "API", ids: GROUPS.filter((g) => g.id.startsWith("api")).map((g) => g.id) },
        { title: "用户", ids: ["user"] },
        { title: "程序", ids: ["ui", "uiWarn", "uiError"] },
      ];
      let html = "";
      for (const sec of sections) {
        html += `<p class="debug-prefs-section">${sec.title}</p>`;
        for (const id of sec.ids) {
          const g = GROUPS.find((x) => x.id === id);
          if (!g) {
            continue;
          }
          html += `<label class="debug-prefs-row"><input type="checkbox" name="${g.id}" ${
            prefs[g.id] ? "checked" : ""
          } /> ${g.label}</label>`;
        }
      }
      html +=
        '<div class="debug-prefs-actions">' +
        '<button type="button" class="debug-btn" data-prefs-all>全选</button>' +
        '<button type="button" class="debug-btn" data-prefs-api>仅API</button>' +
        '<button type="submit" class="debug-btn">保存</button>' +
        '<button type="button" class="debug-btn" data-prefs-cancel>取消</button>' +
        "</div>";
      form.innerHTML = html;
    }

    openBtn?.addEventListener("click", () => {
      renderForm();
      if (dialog.showModal) {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "open");
      }
    });

    form.addEventListener("click", (e) => {
      if (e.target.matches("[data-prefs-all]")) {
        form.querySelectorAll('input[type="checkbox"]').forEach((el) => {
          el.checked = true;
        });
      }
      if (e.target.matches("[data-prefs-api]")) {
        form.querySelectorAll('input[type="checkbox"]').forEach((el) => {
          const g = GROUPS.find((x) => x.id === el.name);
          el.checked = Boolean(g?.id.startsWith("api"));
        });
      }
      if (e.target.matches("[data-prefs-cancel]")) {
        dialog.close?.();
        dialog.removeAttribute("open");
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
      window.PomDebug?.logLocal("调试复制偏好已保存", prefs, ["ui"]);
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
