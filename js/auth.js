(function () {
  const EXPECTED_ACCOUNT = "jk9988610";
  const STORAGE_ACCOUNT = "pom_account";
  const STORAGE_SECRET = "pom_secret";
  const STORAGE_REMEMBER = "pom_remember";

  let loggedIn = false;

  function normalizeAccount(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validateCredentials(account, secret) {
    if (normalizeAccount(account) !== EXPECTED_ACCOUNT) {
      return { ok: false, message: `账号须为 ${EXPECTED_ACCOUNT}` };
    }
    if (!String(secret || "").trim()) {
      return { ok: false, message: "请输入密钥" };
    }
    return { ok: true };
  }

  function applySession(secret) {
    const key = String(secret || "").trim();
    window.DEEPSEEK_CONFIG = window.DEEPSEEK_CONFIG || {};
    window.DEEPSEEK_CONFIG.apiKey = key;
    loggedIn = true;
  }

  function saveSession(account, secret, remember) {
    const accountNorm = normalizeAccount(account);
    const secretTrim = String(secret || "").trim();
    sessionStorage.setItem(STORAGE_ACCOUNT, accountNorm);
    sessionStorage.setItem(STORAGE_SECRET, secretTrim);
    if (remember) {
      localStorage.setItem(STORAGE_REMEMBER, "1");
      localStorage.setItem(STORAGE_ACCOUNT, accountNorm);
      localStorage.setItem(STORAGE_SECRET, secretTrim);
    } else {
      localStorage.removeItem(STORAGE_REMEMBER);
      localStorage.removeItem(STORAGE_ACCOUNT);
      localStorage.removeItem(STORAGE_SECRET);
    }
  }

  function clearSession() {
    sessionStorage.removeItem(STORAGE_ACCOUNT);
    sessionStorage.removeItem(STORAGE_SECRET);
    localStorage.removeItem(STORAGE_REMEMBER);
    localStorage.removeItem(STORAGE_ACCOUNT);
    localStorage.removeItem(STORAGE_SECRET);
    if (window.DEEPSEEK_CONFIG) {
      delete window.DEEPSEEK_CONFIG.apiKey;
    }
    loggedIn = false;
  }

  function tryRestore() {
    const remember = localStorage.getItem(STORAGE_REMEMBER) === "1";
    const store = remember ? localStorage : sessionStorage;
    const account = store.getItem(STORAGE_ACCOUNT);
    const secret = store.getItem(STORAGE_SECRET);
    if (!account || !secret) {
      return false;
    }
    const check = validateCredentials(account, secret);
    if (!check.ok) {
      return false;
    }
    applySession(secret);
    return true;
  }

  function login(account, secret, remember) {
    const check = validateCredentials(account, secret);
    if (!check.ok) {
      return check;
    }
    saveSession(account, secret, remember);
    applySession(secret);
    return { ok: true };
  }

  function logout() {
    clearSession();
    showGate();
  }

  function isLoggedIn() {
    return loggedIn && Boolean(getApiKey());
  }

  function getApiKey() {
    return String(window.DEEPSEEK_CONFIG?.apiKey || "").trim();
  }

  function setGateVisible(visible) {
    const gate = document.getElementById("loginGate");
    if (!gate) {
      return;
    }
    gate.hidden = !visible;
    document.body.classList.toggle("login-locked", visible);
  }

  function showGate() {
    setGateVisible(true);
    const err = document.getElementById("loginError");
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
  }

  function hideGate() {
    setGateVisible(false);
  }

  function showLoginError(message) {
    const err = document.getElementById("loginError");
    if (!err) {
      return;
    }
    err.textContent = message;
    err.hidden = false;
  }

  function bindUi() {
    const form = document.getElementById("loginForm");
    const accountEl = document.getElementById("loginAccount");
    const secretEl = document.getElementById("loginSecret");
    const rememberEl = document.getElementById("loginRemember");
    const logoutBtn = document.getElementById("logoutBtn");

    if (accountEl && !accountEl.value) {
      accountEl.value = EXPECTED_ACCOUNT;
    }

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const result = login(
        accountEl?.value,
        secretEl?.value,
        Boolean(rememberEl?.checked)
      );
      if (!result.ok) {
        showLoginError(result.message);
        return;
      }
      hideGate();
      window.PomDebug?.logLocal("已登录", `账号 ${EXPECTED_ACCOUNT}（密钥仅存本机）`);
      document.dispatchEvent(new CustomEvent("pom-auth-login"));
    });

    logoutBtn?.addEventListener("click", () => {
      logout();
      window.PomDebug?.logLocal("已退出登录");
      if (secretEl) {
        secretEl.value = "";
      }
      document.dispatchEvent(new CustomEvent("pom-auth-logout"));
    });
  }

  function init() {
    bindUi();
    if (tryRestore()) {
      hideGate();
      window.PomDebug?.logLocal("已从本机恢复登录");
    } else {
      showGate();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.PomAuth = {
    EXPECTED_ACCOUNT,
    validateCredentials,
    login,
    logout,
    tryRestore,
    isLoggedIn,
    getApiKey,
    showGate,
    hideGate,
  };
})();
