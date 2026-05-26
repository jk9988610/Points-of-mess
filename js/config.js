// 公开配置：不含 API 密钥。登录后在浏览器内写入 apiKey（见 js/auth.js）
window.DEEPSEEK_CONFIG = {
  apiUrl: "https://api.deepseek.com/chat/completions",
  model: "deepseek-chat",
  temperature: 0.6,
  maxTokens: 80,
};
