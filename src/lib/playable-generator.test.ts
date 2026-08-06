import { describe, expect, it } from "vitest";
import { generatePlayable } from "@/lib/playable-generator";
import { validateHtml } from "@/lib/validation";

describe("generatePlayable", () => {
  it("generates valid html for a runner prompt", () => {
    const playable = generatePlayable({
      prompt: "做一个点击跳跃躲避障碍的跑酷小游戏",
      mode: "direct"
    });

    expect(playable.manifest.category).toBe("runner");
    expect(validateHtml(playable.html).valid).toBe(true);
  });

  it("keeps remix lineage in manifest", () => {
    const playable = generatePlayable({
      prompt: "把场景改成火山喷发",
      mode: "remix",
      remixOf: { projectId: "p1", versionId: "v1" }
    });

    expect(playable.manifest.remixOf).toEqual({ projectId: "p1", versionId: "v1" });
  });
});
