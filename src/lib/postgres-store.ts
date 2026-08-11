import type { Prisma } from "@prisma/client";
import type {
  AnalyticsEventType,
  GenerationRun,
  GenerationRunStatus,
  PlayableManifest,
  PlayableVersion,
  Project,
  PublicProjectCard,
  RemixLineage,
  SmokeReport,
  ShareLink,
  User,
  UserProfile,
  ValidationReport
} from "@/types/domain";
import { createId, createSlug } from "@/lib/id";
import { fallbackThumbnailSvg } from "@/lib/playwright-smoke";
import { getPrismaClient } from "@/lib/prisma-client";
import { getStorageAdapter } from "@/lib/storage-adapter";

const demoUserId = "user_demo";

export async function ensureStore(): Promise<void> {
  await ensureDemoUser();
  await getStorageAdapter().ensure();
}

export async function ensureUser(input: Pick<User, "id" | "name" | "avatarColor">): Promise<User> {
  const prisma = getPrismaClient();
  const user = await prisma.user.upsert({
    where: { id: input.id },
    update: {
      name: input.name,
      avatarColor: input.avatarColor
    },
    create: {
      id: input.id,
      name: input.name,
      avatarColor: input.avatarColor
    }
  });
  return mapUser(user);
}

export async function getUser(userId: string): Promise<User | null> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? mapUser(user) : null;
}

export async function writeArtifact(versionId: string, html: string): Promise<string> {
  return getStorageAdapter().putArtifact(versionId, html);
}

export async function writeThumbnail(versionId: string, content: Buffer | string, extension: "png" | "svg"): Promise<string> {
  return getStorageAdapter().putThumbnail(versionId, content, extension);
}

export async function readArtifact(version: PlayableVersion): Promise<string> {
  return getStorageAdapter().readArtifact(version);
}

export async function readThumbnail(version: PlayableVersion): Promise<{ content: Buffer; contentType: string } | null> {
  if (!version.thumbnailKey) return null;
  return getStorageAdapter().readThumbnail(version.thumbnailKey);
}

export async function attachVersionQuality(input: {
  projectId: string;
  versionId: string;
  thumbnailKey?: string;
  smokeReport?: SmokeReport;
}): Promise<PlayableVersion> {
  const prisma = getPrismaClient();
  const current = await prisma.playableVersion.findFirst({
    where: { id: input.versionId, projectId: input.projectId }
  });
  if (!current) throw new Error("Version not found");
  const manifest = current.manifest as unknown as PlayableManifest;
  const version = await prisma.playableVersion.update({
    where: { id: input.versionId },
    data: {
      thumbnailKey: input.thumbnailKey ?? current.thumbnailKey,
      smokeReport: input.smokeReport ? toJson(input.smokeReport) : current.smokeReport == null ? undefined : toJson(current.smokeReport),
      manifest: input.thumbnailKey
        ? toJson({
            ...manifest,
            thumbnail: input.thumbnailKey
          })
        : toJson(manifest)
    }
  });
  return mapVersion(version);
}

export async function listProjects(ownerId?: string): Promise<Project[]> {
  const prisma = getPrismaClient();
  const projects = await prisma.project.findMany({
    where: ownerId ? { ownerId } : undefined,
    orderBy: { updatedAt: "desc" }
  });
  return projects.map(mapProject);
}

export async function listPublicProjects(): Promise<Project[]> {
  const prisma = getPrismaClient();
  const projects = await prisma.project.findMany({
    where: { visibility: "public" },
    orderBy: { updatedAt: "desc" }
  });
  return projects.map(mapProject);
}

export async function listPublicProjectCards(sort: "latest" | "remixed" | "played" = "latest"): Promise<PublicProjectCard[]> {
  const prisma = getPrismaClient();
  const projects = await prisma.project.findMany({
    where: { visibility: "public" },
    orderBy: { updatedAt: "desc" }
  });
  const cards = await Promise.all(projects.map((project) => buildPublicProjectCard(mapProject(project))));
  return sortProjectCards(cards, sort);
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const user = await getUser(userId);
  if (!user) return null;
  const cards = await listPublicProjectCards("latest");
  const publicProjects = cards.filter((card) => card.project.ownerId === userId);
  const remixProjects = publicProjects.filter((card) => Boolean(card.project.remixOf));
  return {
    user,
    stats: {
      publicProjectCount: publicProjects.length,
      remixProjectCount: remixProjects.length,
      totalShareOpens: publicProjects.reduce((sum, card) => sum + card.shareOpens, 0),
      totalRemixCount: publicProjects.reduce((sum, card) => sum + card.remixCount, 0)
    },
    publicProjects,
    remixProjects
  };
}

export async function getProject(projectId: string): Promise<Project | null> {
  const prisma = getPrismaClient();
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  return project ? mapProject(project) : null;
}

export async function setProjectVisibility(projectId: string, visibility: Project["visibility"]): Promise<Project> {
  const prisma = getPrismaClient();
  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      visibility,
      updatedAt: new Date()
    }
  });
  return mapProject(project);
}

export async function getProjectVersions(projectId: string): Promise<PlayableVersion[]> {
  const prisma = getPrismaClient();
  const versions = await prisma.playableVersion.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" }
  });
  return versions.map(mapVersion);
}

export async function getVersion(projectId: string, versionId: string): Promise<PlayableVersion | null> {
  const prisma = getPrismaClient();
  const version = await prisma.playableVersion.findFirst({
    where: { id: versionId, projectId }
  });
  return version ? mapVersion(version) : null;
}

export async function getGenerationRun(runId: string): Promise<GenerationRun | null> {
  const prisma = getPrismaClient();
  const run = await prisma.generationRun.findUnique({ where: { id: runId } });
  return run ? mapRun(run) : null;
}

export async function getGenerationResult(runId: string): Promise<{
  run: GenerationRun | null;
  project: Project | null;
  version: PlayableVersion | null;
  html: string;
}> {
  const prisma = getPrismaClient();
  const [run, version] = await Promise.all([
    prisma.generationRun.findUnique({ where: { id: runId } }),
    prisma.playableVersion.findFirst({ where: { generationRunId: runId } })
  ]);
  const project = version ? await prisma.project.findUnique({ where: { id: version.projectId } }) : null;
  const mappedVersion = version ? mapVersion(version) : null;
  const html = mappedVersion ? await readArtifact(mappedVersion) : "";
  return {
    run: run ? mapRun(run) : null,
    project: project ? mapProject(project) : null,
    version: mappedVersion,
    html
  };
}

export async function createRun(input: Pick<GenerationRun, "mode" | "prompt" | "projectId"> & {
  status?: GenerationRunStatus;
}): Promise<GenerationRun> {
  const prisma = getPrismaClient();
  const run: GenerationRun = {
    id: createId("run"),
    projectId: input.projectId,
    mode: input.mode,
    prompt: input.prompt,
    status: input.status ?? "running",
    startedAt: new Date().toISOString(),
    tokenUsage: {
      inputTokens: estimateTokens(input.prompt),
      outputTokens: 0,
      totalTokens: estimateTokens(input.prompt),
      requestCount: 1
    },
    validationFailures: 0,
    repairCount: 0,
    model: resolveRunModelLabel()
  };
  const saved = await prisma.generationRun.create({
    data: {
      id: run.id,
      projectId: run.projectId,
      mode: run.mode,
      prompt: run.prompt,
      status: run.status,
      startedAt: new Date(run.startedAt),
      tokenUsage: toJson(run.tokenUsage),
      validationFailures: run.validationFailures,
      repairCount: run.repairCount,
      model: run.model
    }
  });
  return mapRun(saved);
}

export async function updateRunStatus(
  runId: string,
  status: GenerationRunStatus,
  patch: Partial<Pick<GenerationRun, "projectId" | "error" | "validationFailures" | "repairCount">> = {}
): Promise<GenerationRun> {
  const prisma = getPrismaClient();
  const run = await prisma.generationRun.update({
    where: { id: runId },
    data: {
      ...patch,
      status,
      error: patch.error
    }
  });
  return mapRun(run);
}

export async function completeRun(
  runId: string,
  patch: Pick<GenerationRun, "status" | "htmlBytes" | "validationFailures" | "repairCount"> & {
    error?: string;
    outputTokens?: number;
  }
): Promise<GenerationRun> {
  const prisma = getPrismaClient();
  const current = await prisma.generationRun.findUnique({ where: { id: runId } });
  if (!current) throw new Error("Generation run not found");
  const completedAt = new Date();
  const outputTokens = patch.outputTokens ?? Math.ceil((patch.htmlBytes ?? 0) / 4);
  const tokenUsage = normalizeTokenUsage(current.tokenUsage);
  const run = await prisma.generationRun.update({
    where: { id: runId },
    data: {
      status: patch.status,
      htmlBytes: patch.htmlBytes,
      validationFailures: patch.validationFailures,
      repairCount: patch.repairCount,
      error: patch.error,
      completedAt,
      durationMs: completedAt.getTime() - current.startedAt.getTime(),
      firstPreviewMs: completedAt.getTime() - current.startedAt.getTime(),
      tokenUsage: toJson({
        ...tokenUsage,
        outputTokens,
        totalTokens: tokenUsage.inputTokens + outputTokens
      })
    }
  });
  return mapRun(run);
}

export async function persistGeneratedVersion(input: {
  projectId?: string;
  ownerId?: string;
  title: string;
  description: string;
  html: string;
  prompt: string;
  manifest: PlayableManifest;
  validationReport: ValidationReport;
  runId: string;
  parentVersionIds?: string[];
  sourceKind: PlayableVersion["sourceKind"];
  remixOf?: Project["remixOf"];
  moderationReasons?: string[];
}): Promise<{ project: Project; version: PlayableVersion }> {
  await ensureDemoUser();
  const prisma = getPrismaClient();
  const now = new Date();
  const project = input.projectId
    ? await prisma.project.findUnique({ where: { id: input.projectId } })
    : null;
  const projectId = project?.id ?? createId("prj");
  const versionId = createId("ver");
  const artifactPath = await writeArtifact(versionId, input.html);

  const saved = await prisma.$transaction(async (tx) => {
    if (project) {
      await tx.project.update({
        where: { id: project.id },
        data: {
          title: input.title,
          description: input.description,
          currentVersionId: versionId,
          updatedAt: now
        }
      });
    } else {
      await tx.project.create({
        data: {
          id: projectId,
          ownerId: input.ownerId ?? demoUserId,
          title: input.title,
          description: input.description,
          visibility: "private",
          currentVersionId: versionId,
          rootVersionId: versionId,
          savedAt: now,
          createdAt: now,
          updatedAt: now,
          remixOf: input.remixOf ? toJson(input.remixOf) : undefined
        }
      });
    }

    const version = await tx.playableVersion.create({
      data: {
        id: versionId,
        projectId,
        parentVersionIds: input.parentVersionIds ?? [],
        sourceKind: input.sourceKind,
        createdBy: "user",
        prompt: input.prompt,
        changeSummary: input.prompt,
        manifest: toJson(input.manifest),
        validationReport: toJson(input.validationReport),
        artifactPath,
        artifactKey: undefined,
        thumbnailKey: undefined,
        smokeReport: undefined,
        htmlBytes: Buffer.byteLength(input.html, "utf8"),
        generationRunId: input.runId,
        createdAt: now
      }
    });

    await tx.sessionMessage.createMany({
      data: [
        {
          id: createId("msg"),
          projectId,
          role: "user",
          content: input.prompt,
          createdAt: now
        },
        {
          id: createId("msg"),
          projectId,
          role: "assistant",
          content: `生成版本 ${version.id}`,
          versionId: version.id,
          createdAt: now
        }
      ]
    });
    await tx.moderationReview.create({
      data: {
        id: createId("mod"),
        projectId,
        versionId: version.id,
        status: input.manifest.safetyStatus,
        reasons: input.moderationReasons ?? [],
        createdAt: now
      }
    });

    const savedProject = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    return { project: savedProject, version };
  });

  return {
    project: mapProject(saved.project),
    version: mapVersion(saved.version)
  };
}

export async function importHtml(input: {
  projectId?: string;
  ownerId?: string;
  title: string;
  html: string;
  validationReport: ValidationReport;
}): Promise<{ project: Project; version: PlayableVersion }> {
  const run = await createRun({
    projectId: input.projectId ?? "pending",
    mode: "import",
    prompt: `导入 HTML：${input.title}`
  });
  const manifest: PlayableManifest = {
    title: input.title,
    description: "外部导入的 playable",
    category: "import",
    tags: ["导入"],
    controls: ["按作品内说明操作"],
    assetRefs: [],
    sourcePrompt: "imported html",
    safetyStatus: input.validationReport.valid ? "approved" : "blocked"
  };
  const persisted = await persistGeneratedVersion({
    projectId: input.projectId,
    title: input.title,
    description: manifest.description,
    html: input.html,
    prompt: "imported html",
    manifest,
    validationReport: input.validationReport,
    runId: run.id,
    parentVersionIds: [],
    sourceKind: "import",
    ownerId: input.ownerId
  });
  const thumbnailKey = await writeThumbnail(persisted.version.id, fallbackThumbnailSvg(manifest), "svg");
  const versionWithQuality = await attachVersionQuality({
    projectId: persisted.project.id,
    versionId: persisted.version.id,
    thumbnailKey,
    smokeReport: {
      status: "skipped",
      issues: [],
      warnings: ["HTML 导入版本使用 fallback thumbnail"],
      durationMs: 0,
      checkedAt: new Date().toISOString(),
      viewport: {
        width: 390,
        height: 844
      },
      consoleErrors: []
    }
  });
  await completeRun(run.id, {
    status: input.validationReport.valid ? "success" : "failed",
    htmlBytes: Buffer.byteLength(input.html, "utf8"),
    validationFailures: input.validationReport.issues.length,
    repairCount: 0,
    outputTokens: 0
  });
  return {
    project: persisted.project,
    version: versionWithQuality
  };
}

export async function rollbackVersion(projectId: string, versionId: string): Promise<{ project: Project; version: PlayableVersion }> {
  const prisma = getPrismaClient();
  const [project, target] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.playableVersion.findFirst({ where: { id: versionId, projectId } })
  ]);
  if (!project || !target) throw new Error("Project or version not found");

  const html = await readArtifact(mapVersion(target));
  const now = new Date();
  const newVersionId = createId("ver");
  const artifactPath = await writeArtifact(newVersionId, html);
  const saved = await prisma.$transaction(async (tx) => {
    const version = await tx.playableVersion.create({
      data: {
        id: newVersionId,
        projectId,
        parentVersionIds: [target.id],
        sourceKind: "rollback",
        createdBy: target.createdBy,
        prompt: target.prompt,
        changeSummary: `回滚到 ${target.id}`,
        manifest: toJson(target.manifest),
        validationReport: toJson(target.validationReport),
        artifactPath,
        artifactKey: target.artifactKey,
        thumbnailKey: target.thumbnailKey,
        smokeReport: target.smokeReport == null ? undefined : toJson(target.smokeReport),
        htmlBytes: target.htmlBytes,
        generationRunId: target.generationRunId,
        createdAt: now
      }
    });
    const updatedProject = await tx.project.update({
      where: { id: projectId },
      data: {
        currentVersionId: version.id,
        updatedAt: now
      }
    });
    await tx.sessionMessage.create({
      data: {
        id: createId("msg"),
        projectId,
        role: "assistant",
        content: `回滚到版本 ${target.id}`,
        versionId: version.id,
        createdAt: now
      }
    });
    return { project: updatedProject, version };
  });
  return { project: mapProject(saved.project), version: mapVersion(saved.version) };
}

export async function createShareLink(projectId: string, versionId: string): Promise<ShareLink> {
  const prisma = getPrismaClient();
  const [project, version] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.playableVersion.findFirst({ where: { id: versionId, projectId } })
  ]);
  if (!project || !version) throw new Error("Project or version not found");

  const existing = await prisma.shareLink.findFirst({ where: { projectId, versionId } });
  if (existing) return mapShare(existing);

  const now = new Date();
  const share = await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        visibility: "unlisted",
        updatedAt: now
      }
    });
    return tx.shareLink.create({
      data: {
        id: createId("shr"),
        slug: createSlug(),
        projectId,
        versionId,
        visibility: "unlisted",
        createdAt: now,
        opens: 0,
        playStarts: 0,
        playCompletes: 0,
        remixClicks: 0
      }
    });
  });
  return mapShare(share);
}

export async function recordRemixLineage(input: {
  fromProjectId: string;
  fromVersionId: string;
  toProjectId: string;
  toVersionId: string;
}): Promise<RemixLineage> {
  const prisma = getPrismaClient();
  const existing = await prisma.remixLineage.findFirst({ where: input });
  if (existing) return mapLineage(existing);
  const lineage = await prisma.remixLineage.create({
    data: {
      id: createId("lin"),
      ...input,
      createdAt: new Date()
    }
  });
  return mapLineage(lineage);
}

export async function getProjectLineage(projectId: string): Promise<{
  ancestors: RemixLineage[];
  descendants: RemixLineage[];
}> {
  const prisma = getPrismaClient();
  const [ancestors, descendants] = await Promise.all([
    prisma.remixLineage.findMany({
      where: { toProjectId: projectId },
      orderBy: { createdAt: "asc" }
    }),
    prisma.remixLineage.findMany({
      where: { fromProjectId: projectId },
      orderBy: { createdAt: "desc" }
    })
  ]);
  return {
    ancestors: ancestors.map(mapLineage),
    descendants: descendants.map(mapLineage)
  };
}

export async function getShareBySlug(slug: string): Promise<ShareLink | null> {
  const prisma = getPrismaClient();
  const share = await prisma.shareLink.findUnique({ where: { slug } });
  return share ? mapShare(share) : null;
}

export async function recordShareOpen(slug: string): Promise<void> {
  await recordShareEvent(slug, "shareOpen");
}

export async function recordSharePlayStart(slug: string): Promise<void> {
  await recordShareEvent(slug, "playStart");
}

export async function recordSharePlayComplete(slug: string): Promise<void> {
  await recordShareEvent(slug, "playComplete");
}

export async function recordShareEvent(slug: string, type: AnalyticsEventType): Promise<void> {
  const prisma = getPrismaClient();
  const share = await prisma.shareLink.findUnique({ where: { slug } });
  if (!share) return;
  const increments = {
    opens: type === "shareOpen" ? 1 : 0,
    playStarts: type === "playStart" ? 1 : 0,
    playCompletes: type === "playComplete" ? 1 : 0,
    remixClicks: type === "remixClick" ? 1 : 0
  };
  await prisma.$transaction([
    prisma.shareLink.update({
      where: { slug },
      data: {
        opens: { increment: increments.opens },
        playStarts: { increment: increments.playStarts },
        playCompletes: { increment: increments.playCompletes },
        remixClicks: { increment: increments.remixClicks }
      }
    }),
    prisma.analyticsEvent.create({
      data: {
        id: createId("evt"),
        type,
        shareSlug: slug,
        projectId: share.projectId,
        versionId: share.versionId,
        createdAt: new Date()
      }
    })
  ]);
}

export async function forkShare(slug: string, ownerId = demoUserId): Promise<Project> {
  const share = await getShareBySlug(slug);
  if (!share) throw new Error("Share link not found");

  const sourceProject = await getProject(share.projectId);
  const sourceVersion = await getVersion(share.projectId, share.versionId);
  if (!sourceProject || !sourceVersion) throw new Error("Shared project not found");
  if (sourceProject.visibility === "private") throw new Error("Shared project is private");
  await recordShareEvent(slug, "remixClick");
  const html = await readArtifact(sourceVersion);
  const run = await createRun({
    projectId: "pending",
    mode: "remix",
    prompt: `Fork from shared playable ${slug}`
  });
  const persisted = await persistGeneratedVersion({
    title: `${sourceProject.title} Remix`,
    description: sourceProject.description,
    html,
    prompt: `Fork from ${sourceVersion.prompt}`,
    manifest: {
      ...sourceVersion.manifest,
      title: `${sourceVersion.manifest.title} Remix`,
      remixOf: {
        projectId: sourceProject.id,
        versionId: sourceVersion.id
      }
    },
    validationReport: sourceVersion.validationReport,
    runId: run.id,
    parentVersionIds: [sourceVersion.id],
    sourceKind: "remix",
    ownerId,
    remixOf: {
      projectId: sourceProject.id,
      versionId: sourceVersion.id
    }
  });
  await completeRun(run.id, {
    status: "success",
    htmlBytes: sourceVersion.htmlBytes,
    validationFailures: 0,
    repairCount: 0,
    outputTokens: 0
  });

  await recordRemixLineage({
    fromProjectId: sourceProject.id,
    fromVersionId: sourceVersion.id,
    toProjectId: persisted.project.id,
    toVersionId: persisted.version.id
  });
  if (sourceVersion.thumbnailKey || sourceVersion.smokeReport) {
    await attachVersionQuality({
      projectId: persisted.project.id,
      versionId: persisted.version.id,
      thumbnailKey: sourceVersion.thumbnailKey,
      smokeReport: sourceVersion.smokeReport
    });
  }
  return persisted.project;
}

export async function getDashboardStats(ownerId?: string): Promise<{
  projectCount: number;
  versionCount: number;
  shareCount: number;
  remixCount: number;
}> {
  const prisma = getPrismaClient();
  const projects = ownerId
    ? await prisma.project.findMany({ where: { ownerId }, select: { id: true } })
    : await prisma.project.findMany({ select: { id: true } });
  const projectIds = projects.map((project) => project.id);
  const [versionCount, shareCount, remixCount] = await Promise.all([
    prisma.playableVersion.count({ where: { projectId: { in: projectIds } } }),
    prisma.shareLink.count({ where: { projectId: { in: projectIds } } }),
    prisma.remixLineage.count({
      where: {
        OR: [
          { fromProjectId: { in: projectIds } },
          { toProjectId: { in: projectIds } }
        ]
      }
    })
  ]);
  return { projectCount: projectIds.length, versionCount, shareCount, remixCount };
}

async function ensureDemoUser() {
  const prisma = getPrismaClient();
  await prisma.user.upsert({
    where: { id: demoUserId },
    update: {},
    create: {
      id: demoUserId,
      name: "Creator Demo",
      avatarColor: "#1f6b4a",
      createdAt: new Date(0)
    }
  });
}

async function buildPublicProjectCard(project: Project): Promise<PublicProjectCard> {
  const prisma = getPrismaClient();
  const [version, author, descendants, shares] = await Promise.all([
    prisma.playableVersion.findFirst({ where: { id: project.currentVersionId, projectId: project.id } }),
    prisma.user.findUnique({ where: { id: project.ownerId } }),
    prisma.remixLineage.count({ where: { fromProjectId: project.id } }),
    prisma.shareLink.findMany({ where: { projectId: project.id } })
  ]);

  let basedOn: PublicProjectCard["basedOn"];
  if (project.remixOf) {
    const [sourceProject, sourceVersion] = await Promise.all([
      prisma.project.findUnique({ where: { id: project.remixOf.projectId } }),
      prisma.playableVersion.findFirst({
        where: {
          id: project.remixOf.versionId,
          projectId: project.remixOf.projectId
        }
      })
    ]);
    const sourceAuthor = sourceProject
      ? await prisma.user.findUnique({ where: { id: sourceProject.ownerId } })
      : null;
    if (sourceProject && sourceAuthor) {
      basedOn = {
        project: mapProject(sourceProject),
        version: sourceVersion ? mapVersion(sourceVersion) : null,
        author: mapUser(sourceAuthor)
      };
    }
  }

  return {
    project,
    currentVersion: version ? mapVersion(version) : null,
    author: author ? mapUser(author) : {
      id: demoUserId,
      name: "Creator Demo",
      avatarColor: "#1f6b4a",
      createdAt: new Date(0).toISOString()
    },
    shareSlug: shares.find((share) => share.versionId === project.currentVersionId)?.slug ?? shares[0]?.slug,
    remixCount: descendants,
    shareOpens: shares.reduce((sum, share) => sum + share.opens, 0),
    basedOn
  };
}

function sortProjectCards(cards: PublicProjectCard[], sort: "latest" | "remixed" | "played"): PublicProjectCard[] {
  return [...cards].sort((a, b) => {
    if (sort === "remixed") return b.remixCount - a.remixCount || b.project.updatedAt.localeCompare(a.project.updatedAt);
    if (sort === "played") return b.shareOpens - a.shareOpens || b.project.updatedAt.localeCompare(a.project.updatedAt);
    return b.project.updatedAt.localeCompare(a.project.updatedAt);
  });
}

function mapUser(user: {
  id: string;
  name: string;
  avatarColor: string;
  createdAt: Date;
}): User {
  return {
    id: user.id,
    name: user.name,
    avatarColor: user.avatarColor,
    createdAt: user.createdAt.toISOString()
  };
}

function mapProject(project: {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: string;
  currentVersionId: string;
  rootVersionId: string;
  savedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  remixOf: unknown;
}): Project {
  return {
    id: project.id,
    ownerId: project.ownerId,
    title: project.title,
    description: project.description,
    visibility: project.visibility as Project["visibility"],
    currentVersionId: project.currentVersionId,
    rootVersionId: project.rootVersionId,
    savedAt: project.savedAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    remixOf: normalizeRemixOf(project.remixOf)
  };
}

function mapVersion(version: {
  id: string;
  projectId: string;
  parentVersionIds: string[];
  sourceKind: string;
  createdBy: string;
  prompt: string;
  changeSummary: string;
  manifest: unknown;
  validationReport: unknown;
  artifactPath: string;
  artifactKey: string | null;
  thumbnailKey: string | null;
  smokeReport: unknown;
  htmlBytes: number;
  generationRunId: string | null;
  createdAt: Date;
}): PlayableVersion {
  return {
    id: version.id,
    projectId: version.projectId,
    parentVersionIds: version.parentVersionIds,
    sourceKind: version.sourceKind as PlayableVersion["sourceKind"],
    createdBy: version.createdBy as PlayableVersion["createdBy"],
    prompt: version.prompt,
    changeSummary: version.changeSummary,
    manifest: version.manifest as unknown as PlayableManifest,
    validationReport: version.validationReport as unknown as ValidationReport,
    artifactPath: version.artifactPath,
    artifactKey: version.artifactKey ?? undefined,
    thumbnailKey: version.thumbnailKey ?? undefined,
    smokeReport: version.smokeReport == null ? undefined : (version.smokeReport as unknown as SmokeReport),
    htmlBytes: version.htmlBytes,
    generationRunId: version.generationRunId ?? undefined,
    createdAt: version.createdAt.toISOString()
  };
}

function mapRun(run: {
  id: string;
  projectId: string;
  mode: string;
  prompt: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  firstPreviewMs: number | null;
  tokenUsage: unknown;
  htmlBytes: number | null;
  validationFailures: number;
  repairCount: number;
  model: string;
  error: string | null;
}): GenerationRun {
  return {
    id: run.id,
    projectId: run.projectId,
    mode: run.mode as GenerationRun["mode"],
    prompt: run.prompt,
    status: run.status as GenerationRun["status"],
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString(),
    durationMs: run.durationMs ?? undefined,
    firstPreviewMs: run.firstPreviewMs ?? undefined,
    tokenUsage: normalizeTokenUsage(run.tokenUsage),
    htmlBytes: run.htmlBytes ?? undefined,
    validationFailures: run.validationFailures,
    repairCount: run.repairCount,
    model: run.model,
    error: run.error ?? undefined
  };
}

function mapShare(share: {
  id: string;
  slug: string;
  projectId: string;
  versionId: string;
  visibility: string;
  createdAt: Date;
  opens: number;
  playStarts: number;
  playCompletes: number;
  remixClicks: number;
}): ShareLink {
  return {
    id: share.id,
    slug: share.slug,
    projectId: share.projectId,
    versionId: share.versionId,
    visibility: share.visibility as ShareLink["visibility"],
    createdAt: share.createdAt.toISOString(),
    opens: share.opens,
    playStarts: share.playStarts,
    playCompletes: share.playCompletes,
    remixClicks: share.remixClicks
  };
}

function mapLineage(lineage: {
  id: string;
  fromProjectId: string;
  fromVersionId: string;
  toProjectId: string;
  toVersionId: string;
  createdAt: Date;
}): RemixLineage {
  return {
    id: lineage.id,
    fromProjectId: lineage.fromProjectId,
    fromVersionId: lineage.fromVersionId,
    toProjectId: lineage.toProjectId,
    toVersionId: lineage.toVersionId,
    createdAt: lineage.createdAt.toISOString()
  };
}

function normalizeTokenUsage(value: unknown): GenerationRun["tokenUsage"] {
  if (typeof value === "object" && value != null) {
    const usage = value as Partial<GenerationRun["tokenUsage"]>;
    return {
      inputTokens: Number(usage.inputTokens ?? 0),
      outputTokens: Number(usage.outputTokens ?? 0),
      totalTokens: Number(usage.totalTokens ?? 0),
      requestCount: Number(usage.requestCount ?? 1)
    };
  }
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    requestCount: 1
  };
}

function normalizeRemixOf(value: unknown): Project["remixOf"] {
  if (typeof value !== "object" || value == null) return undefined;
  const remixOf = value as Project["remixOf"];
  if (!remixOf?.projectId || !remixOf.versionId) return undefined;
  return remixOf;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 1.8));
}

function resolveRunModelLabel(): string {
  if (process.env.SPARKPLAY_LLM_CONFIG_SOURCE === "codex") {
    return `codex:${process.env.SPARKPLAY_LLM_MODEL ?? "gpt-5.5"}`;
  }
  if (process.env.SPARKPLAY_LLM_API_KEY || process.env.OPENAI_API_KEY) {
    return process.env.SPARKPLAY_LLM_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.5";
  }
  return "local-playable-generator";
}
