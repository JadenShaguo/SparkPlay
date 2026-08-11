import { describe, expect, it } from "vitest";
import type { PlayableManifest } from "@/types/domain";
import { applyRemixPatch, classifyRemixStrategy } from "@/lib/remix-strategy";
import { validateHtml } from "@/lib/validation";

const baseHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>原始游戏</title>
</head>
<body>
  <div class="phone"><h1>原始游戏</h1><button id="play">开始</button></div>
  <script>document.getElementById("play")?.addEventListener("click",()=>window.parent?.postMessage({type:"sparkplay:playStart"},"*"));</script>
</body>
</html>`;

const baseManifest: PlayableManifest = {
  title: "原始游戏",
  description: "一个可玩的小游戏",
  category: "toy",
  tags: ["互动"],
  controls: ["点击交互"],
  sourcePrompt: "做一个小游戏",
  safetyStatus: "approved",
  assetRefs: [],
  plan: {
    title: "原始游戏",
    coreLoop: "点击按钮获得反馈。",
    goal: "完成互动。",
    controls: ["点击交互"],
    scoring: "连击计数。",
    states: ["idle", "playing", "completed"],
    endCondition: "达到目标后结束。",
    restartBehavior: "点击重置。",
    visualStyle: "默认风格"
  }
};

describe("remix strategy", () => {
  it("uses patch strategy for visual edits", () => {
    expect(classifyRemixStrategy("把背景换成星空，按钮变成紫色")).toBe("patch");
  });

  it("uses rewrite strategy for core gameplay changes", () => {
    expect(classifyRemixStrategy("把玩法改成跑酷游戏，新增障碍和跳跃")).toBe("rewrite");
  });

  it("patches simple remix instructions without breaking HTML validation", () => {
    const patched = applyRemixPatch({
      prompt: "把标题改成星空冲刺，并把背景换成星空",
      baseHtml,
      baseManifest,
      remixOf: { projectId: "project_a", versionId: "version_a" }
    });

    expect(patched).not.toBeNull();
    expect(patched?.html).toContain("sparkplay-remix-patch");
    expect(patched?.manifest.title).toBe("星空冲刺");
    expect(patched?.manifest.remixOf).toEqual({ projectId: "project_a", versionId: "version_a" });
    expect(validateHtml(patched!.html).valid).toBe(true);
  });
});
