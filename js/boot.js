/**
 * 按 POM_VERSION 顺序加载其余脚本（改版本只改 js/version.js）。
 * 须紧接在 version.js 之后同步引入。
 */
(function () {
  const v = encodeURIComponent(window.POM_VERSION || "0");
  const scripts = [
    "config.js",
    "auth.js",
    "config-check.js",
    "debug-copy-prefs.js",
    "debug.js",
    "presets.js",
    "proof-intents.js",
    "proof-pool.js",
    "proof-bootstrap.js",
    "onion.js",
    "dialogue.js",
    "memory-chat.js",
    "summary.js",
    "evidence.js",
    "state.js",
    "map.js",
    "json-parse.js",
    "desktop.js",
    "api.js",
    "api-retry.js",
    "tokens.js",
    "options-ai.js",
    "app.js",
  ];
  for (let i = 0; i < scripts.length; i++) {
    document.write(`<script src="js/${scripts[i]}?v=${v}"><\/script>`);
  }
})();
