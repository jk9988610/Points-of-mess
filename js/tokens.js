/** API max_tokens 下限（输出侧）。对白仍由 system 限制 ≤40 字，此处避免 JSON 被截断。 */
(function () {
  /** true = 每轮先只要 reply，再单独生成 options（Plan Phase 3，避免合并 JSON 坏掉） */
  const USE_SPLIT_FIRST = true;

  window.PomTokens = {
    USE_SPLIT_FIRST,
    /** 合并：reply + 4 options */
    COMBINED: 2048,
    COMBINED_CLOSE: 768,
    /** 仅生成深挖/推进选项（Phase B prompt 较长） */
    OPTIONS: 1280,
    /** 仅生成角色一句 */
    REPLY_ONLY: 768,
    /** 剧情摘要（宽摘要，见 PLAN-narrative Phase A） */
    SUMMARY: 2048,
    /** 输入框自由问 */
    FREEFORM: 512,
    /** api.js 未指定时的默认 */
    DEFAULT: 512,
  };
})();
