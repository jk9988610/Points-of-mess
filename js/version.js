(function () {
  window.POM_VERSION = "0.7.0";


  function applyVersionUi() {
    const label = `v${window.POM_VERSION}`;
    const header = document.getElementById("appVersion");
    if (header) {
      header.textContent = label;
    }
    document.title = `Points-of-mess ${label}`;
  }

  function bustedIndexHref(liveVersion) {
    const path = location.pathname.replace(/\/?index\.html$/i, "/");
    const base = path.endsWith("/") ? path : `${path}/`;
    return `${base}index.html?fresh=${Date.now()}&v=${encodeURIComponent(liveVersion)}`;
  }

  function showStaleBanner(liveVersion) {
    let el = document.getElementById("staleCacheBanner");
    if (el) {
      return;
    }
    const directHref = bustedIndexHref(liveVersion);
    const refreshHref = `refresh.html?bust=${Date.now()}`;
    el = document.createElement("div");
    el.id = "staleCacheBanner";
    el.setAttribute("role", "alert");
    el.style.cssText =
      "position:fixed;left:8px;right:8px;top:8px;z-index:300;padding:10px 12px;" +
      "border-radius:8px;background:#7f1d1d;color:#fecaca;font-size:0.85rem;line-height:1.4;";
    el.innerHTML =
      `本机 <strong>v${window.POM_VERSION}</strong>，线上 <strong>v${liveVersion}</strong>。` +
      ` 请点 <a href="${directHref}" style="color:#fde68a;font-weight:700">加载 v${liveVersion}</a>` +
      ` 或 <a href="${refreshHref}" style="color:#fde68a;font-weight:700">强制更新页</a>。` +
      "仍无效请清除 github.io 站点缓存。";
    document.body.appendChild(el);
  }

  function reloadForLiveVersion(liveVersion) {
    const params = new URLSearchParams(location.search);
    if (params.get("v") === liveVersion && window.POM_VERSION !== liveVersion) {
      return false;
    }
    const key = `pom_auto_refresh_${liveVersion}`;
    if (sessionStorage.getItem(key) === "1") {
      return false;
    }
    sessionStorage.setItem(key, "1");
    try {
      sessionStorage.removeItem("pom_fresh_redirect");
    } catch {
      /* ignore */
    }
    location.replace(bustedIndexHref(liveVersion));
    return true;
  }

  function wireRefreshNavLink() {
    const nav = document.querySelector('a[href="refresh.html"], a[href="./refresh.html"]');
    if (nav) {
      nav.href = `refresh.html?bust=${Date.now()}`;
    }
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
        window.PomDebug?.logLocalWarn("缓存过期", `本机 v${window.POM_VERSION} · 线上 v${live}`);
        if (reloadForLiveVersion(live)) {
          return;
        }
        showStaleBanner(live);
      }
    } catch {
      /* offline or blocked */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyVersionUi();
      wireRefreshNavLink();
      checkLiveVersion();
    });
  } else {
    applyVersionUi();
    wireRefreshNavLink();
    checkLiveVersion();
  }
})();
