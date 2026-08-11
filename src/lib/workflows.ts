import type { AssetRef, GenerationMode, PlayableManifest, ValidationReport } from "@/types/domain";
import { generateWithLlmGateway } from "@/lib/llm-provider";
import { generatePlayable, type GeneratedPlayable } from "@/lib/playable-generator";
import { moderationPrecheck } from "@/lib/moderation";
import { ensurePlayablePlan, mergeContractReport, validatePlayableContract } from "@/lib/playable-contract";
import { runPlayableSmoke } from "@/lib/playwright-smoke";
import { applyRemixPatch } from "@/lib/remix-strategy";
import {
  attachVersionQuality,
  completeRun,
  createRun,
  getProject,
  getVersion,
  persistGeneratedVersion,
  readArtifact,
  recordRemixLineage,
  updateRunStatus,
  writeThumbnail
} from "@/lib/store";
import { validateHtml } from "@/lib/validation";

export async function runGeneration(input: {
  prompt: string;
  mode: GenerationMode;
  assets?: AssetRef[];
  projectId?: string;
  ownerId?: string;
  runId?: string;
}) {
  const run = input.runId
    ? await updateRunStatus(input.runId, "generating")
    : await createRun({
        projectId: input.projectId ?? "pending",
        mode: input.mode,
        prompt: input.prompt
      });
  try {
    let playable =
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
    await updateRunStatus(run.id, "validating");
    const prepared = await preparePlayableForPersistence({
      playable,
      prompt: input.prompt,
      fallback: () =>
        generatePlayable({
          prompt: input.prompt,
          mode: input.mode,
          assets: input.assets
        }),
      runId: run.id
    });
    playable = prepared.playable;
    const validationReport = prepared.validationReport;
    await updateRunStatus(run.id, validationReport.valid ? "persisting" : "repairing", {
      validationFailures: validationReport.issues.length,
      repairCount: prepared.repairCount
    });
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
      sourceKind: "generate",
      ownerId: input.ownerId,
      moderationReasons: prepared.moderationReasons
    });
    const thumbnailKey = await writeThumbnail(persisted.version.id, prepared.thumbnail.content, prepared.thumbnail.extension);
    const versionWithQuality = await attachVersionQuality({
      projectId: persisted.project.id,
      versionId: persisted.version.id,
      thumbnailKey,
      smokeReport: prepared.smokeReport
    });
    await updateRunStatus(run.id, "persisting", { projectId: persisted.project.id });
    const completedRun = await completeRun(run.id, {
      status: validationReport.valid ? "success" : "failed",
      htmlBytes: Buffer.byteLength(playable.html, "utf8"),
      validationFailures: validationReport.issues.length,
      repairCount: prepared.repairCount
    });
    return {
      project: persisted.project,
      version: versionWithQuality,
      run: completedRun,
      html: playable.html
    };
  } catch (error) {
    await completeRun(run.id, {
      status: "failed",
      htmlBytes: 0,
      validationFailures: 1,
      repairCount: 0,
      outputTokens: 0,
      error: error instanceof Error ? error.message : "生成失败"
    });
    throw error;
  }
}

export async function runRemix(input: {
  projectId: string;
  versionId?: string;
  prompt: string;
  assets?: AssetRef[];
  ownerId?: string;
  runId?: string;
}) {
  const project = await getProject(input.projectId);
  if (!project) throw new Error("Project not found");
  const baseVersion = await getVersion(input.projectId, input.versionId ?? project.currentVersionId);
  if (!baseVersion) throw new Error("Version not found");
  const baseHtml = await readArtifact(baseVersion);
  const run = input.runId
    ? await updateRunStatus(input.runId, "generating")
    : await createRun({
        projectId: project.id,
        mode: "remix",
        prompt: input.prompt
      });
  try {
    let playable =
      applyRemixPatch({
        prompt: input.prompt,
        baseHtml,
        baseManifest: baseVersion.manifest,
        remixOf: {
          projectId: project.id,
          versionId: baseVersion.id
        }
      }) ??
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
    await updateRunStatus(run.id, "validating");
    const prepared = await preparePlayableForPersistence({
      playable,
      prompt: input.prompt,
      fallback: () =>
        generatePlayable({
          prompt: `${baseVersion.prompt}\n\nRemix: ${input.prompt}`,
          mode: "remix",
          assets: input.assets?.length ? input.assets : baseVersion.manifest.assetRefs,
          baseHtml,
          remixOf: {
            projectId: project.id,
            versionId: baseVersion.id
          }
        }),
      runId: run.id
    });
    playable = prepared.playable;
    const validationReport = prepared.validationReport;
    await updateRunStatus(run.id, validationReport.valid ? "persisting" : "repairing", {
      validationFailures: validationReport.issues.length,
      repairCount: prepared.repairCount
    });
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
      sourceKind: "remix",
      ownerId: input.ownerId,
      moderationReasons: prepared.moderationReasons
    });
    const thumbnailKey = await writeThumbnail(persisted.version.id, prepared.thumbnail.content, prepared.thumbnail.extension);
    const versionWithQuality = await attachVersionQuality({
      projectId: persisted.project.id,
      versionId: persisted.version.id,
      thumbnailKey,
      smokeReport: prepared.smokeReport
    });
    await recordRemixLineage({
      fromProjectId: project.id,
      fromVersionId: baseVersion.id,
      toProjectId: persisted.project.id,
      toVersionId: persisted.version.id
    });
    const completedRun = await completeRun(run.id, {
      status: validationReport.valid ? "success" : "failed",
      htmlBytes: Buffer.byteLength(playable.html, "utf8"),
      validationFailures: validationReport.issues.length,
      repairCount: prepared.repairCount
    });
    return {
      project: persisted.project,
      version: versionWithQuality,
      run: completedRun,
      html: playable.html
    };
  } catch (error) {
    await completeRun(run.id, {
      status: "failed",
      htmlBytes: 0,
      validationFailures: 1,
      repairCount: 0,
      outputTokens: 0,
      error: error instanceof Error ? error.message : "Remix 失败"
    });
    throw error;
  }
}

async function preparePlayableForPersistence(input: {
  playable: GeneratedPlayable;
  prompt: string;
  fallback: () => GeneratedPlayable;
  runId: string;
}): Promise<{
  playable: GeneratedPlayable;
  validationReport: ValidationReport;
  smokeReport: Awaited<ReturnType<typeof runPlayableSmoke>>["report"];
  thumbnail: Awaited<ReturnType<typeof runPlayableSmoke>>["thumbnail"];
  moderationReasons: string[];
  repairCount: number;
}> {
  let playable = normalizePlayable(input.playable);
  let validationReport = validatePlayable(playable.html, playable.manifest);
  let repairCount = playable.repaired ? 1 : 0;

  if (!validationReport.valid) {
    await updateRunStatus(input.runId, "repairing", {
      validationFailures: validationReport.issues.length,
      repairCount: repairCount + 1
    });
    playable = normalizePlayable(input.fallback());
    repairCount += 1;
    validationReport = validatePlayable(playable.html, playable.manifest);
  }

  if (!validationReport.valid) {
    throw new Error(`Playable 未通过质量校验：${validationReport.issues.join("；")}`);
  }

  await updateRunStatus(input.runId, "smoking", {
    validationFailures: 0,
    repairCount
  });
  const smoke = await runPlayableSmoke({
    html: playable.html,
    manifest: playable.manifest
  });
  if (smoke.report.status === "failed") {
    throw new Error(`Playable smoke 失败：${smoke.report.issues.join("；")}`);
  }

  await updateRunStatus(input.runId, "moderating", {
    validationFailures: 0,
    repairCount
  });
  const moderation = moderationPrecheck({
    prompt: input.prompt,
    html: playable.html,
    manifest: playable.manifest
  });
  playable.manifest.safetyStatus = moderation.status;
  if (moderation.status === "blocked") {
    throw new Error(`内容审核预检未通过：${moderation.reasons.join("；")}`);
  }

  return {
    playable,
    validationReport,
    smokeReport: smoke.report,
    thumbnail: smoke.thumbnail,
    moderationReasons: moderation.reasons,
    repairCount
  };
}

function normalizePlayable(playable: GeneratedPlayable): GeneratedPlayable {
  playable.manifest.plan = ensurePlayablePlan(playable.manifest);
  return playable;
}

function validatePlayable(html: string, manifest: PlayableManifest) {
  const htmlReport = validateHtml(html);
  const contractReport = validatePlayableContract({ html, manifest });
  return mergeContractReport(htmlReport, contractReport);
}
