(function () {
  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const t = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(t);
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true }
        );
      }
    });
  }

  function isRetryableApiError(err) {
    if (!err || err.name === "AbortError") {
      return false;
    }
    const msg = String(err.message || "").toLowerCase();
    if (msg.includes("failed to fetch") || msg.includes("networkerror")) {
      return true;
    }
    if (msg.includes("timeout") || msg.includes("etimedout")) {
      return true;
    }
    if (/请求失败\s*\(\s*5\d\d\s*\)/.test(err.message || "")) {
      return true;
    }
    if (/请求失败\s*\(\s*429\s*\)/.test(err.message || "")) {
      return true;
    }
    return false;
  }

  /**
   * @param {string} label
   * @param {() => Promise<*>} fn
   * @param {{ retries?: number, baseMs?: number, signal?: AbortSignal }} opts
   */
  async function withApiRetries(label, fn, opts = {}) {
    const retries = opts.retries ?? 2;
    const baseMs = opts.baseMs ?? 1000;
    const signal = opts.signal;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn(attempt);
      } catch (e) {
        lastErr = e;
        if (!isRetryableApiError(e) || attempt >= retries) {
          throw e;
        }
        const wait = baseMs * Math.pow(2, attempt);
        window.PomDebug?.logLocalWarn(
          `${label} · 可重试`,
          `${e.message} · ${wait}ms 后第 ${attempt + 2} 次`,
          ["ui-warn", "api"]
        );
        await sleep(wait, signal);
      }
    }
    throw lastErr;
  }

  window.PomApiRetry = {
    sleep,
    isRetryableApiError,
    withApiRetries,
  };
})();
