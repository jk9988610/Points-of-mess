(function () {
  window.POM_VERSION = "0.3.4";

  function applyVersionUi() {
    const label = `v${window.POM_VERSION}`;
    const header = document.getElementById("appVersion");
    if (header) {
      header.textContent = label;
    }
    document.title = `Points-of-mess ${label}`;
  }

  function showStaleBanner(liveVersion) {
    let el = document.getElementById("staleCacheBanner");
    if (el) {
      return;
    }
    el = document.createElement("div");
    el.id = "staleCacheBanner";
    el.setAttribute("role", "alert");
    el.style.cssText =
      "position:fixed;left:8px;right:8px;top:8px;z-index:300;padding:10px 12px;" +
      "border-radius:8px;background:#7f1d1d;color:#fecaca;font-size:0.85rem;line-height:1.4;";
    el.innerHTML =
      `本机脚本为 <strong>v${window.POM_VERSION}</strong>，线上已是 <strong>v${liveVersion}</strong>。` +
      " 请清除本网站缓存或用无痕窗口打开。";
    document.body.appendChild(el);
  }

  async function checkLiveVersion() {
    if (!/^https?:/.test(location.protocol)) {
      return;
    }
    try {
      const res = await fetch(`js/version.js?probe=${Date.now()}`, { cache: "no-store" });
      const text = await res.text();
      const match = text.match(/POM_VERSION\s*=\s*"([^"]+)"/);
      const live = match?.[1];
      if (live && live !== window.POM_VERSION) {
        showStaleBanner(live);
        window.PomDebug?.logLocalWarn("缓存过期", `本机 v${window.POM_VERSION} · 线上 v${live}`);
      }
    } catch {
      /* offline or blocked */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyVersionUi();
      checkLiveVersion();
    });
  } else {
    applyVersionUi();
    checkLiveVersion();
  }
})();
