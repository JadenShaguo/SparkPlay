import { describe, expect, it } from "vitest";
import { validatePlayableContract } from "@/lib/playable-contract";
import { generatePlayable } from "@/lib/playable-generator";

describe("validatePlayableContract", () => {
  it("accepts generated playables with a goal, interaction, feedback, state, end state and restart", () => {
    const playable = generatePlayable({
      prompt: "做一个点击跳跃躲避障碍的跑酷小游戏",
      mode: "direct"
    });

    const report = validatePlayableContract({
      html: playable.html,
      manifest: playable.manifest
    });

    expect(report.valid).toBe(true);
    expect(report.checks.every((check) => check.passed)).toBe(true);
  });

  it("rejects html without a restart path and end state", () => {
    const report = validatePlayableContract({
      html: `<!DOCTYPE html><html><body><button onclick="score++">点击</button><script>let score=0</script></body></html>`,
      manifest: {
        title: "坏例子",
        description: "点击按钮",
        category: "toy",
        tags: ["测试"],
        controls: ["点击"],
        assetRefs: [],
        sourcePrompt: "坏例子",
        safetyStatus: "approved"
      }
    });

    expect(report.valid).toBe(false);
    expect(report.checks.find((check) => check.key === "restart")?.passed).toBe(false);
    expect(report.checks.find((check) => check.key === "endState")?.passed).toBe(false);
  });
});
