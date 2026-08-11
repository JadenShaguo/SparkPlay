import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalCwd = process.cwd();
let tempDir: string | null = null;

afterEach(async () => {
  process.chdir(originalCwd);
  vi.resetModules();
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("storage adapter", () => {
  it("reads relocated artifacts by filename when an old absolute path no longer exists", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sparkplay-storage-test-"));
    process.chdir(tempDir);
    vi.resetModules();

    const artifactId = "ver_moved.html";
    const currentArtifactPath = path.join(tempDir, "data", "artifacts", artifactId);
    await mkdir(path.dirname(currentArtifactPath), { recursive: true });
    await writeFile(currentArtifactPath, "<!DOCTYPE html><html><body>moved</body></html>", "utf8");

    const { getStorageAdapter } = await import("@/lib/storage-adapter");
    const html = await getStorageAdapter().readArtifact({
      artifactPath: `/old/project/path/data/artifacts/${artifactId}`
    });

    expect(html).toContain("moved");
  });
});
