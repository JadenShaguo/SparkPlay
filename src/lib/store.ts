import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AnalyticsEventType,
  DatabaseShape,
  GenerationRun,
  GenerationRunStatus,
  RemixLineage,
  PlayableManifest,
  PlayableVersion,
  Project,
  PublicProjectCard,
  SmokeReport,
  ShareLink,
  User,
  UserProfile,
  ValidationReport
} from "@/types/domain";
import { createId, createSlug } from "@/lib/id";
import * as postgresStore from "@/lib/postgres-store";
import { fallbackThumbnailSvg } from "@/lib/playwright-smoke";
import { getStorageAdapter } from "@/lib/storage-adapter";
import { starterTemplates } from "@/lib/templates";

const demoUserId = "user_demo";

const emptyDb: DatabaseShape = {
  users: [{ id: demoUserId, name: "SparkPlay Studio", avatarColor: "#7f7cff", createdAt: new Date(0).toISOString() }],
  projects: [],
  versions: [],
  runs: [],
  messages: [],
  shareLinks: [],
  remixLineages: [],
  templates: starterTemplates,
  moderationReviews: [],
  analyticsEvents: []
};

export async function getDb(): Promise<DatabaseShape> {
  await ensureStore();
  const dbPath = getDbPath();
  try {
    const raw = await readFile(dbPath, "utf8");
    const parsed = JSON.parse(raw) as DatabaseShape;
    return {
      ...emptyDb,
      ...parsed,
      templates: parsed.templates?.length ? parsed.templates : starterTemplates,
      analyticsEvents: parsed.analyticsEvents ?? []
    };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    await writeDb(emptyDb);
    return emptyDb;
  }
}

export async function writeDb(db: DatabaseShape): Promise<void> {
  await ensureStore();
  await writeFile(getDbPath(), `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

export async function ensureStore(): Promise<void> {
  if (usesPostgresDataAdapter()) return postgresStore.ensureStore();
  await mkdir(getDataDir(), { recursive: true });
  await getStorageAdapter().ensure();
}

export async function ensureUser(input: Pick<User, "id" | "name" | "avatarColor">): Promise<User> {
  if (usesPostgresDataAdapter()) return postgresStore.ensureUser(input);
  const db = await getDb();
  const existing = db.users.find((user) => user.id === input.id);
  if (existing) {
    existing.name = input.name;
    existing.avatarColor = input.avatarColor;
    await writeDb(db);
    return existing;
  }
  const user: User = {
    ...input,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  await writeDb(db);
  return user;
}

export async function getUser(userId: string): Promise<User | null> {
  if (usesPostgresDataAdapter()) return postgresStore.getUser(userId);
  const db = await getDb();
  return db.users.find((user) => user.id === userId) ?? null;
}

export async function writeArtifact(versionId: string, html: string): Promise<string> {
  if (usesPostgresDataAdapter()) return postgresStore.writeArtifact(versionId, html);
  return getStorageAdapter().putArtifact(versionId, html);
}

export async function writeThumbnail(versionId: string, content: Buffer | string, extension: "png" | "svg"): Promise<string> {
  if (usesPostgresDataAdapter()) return postgresStore.writeThumbnail(versionId, content, extension);
  return getStorageAdapter().putThumbnail(versionId, content, extension);
}

export async function readArtifact(version: PlayableVersion): Promise<string> {
  if (usesPostgresDataAdapter()) return postgresStore.readArtifact(version);
  return getStorageAdapter().readArtifact(version);
}

export async function readThumbnail(version: PlayableVersion): Promise<{ content: Buffer; contentType: string } | null> {
  if (!version.thumbnailKey) return null;
  if (usesPostgresDataAdapter()) return postgresStore.readThumbnail(version);
  return getStorageAdapter().readThumbnail(version.thumbnailKey);
}

export async function attachVersionQuality(input: {
  projectId: string;
  versionId: string;
  thumbnailKey?: string;
  smokeReport?: SmokeReport;
}): Promise<PlayableVersion> {
  if (usesPostgresDataAdapter()) return postgresStore.attachVersionQuality(input);
  const db = await getDb();
  const version = db.versions.find((item) => item.projectId === input.projectId && item.id === input.versionId);
  if (!version) throw new Error("Version not found");
  version.thumbnailKey = input.thumbnailKey ?? version.thumbnailKey;
  version.smokeReport = input.smokeReport ?? version.smokeReport;
  if (input.thumbnailKey) {
    version.manifest.thumbnail = input.thumbnailKey;
  }
  await writeDb(db);
  return version;
}

export async function listProjects(ownerId?: string): Promise<Project[]> {
  if (usesPostgresDataAdapter()) return postgresStore.listProjects(ownerId);
  const db = await getDb();
  return [...db.projects]
    .filter((project) => !ownerId || project.ownerId === ownerId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listPublicProjects(): Promise<Project[]> {
  if (usesPostgresDataAdapter()) return postgresStore.listPublicProjects();
  const db = await getDb();
  return db.projects
    .filter((project) => project.visibility === "public")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listPublicProjectCards(sort: "latest" | "remixed" | "played" = "latest"): Promise<PublicProjectCard[]> {
  if (usesPostgresDataAdapter()) return postgresStore.listPublicProjectCards(sort);
  const db = await getDb();
  const cards = await Promise.all(
    db.projects
      .filter((project) => project.visibility === "public")
      .map((project) => buildPublicProjectCard(db, project))
  );
  return sortProjectCards(cards, sort);
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (usesPostgresDataAdapter()) return postgresStore.getUserProfile(userId);
  const db = await getDb();
  const user = db.users.find((item) => item.id === userId);
  if (!user) return null;
  const publicProjects = sortProjectCards(
    await Promise.all(
      db.projects
        .filter((project) => project.ownerId === userId && project.visibility === "public")
        .map((project) => buildPublicProjectCard(db, project))
    ),
    "latest"
  );
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
  if (usesPostgresDataAdapter()) return postgresStore.getProject(projectId);
  const db = await getDb();
  return db.projects.find((project) => project.id === projectId) ?? null;
}

export async function setProjectVisibility(
  projectId: string,
  visibility: Project["visibility"]
): Promise<Project> {
  if (usesPostgresDataAdapter()) return postgresStore.setProjectVisibility(projectId, visibility);
  const db = await getDb();
  const project = db.projects.find((item) => item.id === projectId);
  if (!project) throw new Error("Project not found");
  project.visibility = visibility;
  project.updatedAt = new Date().toISOString();
  await writeDb(db);
  return project;
}

export async function getProjectVersions(projectId: string): Promise<PlayableVersion[]> {
  if (usesPostgresDataAdapter()) return postgresStore.getProjectVersions(projectId);
  const db = await getDb();
  return db.versions
    .filter((version) => version.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getVersion(projectId: string, versionId: string): Promise<PlayableVersion | null> {
  if (usesPostgresDataAdapter()) return postgresStore.getVersion(projectId, versionId);
  const db = await getDb();
  return db.versions.find((version) => version.projectId === projectId && version.id === versionId) ?? null;
}

export async function getGenerationRun(runId: string): Promise<GenerationRun | null> {
  if (usesPostgresDataAdapter()) return postgresStore.getGenerationRun(runId);
  const db = await getDb();
  return db.runs.find((run) => run.id === runId) ?? null;
}

export async function getGenerationResult(runId: string): Promise<{
  run: GenerationRun | null;
  project: Project | null;
  version: PlayableVersion | null;
  html: string;
}> {
  if (usesPostgresDataAdapter()) return postgresStore.getGenerationResult(runId);
  const db = await getDb();
  const run = db.runs.find((item) => item.id === runId) ?? null;
  const version = db.versions.find((item) => item.generationRunId === runId) ?? null;
  const project = version ? db.projects.find((item) => item.id === version.projectId) ?? null : null;
  const html = version ? await readArtifact(version) : "";
  return { run, project, version, html };
}

export async function createRun(input: Pick<GenerationRun, "mode" | "prompt" | "projectId"> & {
  status?: GenerationRunStatus;
}): Promise<GenerationRun> {
  if (usesPostgresDataAdapter()) return postgresStore.createRun(input);
  const db = await getDb();
  const now = new Date().toISOString();
  const run: GenerationRun = {
    id: createId("run"),
    projectId: input.projectId,
    mode: input.mode,
    prompt: input.prompt,
    status: input.status ?? "running",
    startedAt: now,
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
  db.runs.push(run);
  await writeDb(db);
  return run;
}

export async function updateRunStatus(
  runId: string,
  status: GenerationRunStatus,
  patch: Partial<Pick<GenerationRun, "projectId" | "error" | "validationFailures" | "repairCount">> = {}
): Promise<GenerationRun> {
  if (usesPostgresDataAdapter()) return postgresStore.updateRunStatus(runId, status, patch);
  const db = await getDb();
  const run = db.runs.find((item) => item.id === runId);
  if (!run) throw new Error("Generation run not found");
  Object.assign(run, patch, {
    status,
    error: patch.error ?? (status === "failed" ? run.error : undefined)
  });
  await writeDb(db);
  return run;
}

export async function completeRun(
  runId: string,
  patch: Pick<GenerationRun, "status" | "htmlBytes" | "validationFailures" | "repairCount"> & {
    error?: string;
    outputTokens?: number;
  }
): Promise<GenerationRun> {
  if (usesPostgresDataAdapter()) return postgresStore.completeRun(runId, patch);
  const db = await getDb();
  const run = db.runs.find((item) => item.id === runId);
  if (!run) throw new Error("Generation run not found");
  const completedAt = new Date().toISOString();
  const outputTokens = patch.outputTokens ?? Math.ceil((patch.htmlBytes ?? 0) / 4);
  Object.assign(run, {
    ...patch,
    completedAt,
    durationMs: new Date(completedAt).getTime() - new Date(run.startedAt).getTime(),
    firstPreviewMs: new Date(completedAt).getTime() - new Date(run.startedAt).getTime(),
    tokenUsage: {
      ...run.tokenUsage,
      outputTokens,
      totalTokens: run.tokenUsage.inputTokens + outputTokens
    }
  });
  await writeDb(db);
  return run;
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
  if (usesPostgresDataAdapter()) return postgresStore.persistGeneratedVersion(input);
  const db = await getDb();
  const now = new Date().toISOString();
  const project =
    input.projectId != null
      ? db.projects.find((item) => item.id === input.projectId)
      : undefined;

  const projectId = project?.id ?? createId("prj");
  const versionId = createId("ver");
  const artifactPath = await writeArtifact(versionId, input.html);
  const version: PlayableVersion = {
    id: versionId,
    projectId,
    parentVersionIds: input.parentVersionIds ?? [],
    sourceKind: input.sourceKind,
    createdBy: "user",
    prompt: input.prompt,
    changeSummary: input.prompt,
    manifest: input.manifest,
    validationReport: input.validationReport,
    artifactPath,
    htmlBytes: Buffer.byteLength(input.html, "utf8"),
    generationRunId: input.runId,
    createdAt: now
  };

  if (project) {
    project.title = input.title;
    project.description = input.description;
    project.currentVersionId = version.id;
    project.updatedAt = now;
  } else {
    db.projects.push({
      id: projectId,
      ownerId: input.ownerId ?? demoUserId,
      title: input.title,
      description: input.description,
      visibility: "private",
      currentVersionId: version.id,
      rootVersionId: version.id,
      savedAt: now,
      createdAt: now,
      updatedAt: now,
      remixOf: input.remixOf
    });
  }

  db.versions.push(version);
  db.messages.push({
    id: createId("msg"),
    projectId,
    role: "user",
    content: input.prompt,
    createdAt: now
  });
  db.messages.push({
    id: createId("msg"),
    projectId,
    role: "assistant",
    content: `生成版本 ${version.id}`,
    versionId: version.id,
    createdAt: now
  });
  db.moderationReviews.push({
    id: createId("mod"),
    projectId,
    versionId: version.id,
    status: input.manifest.safetyStatus,
    reasons: input.moderationReasons ?? [],
    createdAt: now
  });

  await writeDb(db);
  const savedProject = db.projects.find((item) => item.id === projectId);
  if (!savedProject) throw new Error("Project was not persisted");
  return { project: savedProject, version };
}

export async function importHtml(input: {
  projectId?: string;
  ownerId?: string;
  title: string;
  html: string;
  validationReport: ValidationReport;
}): Promise<{ project: Project; version: PlayableVersion }> {
  if (usesPostgresDataAdapter()) return postgresStore.importHtml(input);
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
  if (usesPostgresDataAdapter()) return postgresStore.rollbackVersion(projectId, versionId);
  const db = await getDb();
  const project = db.projects.find((item) => item.id === projectId);
  const target = db.versions.find((item) => item.projectId === projectId && item.id === versionId);
  if (!project || !target) throw new Error("Project or version not found");

  const html = await readArtifact(target);
  const now = new Date().toISOString();
  const newVersionId = createId("ver");
  const artifactPath = await writeArtifact(newVersionId, html);
  const version: PlayableVersion = {
    ...target,
    id: newVersionId,
    sourceKind: "rollback",
    parentVersionIds: [target.id],
    artifactPath,
    createdAt: now,
    changeSummary: `回滚到 ${target.id}`
  };
  db.versions.push(version);
  project.currentVersionId = version.id;
  project.updatedAt = now;
  db.messages.push({
    id: createId("msg"),
    projectId,
    role: "assistant",
    content: `回滚到版本 ${target.id}`,
    versionId: version.id,
    createdAt: now
  });
  await writeDb(db);
  return { project, version };
}

export async function createShareLink(projectId: string, versionId: string): Promise<ShareLink> {
  if (usesPostgresDataAdapter()) return postgresStore.createShareLink(projectId, versionId);
  const db = await getDb();
  const project = db.projects.find((item) => item.id === projectId);
  const version = db.versions.find((item) => item.projectId === projectId && item.id === versionId);
  if (!project || !version) throw new Error("Project or version not found");

  const existing = db.shareLinks.find((item) => item.projectId === projectId && item.versionId === versionId);
  if (existing) return existing;

  const share: ShareLink = {
    id: createId("shr"),
    slug: createSlug(),
    projectId,
    versionId,
    visibility: "unlisted",
    createdAt: new Date().toISOString(),
    opens: 0,
    playStarts: 0,
    playCompletes: 0,
    remixClicks: 0
  };
  project.visibility = "unlisted";
  project.updatedAt = new Date().toISOString();
  db.shareLinks.push(share);
  await writeDb(db);
  return share;
}

export async function recordRemixLineage(input: {
  fromProjectId: string;
  fromVersionId: string;
  toProjectId: string;
  toVersionId: string;
}): Promise<RemixLineage> {
  if (usesPostgresDataAdapter()) return postgresStore.recordRemixLineage(input);
  const db = await getDb();
  const existing = db.remixLineages.find(
    (item) =>
      item.fromProjectId === input.fromProjectId &&
      item.fromVersionId === input.fromVersionId &&
      item.toProjectId === input.toProjectId &&
      item.toVersionId === input.toVersionId
  );
  if (existing) return existing;

  const lineage: RemixLineage = {
    id: createId("lin"),
    ...input,
    createdAt: new Date().toISOString()
  };
  db.remixLineages.push(lineage);
  await writeDb(db);
  return lineage;
}

export async function getProjectLineage(projectId: string): Promise<{
  ancestors: RemixLineage[];
  descendants: RemixLineage[];
}> {
  if (usesPostgresDataAdapter()) return postgresStore.getProjectLineage(projectId);
  const db = await getDb();
  return {
    ancestors: db.remixLineages
      .filter((item) => item.toProjectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    descendants: db.remixLineages
      .filter((item) => item.fromProjectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  };
}

export async function getShareBySlug(slug: string): Promise<ShareLink | null> {
  if (usesPostgresDataAdapter()) return postgresStore.getShareBySlug(slug);
  const db = await getDb();
  return db.shareLinks.find((item) => item.slug === slug) ?? null;
}

export async function recordShareOpen(slug: string): Promise<void> {
  if (usesPostgresDataAdapter()) return postgresStore.recordShareOpen(slug);
  await recordShareEvent(slug, "shareOpen");
}

export async function recordSharePlayStart(slug: string): Promise<void> {
  if (usesPostgresDataAdapter()) return postgresStore.recordSharePlayStart(slug);
  await recordShareEvent(slug, "playStart");
}

export async function recordSharePlayComplete(slug: string): Promise<void> {
  if (usesPostgresDataAdapter()) return postgresStore.recordSharePlayComplete(slug);
  await recordShareEvent(slug, "playComplete");
}

export async function recordShareEvent(slug: string, type: AnalyticsEventType): Promise<void> {
  if (usesPostgresDataAdapter()) return postgresStore.recordShareEvent(slug, type);
  const db = await getDb();
  const share = db.shareLinks.find((item) => item.slug === slug);
  if (!share) return;
  if (type === "shareOpen") share.opens += 1;
  if (type === "playStart") share.playStarts += 1;
  if (type === "playComplete") share.playCompletes += 1;
  if (type === "remixClick") share.remixClicks += 1;
  db.analyticsEvents.push({
    id: createId("evt"),
    type,
    shareSlug: slug,
    projectId: share.projectId,
    versionId: share.versionId,
    createdAt: new Date().toISOString()
  });
  await writeDb(db);
}

export async function forkShare(slug: string, ownerId = demoUserId): Promise<Project> {
  if (usesPostgresDataAdapter()) return postgresStore.forkShare(slug, ownerId);
  const db = await getDb();
  const share = db.shareLinks.find((item) => item.slug === slug);
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
  if (usesPostgresDataAdapter()) return postgresStore.getDashboardStats(ownerId);
  const db = await getDb();
  const projects = db.projects.filter((project) => !ownerId || project.ownerId === ownerId);
  const projectIds = new Set(projects.map((project) => project.id));
  return {
    projectCount: projects.length,
    versionCount: db.versions.filter((version) => projectIds.has(version.projectId)).length,
    shareCount: db.shareLinks.filter((share) => projectIds.has(share.projectId)).length,
    remixCount: db.remixLineages.filter((lineage) => projectIds.has(lineage.fromProjectId) || projectIds.has(lineage.toProjectId)).length
  };
}

function buildPublicProjectCard(db: DatabaseShape, project: Project): PublicProjectCard {
  const currentVersion = db.versions.find((version) => version.projectId === project.id && version.id === project.currentVersionId) ?? null;
  const author = db.users.find((user) => user.id === project.ownerId) ?? emptyDb.users[0];
  const remixCount = db.remixLineages.filter((lineage) => lineage.fromProjectId === project.id).length;
  const projectShares = db.shareLinks.filter((share) => share.projectId === project.id);
  const shareOpens = projectShares
    .reduce((sum, share) => sum + share.opens, 0);
  const currentShare = projectShares.find((share) => share.versionId === project.currentVersionId) ?? projectShares[0];
  const sourceProject = project.remixOf
    ? db.projects.find((item) => item.id === project.remixOf?.projectId)
    : undefined;
  const sourceVersion = project.remixOf
    ? db.versions.find((item) => item.projectId === project.remixOf?.projectId && item.id === project.remixOf?.versionId) ?? null
    : null;
  const sourceAuthor = sourceProject
    ? db.users.find((user) => user.id === sourceProject.ownerId) ?? emptyDb.users[0]
    : undefined;

  return {
    project,
    currentVersion,
    author,
    shareSlug: currentShare?.slug,
    remixCount,
    shareOpens,
    basedOn: sourceProject && sourceAuthor
      ? {
          project: sourceProject,
          version: sourceVersion,
          author: sourceAuthor
        }
      : undefined
  };
}

function sortProjectCards(cards: PublicProjectCard[], sort: "latest" | "remixed" | "played"): PublicProjectCard[] {
  return [...cards].sort((a, b) => {
    if (sort === "remixed") return b.remixCount - a.remixCount || b.project.updatedAt.localeCompare(a.project.updatedAt);
    if (sort === "played") return b.shareOpens - a.shareOpens || b.project.updatedAt.localeCompare(a.project.updatedAt);
    return b.project.updatedAt.localeCompare(a.project.updatedAt);
  });
}

function getDataDir(): string {
  return path.join(process.cwd(), "data");
}

function getDbPath(): string {
  return path.join(getDataDir(), "db.json");
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
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

function usesPostgresDataAdapter(): boolean {
  if (process.env.SPARKPLAY_DATA_ADAPTER !== "postgres") return false;
  if (!process.env.DATABASE_URL) {
    throw new Error("SPARKPLAY_DATA_ADAPTER=postgres requires DATABASE_URL");
  }
  return true;
}
