#!/usr/bin/env node
/** A4: followup 短拒白名单 */

const DEFLECT_REPLY_RE =
  /你心里|心里清楚|别装|你该去问|去问陈四|问太多|反倒可疑|爱信不信|不护谁|疑心太重|随你|误事|少说|废话|挡话|栽我身上/;

const FOLLOWUP_SHORT_ACCEPT_RE =
  /谁都不保|谁都不护|不关我事|与你无关|查账本是我|别挡|少管|少兜|来意|套话|谈事|你自己的事|与我何干|爱咋咋|随你便/;

function isFollowupShortAccept(text) {
  const t = String(text || "").trim();
  return t.length >= 2 && t.length <= 20 && FOLLOWUP_SHORT_ACCEPT_RE.test(t);
}

function isDeflectReply(text, pickIntent) {
  const t = String(text || "").trim();
  if (pickIntent === "followup" && isFollowupShortAccept(t)) {
    return false;
  }
  return DEFLECT_REPLY_RE.test(t);
}

const samples = [
  { line: "谁都不保。", intent: "followup", accept: true },
  { line: "查账本是我自己的事。", intent: "followup", accept: true },
  { line: "与你无关。", intent: "followup", accept: true },
  { line: "你心里清楚。", intent: "followup", accept: false },
  { line: "你心里清楚。", intent: "keypoint", accept: false },
  { line: "随你。", intent: "keypoint", accept: false },
];

for (const s of samples) {
  const deflect = isDeflectReply(s.line, s.intent);
  const ok = s.accept ? !deflect : deflect;
  if (!ok) {
    console.error(`whitelist fail: "${s.line}" intent=${s.intent} accept=${s.accept}`);
    process.exit(1);
  }
}

console.log("verify-followup-whitelist: ok");
