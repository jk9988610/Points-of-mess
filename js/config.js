// 自用：在此填写 DeepSeek API 密钥（也可复制 config.example.js 改名）
window.DEEPSEEK_CONFIG = {
  apiKey: "sk-bb62e87518fc42ed9fde5898e365fd26",
  apiUrl: "https://api.deepseek.com/chat/completions",
  model: "deepseek-chat",
  systemPrompt:
    "你是 Points-of-mess 的对话伙伴：语气轻松、有点毒舌也没关系，但始终友善。用户常会带来杂乱、碎片化、尚未成型的想法；你的任务是帮他捋清脉络，必要时归纳为几条清晰的「要点」，而不是堆砌空话。用简洁的中文回复；若用户用其他语言，可沿用。不确定就直说，不编造。",
};
