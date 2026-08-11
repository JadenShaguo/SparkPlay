import type { PlayableManifest, SafetyStatus } from "@/types/domain";

export interface ModerationPrecheck {
  status: SafetyStatus;
  reasons: string[];
}

const blockedTextPatterns = [
  { pattern: /自残|自杀|suicide|self-harm/i, reason: "涉及自伤或自杀内容" },
  { pattern: /仇恨|种族清洗|纳粹|nazi/i, reason: "涉及仇恨或极端主义内容" },
  { pattern: /色情|成人内容|porn|sex/i, reason: "涉及成人或色情内容" },
  { pattern: /赌博|casino|betting/i, reason: "涉及赌博内容" },
  { pattern: /盗取|钓鱼|phishing|steal password/i, reason: "涉及欺诈或窃取信息" }
];

export function moderationPrecheck(input: {
  prompt: string;
  html: string;
  manifest: PlayableManifest;
}): ModerationPrecheck {
  const source = [input.prompt, input.manifest.title, input.manifest.description, input.manifest.tags.join(" "), input.html].join("\n");
  const reasons = blockedTextPatterns
    .filter((item) => item.pattern.test(source))
    .map((item) => item.reason);
  return {
    status: reasons.length > 0 ? "blocked" : "approved",
    reasons
  };
}
