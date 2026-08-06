import type { AssetRef, GenerationMode } from "@/types/domain";
import { generateWithLlmGateway } from "@/lib/llm-provider";
import { generatePlayable } from "@/lib/playable-generator";
import { completeRun, createRun, getProject, getVersion, persistGeneratedVersion, readArtifact } from "@/lib/store";
import { validateHtml } from "@/lib/validation";

export async function runGeneration(input: {
  prompt: string;
  mode: GenerationMode;
  assets?: AssetRef[];
  projectId?: string;
}) {
  const run = await createRun({
    projectId: input.projectId ?? "pending",
    mode: input.mode,
    prompt: input.prompt
  });
  const playable =
    (await generateWithLlmGateway({
      prompt: input.prompt,
      mode: input.mode,
      assets: input.assets
    })) ??
    generatePlayable({
      prompt: input.prompt,
      mode: input.mode,
      assets: input.assets
    });
  const validationReport = validateHtml(playable.html);
  const persisted = await persistGeneratedVersion({
    projectId: input.projectId,
    title: playable.manifest.title,
    description: playable.manifest.description,
    html: playable.html,
    prompt: input.prompt,
    manifest: playable.manifest,
    validationReport,
    runId: run.id,
    parentVersionIds: [],
    sourceKind: "generate"
  });
  const completedRun = await completeRun(run.id, {
    status: validationReport.valid ? "success" : "failed",
    htmlBytes: Buffer.byteLength(playable.html, "utf8"),
    validationFailures: validationReport.issues.length,
    repairCount: playable.repaired ? 1 : 0
  });
  return {
    ...persisted,
    run: completedRun,
    html: playable.html
  };
}

export async function runRemix(input: {
  projectId: string;
  versionId?: string;
  prompt: string;
  assets?: AssetRef[];
}) {
  const project = await getProject(input.projectId);
  if (!project) throw new Error("Project not found");
  const baseVersion = await getVersion(input.projectId, input.versionId ?? project.currentVersionId);
  if (!baseVersion) throw new Error("Version not found");
  const baseHtml = await readArtifact(baseVersion);
  const run = await createRun({
    projectId: project.id,
    mode: "remix",
    prompt: input.prompt
  });
  const playable =
    (await generateWithLlmGateway({
      prompt: input.prompt,
      mode: "remix",
      assets: input.assets?.length ? input.assets : baseVersion.manifest.assetRefs,
      baseHtml,
      remixOf: {
        projectId: project.id,
        versionId: baseVersion.id
      }
    })) ??
    generatePlayable({
      prompt: `${baseVersion.prompt}\n\nRemix: ${input.prompt}`,
      mode: "remix",
      assets: input.assets?.length ? input.assets : baseVersion.manifest.assetRefs,
      baseHtml,
      remixOf: {
        projectId: project.id,
        versionId: baseVersion.id
      }
    });
  const validationReport = validateHtml(playable.html);
  const persisted = await persistGeneratedVersion({
    projectId: project.id,
    title: playable.manifest.title,
    description: playable.manifest.description,
    html: playable.html,
    prompt: input.prompt,
    manifest: playable.manifest,
    validationReport,
    runId: run.id,
    parentVersionIds: [baseVersion.id],
    sourceKind: "remix"
  });
  const completedRun = await completeRun(run.id, {
    status: validationReport.valid ? "success" : "failed",
    htmlBytes: Buffer.byteLength(playable.html, "utf8"),
    validationFailures: validationReport.issues.length,
    repairCount: playable.repaired ? 1 : 0
  });
  return {
    ...persisted,
    run: completedRun,
    html: playable.html
  };
}
