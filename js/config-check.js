(function () {
  const HELP =
    "未配置 DeepSeek 密钥：将 js/config.example.js 复制为 js/config.js，把 apiKey 改成你的密钥后刷新本页。" +
    "（GitHub Pages 线上版默认没有该文件，请用本地打开 index.html，或在 gh-pages 分支单独放置 js/config.js。）";

  function getConfigStatus() {
    if (window.__POM_CONFIG_MISSING__ || typeof window.DEEPSEEK_CONFIG === "undefined") {
      return { ok: false, reason: "missing", message: HELP };
    }
    const key = String(window.DEEPSEEK_CONFIG.apiKey || "").trim();
    if (!key || key.includes("你的_")) {
      return {
        ok: false,
        reason: "placeholder",
        message:
          "js/config.js 中 apiKey 仍为占位符。请填入 DeepSeek API 密钥后保存并刷新本页。",
      };
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
