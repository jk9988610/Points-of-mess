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
    if (start === -1) {
      return null;
    }
    const end = text.lastIndexOf("}");
    if (end > start) {
      return text.slice(start, end + 1);
    }
    return text.slice(start);
  }

  function repairJsonString(json) {
    let s = json;
    s = s.replace(/[\u201c\u201d\u2018\u2019]/g, '"');
    s = s.replace(/,\s*([}\]])/g, "$1");
    const openBrace = (s.match(/{/g) || []).length;
    const closeBrace = (s.match(/}/g) || []).length;
    if (openBrace > closeBrace) {
      s += "}".repeat(openBrace - closeBrace);
    }
    const openBracket = (s.match(/\[/g) || []).length;
    const closeBracket = (s.match(/]/g) || []).length;
    if (openBracket > closeBracket) {
      s += "]".repeat(openBracket - closeBracket);
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
    const intentRe =
      /"intent"\s*:\s*"(keypoint|followup|close|pause)"\s*,\s*"line"\s*:\s*"((?:\\.|[^"\\])*)"/g;
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
    for (let i = 0; i < attempts.length; i++) {
      const candidate = attempts[i];
      try {
        const parsed = JSON.parse(candidate);
        if (i > 0) {
          window.PomDebug?.logLocalWarn("JSON 自动修复", "已补全缺失 } 或 ] 后解析成功");
        }
        return parsed;
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

  window.PomJson = { parseJsonObject, stripCodeFence, extractLooseObject, repairJsonString };
})();
