import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalCwd = process.cwd();
const originalEnv = { ...process.env };
let tempDir: string | null = null;

afterEach(async () => {
  process.chdir(originalCwd);
  process.env = { ...originalEnv };
  vi.resetModules();
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("SparkPlay workflows", () => {
  it("fails fast when postgres adapter is selected without DATABASE_URL", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sparkplay-test-"));
    process.chdir(tempDir);
    process.env.SPARKPLAY_DATA_ADAPTER = "postgres";
    delete process.env.DATABASE_URL;
    vi.resetModules();

    const store = await import("@/lib/store");
    await expect(store.listProjects()).rejects.toThrow("DATABASE_URL");
  });

  it("fails fast when bullmq queue is selected without REDIS_URL", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sparkplay-test-"));
    process.chdir(tempDir);
    process.env.SPARKPLAY_QUEUE_ADAPTER = "bullmq";
    delete process.env.REDIS_URL;
    vi.resetModules();

    const [queue, store] = await Promise.all([
      import("@/lib/generation-queue"),
      import("@/lib/store")
    ]);
    await expect(
      queue.enqueueGeneration({
        prompt: "做一个点击按钮收集星星的互动玩具",
        mode: "direct"
      })
    ).rejects.toThrow("REDIS_URL");
    expect(await store.getDashboardStats()).toEqual({
      projectCount: 0,
      versionCount: 0,
      shareCount: 0,
      remixCount: 0
    });
  });

  it("generates, remixes, shares, records play events, forks and rolls back", async () => {
    const modules = await loadIsolatedModules();
    const generated = await modules.workflows.runGeneration({
      prompt: "做一个点击跳跃躲避障碍的跑酷小游戏",
      mode: "direct",
      ownerId: "user_demo"
    });

    expect(generated.run.status).toBe("success");
    expect(generated.version.validationReport.valid).toBe(true);
    expect(["skipped", "passed"]).toContain(generated.version.smokeReport?.status);
    expect(generated.version.thumbnailKey).toBeTruthy();
    await expect(access(generated.version.thumbnailKey!)).resolves.toBeUndefined();

    const generationResult = await modules.store.getGenerationResult(generated.run.id);
    expect(generationResult.project?.id).toBe(generated.project.id);
    expect(generationResult.html).toContain("<!DOCTYPE html>");

    const remixed = await modules.workflows.runRemix({
      projectId: generated.project.id,
      versionId: generated.version.id,
      prompt: "把背景换成星空，速度更快"
    });
    expect(remixed.run.status).toBe("success");
    expect(remixed.version.parentVersionIds).toContain(generated.version.id);

    const remixLineage = await modules.store.getProjectLineage(generated.project.id);
    expect(remixLineage.descendants).toHaveLength(1);
    expect(remixLineage.descendants[0].toVersionId).toBe(remixed.version.id);

    const share = await modules.store.createShareLink(remixed.project.id, remixed.version.id);
    expect((await modules.store.getProject(remixed.project.id))?.visibility).toBe("unlisted");
    expect(await modules.store.listPublicProjects()).toHaveLength(0);
    await modules.store.setProjectVisibility(remixed.project.id, "public");
    expect(await modules.store.listPublicProjects()).toHaveLength(1);
    const publicCards = await modules.store.listPublicProjectCards("latest");
    expect(publicCards[0].author.id).toBe("user_demo");
    expect(publicCards[0].shareSlug).toBe(share.slug);
    await modules.store.recordShareOpen(share.slug);
    await modules.store.recordSharePlayStart(share.slug);
    await modules.store.recordSharePlayComplete(share.slug);

    const updatedShare = await modules.store.getShareBySlug(share.slug);
    expect(updatedShare?.opens).toBe(1);
    expect(updatedShare?.playStarts).toBe(1);
    expect(updatedShare?.playCompletes).toBe(1);

    await modules.store.ensureUser({
      id: "user_guest",
      name: "Guest Creator",
      avatarColor: "#6d5dfc"
    });
    const forkedProject = await modules.store.forkShare(share.slug, "user_guest");
    expect(forkedProject.ownerId).toBe("user_guest");
    expect(forkedProject.remixOf).toEqual({
      projectId: remixed.project.id,
      versionId: remixed.version.id
    });
    expect(await modules.store.listProjects("user_demo")).toHaveLength(1);
    expect(await modules.store.listProjects("user_guest")).toHaveLength(1);

    const stats = await modules.store.getDashboardStats();
    expect(stats.remixCount).toBe(2);
    const demoStats = await modules.store.getDashboardStats("user_demo");
    expect(demoStats.projectCount).toBe(1);

    const demoProfile = await modules.store.getUserProfile("user_demo");
    expect(demoProfile?.stats.publicProjectCount).toBe(1);
    expect(demoProfile?.publicProjects[0].project.id).toBe(remixed.project.id);

    const forkLineage = await modules.store.getProjectLineage(forkedProject.id);
    expect(forkLineage.ancestors).toHaveLength(1);
    expect(forkLineage.ancestors[0].fromVersionId).toBe(remixed.version.id);

    await modules.store.setProjectVisibility(remixed.project.id, "private");
    expect(await modules.store.listPublicProjects()).toHaveLength(0);
    await expect(modules.store.forkShare(share.slug)).rejects.toThrow("private");

    const rolledBack = await modules.store.rollbackVersion(remixed.project.id, generated.version.id);
    expect(rolledBack.version.sourceKind).toBe("rollback");
    expect(rolledBack.version.parentVersionIds).toEqual([generated.version.id]);
  });

  it("queues generation and resolves the persisted result by run id", async () => {
    const modules = await loadIsolatedModules();
    const run = await modules.queue.enqueueGeneration({
      prompt: "做一个点击按钮收集星星的互动玩具",
      mode: "direct"
    });

    expect(run.status).toBe("queued");

    const result = await waitForGenerationResult(modules.store, run.id);
    expect(result.run?.status).toBe("success");
    expect(result.project?.title).toContain("点击按钮收集星星");
    expect(result.version?.generationRunId).toBe(run.id);
    expect(result.html).toContain("<!DOCTYPE html>");
  });

  it("imports valid external html as an immutable version", async () => {
    const modules = await loadIsolatedModules();
    const html = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width" /></head>
<body><button id="play">Play</button><script>document.getElementById("play").addEventListener("click",()=>{})</script></body></html>`;
    const validationReport = modules.validation.validateHtml(html);
    const imported = await modules.store.importHtml({
      title: "导入测试",
      html,
      validationReport
    });

    expect(imported.version.sourceKind).toBe("import");
    expect(imported.version.validationReport.valid).toBe(true);
    expect(imported.version.smokeReport?.status).toBe("skipped");
    expect(imported.version.thumbnailKey).toBeTruthy();
    await expect(access(imported.version.thumbnailKey!)).resolves.toBeUndefined();

    const persistedHtml = await modules.store.readArtifact(imported.version);
    expect(persistedHtml).toBe(html);
  });
});

async function loadIsolatedModules() {
  tempDir = await mkdtemp(path.join(tmpdir(), "sparkplay-test-"));
  process.chdir(tempDir);
  delete process.env.SPARKPLAY_LLM_CONFIG_SOURCE;
  delete process.env.SPARKPLAY_LLM_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SPARKPLAY_QUEUE_ADAPTER;
  delete process.env.REDIS_URL;
  vi.resetModules();
  const [workflows, store, queue, validation] = await Promise.all([
    import("@/lib/workflows"),
    import("@/lib/store"),
    import("@/lib/generation-queue"),
    import("@/lib/validation")
  ]);
  return { workflows, store, queue, validation };
}

async function waitForGenerationResult(store: Awaited<ReturnType<typeof loadIsolatedModules>>["store"], runId: string) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const result = await store.getGenerationResult(runId);
    if (result.run?.status === "success" || result.run?.status === "failed") {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Queued generation did not finish");
}
