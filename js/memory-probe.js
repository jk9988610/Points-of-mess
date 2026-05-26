(function () {
  const ANIMALS = ["紫猫", "蓝鲸", "赤狐", "白枭", "玄蛇"];

  function createCodeword() {
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${animal}-${num}`;
  }

  const MEMORY_TEST_LINE =
    "【回忆测试】请逐字说出本会话首次 [memory_probe] 里的 codeword（本包不再附带 probe），再说一句角色台词。";

  function replyContainsCodeword(reply, codeword) {
    return String(reply || "").includes(codeword);
  }

  window.GameMemoryProbe = {
    createCodeword,
    MEMORY_TEST_LINE,
    replyContainsCodeword,
  };
})();
