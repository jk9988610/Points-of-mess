(function () {
  function stripCodeFence(text) {
    return String(text || "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  function sliceJsonObject(text) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) {
      return null;
    }
    return text.slice(start, end + 1);
  }

  function repairJsonString(json) {
    let s = json;
    s = s.replace(/[\u201c\u201d\u2018\u2019]/g, '"');
    s = s.replace(/,\s*([}\]])/g, "$1");
    const opens = (s.match(/{/g) || []).length;
    const closes = (s.match(/}/g) || []).length;
    if (opens > closes) {
      s += "}".repeat(opens - closes);
    }
    return s;
  }

  function extractLooseObject(raw) {
    const text = stripCodeFence(raw);
    const replyMatch = text.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/);
    const reply = replyMatch
      ? replyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim()
      : "";

    const options = [];
    const intentRe = /"intent"\s*:\s*"(keypoint|followup|close)"\s*,\s*"line"\s*:\s*"((?:\\.|[^"\\])*)"/g;
    let m;
    while ((m = intentRe.exec(text)) !== null) {
      options.push({
        intent: m[1],
        line: m[2].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim(),
      });
    }

    if (!reply && options.length === 0) {
      return null;
    }
    return { reply, options };
  }

  function parseJsonObject(raw) {
    const text = stripCodeFence(raw);
    const slice = sliceJsonObject(text);
    if (!slice) {
      const loose = extractLooseObject(text);
      if (!loose) {
        throw new Error("未找到 JSON 对象");
      }
      return loose;
    }

    const attempts = [slice, repairJsonString(slice)];
    let lastError = null;
    for (const candidate of attempts) {
      try {
        return JSON.parse(candidate);
      } catch (e) {
        lastError = e;
      }
    }

    const loose = extractLooseObject(text);
    if (loose) {
      window.PomDebug?.logLocalWarn("JSON 宽松解析", lastError?.message || "repair");
      return loose;
    }
    throw lastError || new Error("JSON 解析失败");
  }

  window.PomJson = { parseJsonObject, stripCodeFence, extractLooseObject };
})();
