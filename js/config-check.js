(function () {
  const HELP =
    "请先登录：账号 " +
    (window.PomAuth?.EXPECTED_ACCOUNT || "jk9988610") +
    "，密钥填你的 DeepSeek API Key（由浏览器记住，不会出现在仓库里）。";

  function getConfigStatus() {
    if (!window.PomAuth?.isLoggedIn?.()) {
      return { ok: false, reason: "login", message: HELP };
    }
    const key = window.PomAuth.getApiKey();
    if (!key) {
      return { ok: false, reason: "login", message: HELP };
    }
    return { ok: true };
  }

  window.PomConfig = {
    getConfigStatus,
    getSetupMessage() {
      return getConfigStatus().message || HELP;
    },
  };
})();
