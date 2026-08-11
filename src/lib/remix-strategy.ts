import type { PlayableManifest } from "@/types/domain";
import type { GeneratedPlayable } from "@/lib/playable-generator";
import { escapeHtml } from "@/lib/validation";

export type RemixStrategy = "patch" | "rewrite";

const rewritePattern = /玩法|规则|机制|核心循环|改成.*(游戏|跑酷|问答|翻牌|剧情|生存)|换成.*(游戏|跑酷|问答|翻牌|剧情|生存)|重新生成|完全重做|从.*变成/;
const patchPattern = /背景|颜色|配色|色彩|标题|名字|名称|文案|难度|更难|简单|容易|速度|节奏|星空|霓虹|赛博|像素|粉色|蓝色|绿色|红色|紫色|黄色|黑色|白色/;

const colorMap: Array<{ pattern: RegExp; accent: string; surface: string; label: string }> = [
  { pattern: /粉色|粉红|pink/i, accent: "#f472b6", surface: "#2a1123", label: "粉色" },
  { pattern: /蓝色|海洋|blue/i, accent: "#38bdf8", surface: "#0d1b2a", label: "蓝色" },
  { pattern: /绿色|森林|green/i, accent: "#34d399", surface: "#0d2219", label: "绿色" },
  { pattern: /红色|热血|red/i, accent: "#fb7185", surface: "#2a1115", label: "红色" },
  { pattern: /紫色|梦幻|purple/i, accent: "#a78bfa", surface: "#1e1638", label: "紫色" },
  { pattern: /黄色|金色|yellow|gold/i, accent: "#facc15", surface: "#2b230d", label: "黄色" },
  { pattern: /黑色|暗黑|black|dark/i, accent: "#94a3b8", surface: "#07090f", label: "暗黑" },
  { pattern: /白色|明亮|white|light/i, accent: "#64748b", surface: "#f8fafc", label: "明亮" }
];

export function classifyRemixStrategy(prompt: string): RemixStrategy {
  if (rewritePattern.test(prompt)) return "rewrite";
  if (patchPattern.test(prompt)) return "patch";
  return "rewrite";
}

export function applyRemixPatch(input: {
  prompt: string;
  baseHtml: string;
  baseManifest: PlayableManifest;
  remixOf: NonNullable<PlayableManifest["remixOf"]>;
}): GeneratedPlayable | null {
  if (classifyRemixStrategy(input.prompt) !== "patch") return null;

  const patch = buildPatch(input.prompt);
  if (!patch.hasChanges) return null;

  const title = extractTitle(input.prompt) ?? input.baseManifest.title;
  let html = input.baseHtml;
  html = patchTitle(html, title);
  html = insertBefore(html, "</head>", `<style id="sparkplay-remix-patch">\n${patch.css}\n</style>`);
  if (patch.script) {
    html = insertBefore(html, "</body>", `<script id="sparkplay-remix-runtime-patch">\n${patch.script}\n</script>`);
  }

  return {
    html,
    repaired: false,
    manifest: {
      ...input.baseManifest,
      title,
      description: `${input.baseManifest.description} / Remix：${input.prompt}`.slice(0, 160),
      tags: Array.from(new Set([...input.baseManifest.tags, "remix", "patch"])),
      sourcePrompt: input.prompt,
      remixOf: input.remixOf,
      safetyStatus: "approved",
      plan: input.baseManifest.plan
        ? {
            ...input.baseManifest.plan,
            title,
            visualStyle: patch.visualStyle ?? input.baseManifest.plan.visualStyle,
            scoring: patch.scoring ?? input.baseManifest.plan.scoring
          }
        : input.baseManifest.plan
    }
  };
}

function buildPatch(prompt: string): {
  css: string;
  script: string;
  hasChanges: boolean;
  visualStyle?: string;
  scoring?: string;
} {
  const color = colorMap.find((item) => item.pattern.test(prompt));
  const wantsStars = /星空|宇宙|银河|star|space/i.test(prompt);
  const wantsNeon = /霓虹|赛博|neon|cyber/i.test(prompt);
  const wantsPixel = /像素|pixel/i.test(prompt);
  const difficulty = /更难|困难|提高难度|hard/i.test(prompt)
    ? "hard"
    : /简单|容易|降低难度|easy/i.test(prompt)
      ? "easy"
      : null;

  const accent = color?.accent ?? (wantsNeon ? "#22d3ee" : wantsStars ? "#a78bfa" : "#55ebb0");
  const surface = color?.surface ?? (wantsStars || wantsNeon ? "#080a16" : "#10151f");
  const cssParts: string[] = [];

  if (color || wantsStars || wantsNeon || wantsPixel || /背景|颜色|配色|色彩/i.test(prompt)) {
    cssParts.push(`:root{--sparkplay-remix-accent:${accent};--sparkplay-remix-surface:${surface}}`);
    cssParts.push(`body{background:${backgroundFor({ wantsStars, wantsNeon, surface })}!important}`);
    cssParts.push(`.phone,.panel,header{background:var(--sparkplay-remix-surface)!important;color:#f8fafc!important}`);
    cssParts.push(`h1,.result,.stat strong{color:#f8fafc!important}`);
    cssParts.push(`.sub,.muted{color:rgba(248,250,252,.72)!important}`);
    cssParts.push(`button{background:var(--sparkplay-remix-accent)!important;color:#06120f!important}`);
    cssParts.push(`.stat,.card,.option{background:rgba(255,255,255,.1)!important;color:#f8fafc!important}`);
  }

  if (wantsPixel) {
    cssParts.push(`*{image-rendering:pixelated!important;font-family:"Courier New",monospace!important}`);
  }

  if (difficulty) {
    cssParts.push(
      `html[data-sparkplay-remix-difficulty="${difficulty}"] .phone{box-shadow:0 24px 80px rgba(0,0,0,.35),0 0 0 1px var(--sparkplay-remix-accent)}`
    );
  }

  const script = difficulty
    ? `document.documentElement.dataset.sparkplayRemixDifficulty=${JSON.stringify(difficulty)};\nwindow.SPARKPLAY_REMIX_PATCH={difficulty:${JSON.stringify(difficulty)}};`
    : "";

  return {
    css: cssParts.join("\n"),
    script,
    hasChanges: cssParts.length > 0 || Boolean(script) || Boolean(extractTitle(prompt)),
    visualStyle: color || wantsStars || wantsNeon || wantsPixel ? `${color?.label ?? "视觉"} Remix 风格` : undefined,
    scoring: difficulty ? `难度已通过 Remix 标记为 ${difficulty === "hard" ? "更难" : "更简单"}。` : undefined
  };
}

function backgroundFor(input: { wantsStars: boolean; wantsNeon: boolean; surface: string }): string {
  if (input.wantsStars) {
    return "radial-gradient(circle at 20% 20%,rgba(255,255,255,.9) 0 1px,transparent 2px),radial-gradient(circle at 70% 30%,rgba(255,255,255,.7) 0 1px,transparent 2px),linear-gradient(180deg,#050816,#111827)";
  }
  if (input.wantsNeon) {
    return "radial-gradient(circle at 20% 10%,rgba(34,211,238,.28),transparent 30%),radial-gradient(circle at 80% 20%,rgba(244,114,182,.22),transparent 28%),#060814";
  }
  return `linear-gradient(180deg,${input.surface},#07090f)`;
}

function extractTitle(prompt: string): string | null {
  const match = prompt.match(/(?:标题|名字|名称)(?:改成|改为|叫|变成|换成)?[：:\s“"]*([^”"，,\n。.!！?？]{2,24})/);
  return match?.[1]?.trim() ?? null;
}

function patchTitle(html: string, title: string): string {
  const safeTitle = escapeHtml(title);
  let nextHtml = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  nextHtml = nextHtml.replace(/<h1\b([^>]*)>[\s\S]*?<\/h1>/i, `<h1$1>${safeTitle}</h1>`);
  return nextHtml;
}

function insertBefore(html: string, marker: string, insertion: string): string {
  const index = html.toLowerCase().lastIndexOf(marker);
  if (index < 0) return `${html}\n${insertion}`;
  return `${html.slice(0, index)}${insertion}\n${html.slice(index)}`;
}
