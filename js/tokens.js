/** API max_tokens 下限（输出侧）。对白仍由 system 限制 ≤40 字，此处避免 JSON 被截断。 */
(function () {
  /** true = 每轮先只要 reply，再单独生成 options（Plan Phase 3，避免合并 JSON 坏掉） */
  const USE_SPLIT_FIRST = true;

  window.PomTokens = {
    USE_SPLIT_FIRST,
    /** 采样温度（降温减幻觉与 JSON 重试） */
    TEMP_SUMMARY: 0.2,
    TEMP_OPTIONS: 0.4,
    TEMP_REPLY: 0.4,
    TEMP_BOOTSTRAP: 0.45,
    /** 开局：opening + 证明席 + 四轮选项 */
    BOOTSTRAP: 2048,
    /** 合并：reply + 4 options */
    COMBINED: 2048,
    COMBINED_CLOSE: 768,
    /** 仅生成深挖/推进选项（Phase B prompt 较长） */
    OPTIONS: 1280,
    /** 仅生成角色一句 */
    REPLY_ONLY: 768,
    /** 证明席摘要（A+ 档案标记，见 PLAN-summary-a-plus） */
    SUMMARY: 2048,
    /** 输入框自由问 */
    FREEFORM: 512,
    /** api.js 未指定时的默认 */
    DEFAULT: 512,
  };
})();
