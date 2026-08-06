import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  DatabaseShape,
  GenerationRun,
  PlayableManifest,
  PlayableVersion,
  Project,
  ShareLink,
  ValidationReport
} from "@/types/domain";
import { createId, createSlug } from "@/lib/id";
import { starterTemplates } from "@/lib/templates";

const dataDir = path.join(process.cwd(), "data");
const artifactDir = path.join(dataDir, "artifacts");
const dbPath = path.join(dataDir, "db.json");
const demoUserId = "user_demo";

const emptyDb: DatabaseShape = {
  users: [{ id: demoUserId, name: "Creator Demo", avatarColor: "#1f6b4a", createdAt: new Date(0).toISOString() }],
  projects: [],
  versions: [],
  runs: [],
  messages: [],
  shareLinks: [],
  remixLineages: [],
  templates: starterTemplates,
  moderationReviews: []
};

export async function getDb(): Promise<DatabaseShape> {
  await ensureStore();
  try {
    const raw = await readFile(dbPath, "utf8");
    const parsed = JSON.parse(raw) as DatabaseShape;
    return {
      ...emptyDb,
      ...parsed,
      templates: parsed.templates?.length ? parsed.templates : starterTemplates
    };
  } catch {
    await writeDb(emptyDb);
    return emptyDb;
  }
}

export async function writeDb(db: DatabaseShape): Promise<void> {
  await ensureStore();
  await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

export async function ensureStore(): Promise<void> {
  await mkdir(artifactDir, { recursive: true });
}

export async function writeArtifact(versionId: string, html: string): Promise<string> {
  await ensureStore();
  const artifactPath = path.join(artifactDir, `${versionId}.html`);
  await writeFile(artifactPath, html, "utf8");
  return artifactPath;
}

export async function readArtifact(version: PlayableVersion): Promise<string> {
  return readFile(version.artifactPath, "utf8");
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  return [...db.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(projectId: string): Promise<Project | null> {
  const db = await getDb();
  return db.projects.find((project) => project.id === projectId) ?? null;
}

export async function getProjectVersions(projectId: string): Promise<PlayableVersion[]> {
  const db = await getDb();
  return db.versions
    .filter((version) => version.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getVersion(projectId: string, versionId: string): Promise<PlayableVersion | null> {
  const db = await getDb();
  return db.versions.find((version) => version.projectId === projectId && version.id === versionId) ?? null;
}

export async function getGenerationRun(runId: string): Promise<GenerationRun | null> {
  const db = await getDb();
  return db.runs.find((run) => run.id === runId) ?? null;
}

export async function createRun(input: Pick<GenerationRun, "mode" | "prompt" | "projectId">): Promise<GenerationRun> {
  const db = await getDb();
  const now = new Date().toISOString();
  const run: GenerationRun = {
    id: createId("run"),
    projectId: input.projectId,
    mode: input.mode,
    prompt: input.prompt,
    status: "running",
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

export async function completeRun(
  runId: string,
  patch: Pick<GenerationRun, "status" | "htmlBytes" | "validationFailures" | "repairCount"> & {
    error?: string;
    outputTokens?: number;
  }
): Promise<GenerationRun> {
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
}): Promise<{ project: Project; version: PlayableVersion }> {
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
      ownerId: demoUserId,
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
    reasons: [],
    createdAt: now
  });

  await writeDb(db);
  const savedProject = db.projects.find((item) => item.id === projectId);
  if (!savedProject) throw new Error("Project was not persisted");
  return { project: savedProject, version };
}

export async function importHtml(input: {
  projectId?: string;
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
    sourceKind: "import"
  });
  await completeRun(run.id, {
    status: input.validationReport.valid ? "success" : "failed",
    htmlBytes: Buffer.byteLength(input.html, "utf8"),
    validationFailures: input.validationReport.issues.length,
    repairCount: 0,
    outputTokens: 0
  });
  return persisted;
}

export async function rollbackVersion(projectId: string, versionId: string): Promise<{ project: Project; version: PlayableVersion }> {
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
  project.visibility = "public";
  project.updatedAt = new Date().toISOString();
  db.shareLinks.push(share);
  await writeDb(db);
  return share;
}

export async function getShareBySlug(slug: string): Promise<ShareLink | null> {
  const db = await getDb();
  return db.shareLinks.find((item) => item.slug === slug) ?? null;
}

export async function recordShareOpen(slug: string): Promise<void> {
  const db = await getDb();
  const share = db.shareLinks.find((item) => item.slug === slug);
  if (share) {
    share.opens += 1;
    await writeDb(db);
  }
}

export async function forkShare(slug: string): Promise<Project> {
  const db = await getDb();
  const share = db.shareLinks.find((item) => item.slug === slug);
  if (!share) throw new Error("Share link not found");
  share.remixClicks += 1;
  await writeDb(db);

  const sourceProject = await getProject(share.projectId);
  const sourceVersion = await getVersion(share.projectId, share.versionId);
  if (!sourceProject || !sourceVersion) throw new Error("Shared project not found");
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

  const freshDb = await getDb();
  freshDb.remixLineages.push({
    id: createId("lin"),
    fromProjectId: sourceProject.id,
    fromVersionId: sourceVersion.id,
    toProjectId: persisted.project.id,
    toVersionId: persisted.version.id,
    createdAt: new Date().toISOString()
  });
  await writeDb(freshDb);
  return persisted.project;
}

export async function getDashboardStats(): Promise<{
  projectCount: number;
  versionCount: number;
  shareCount: number;
  remixCount: number;
}> {
  const db = await getDb();
  return {
    projectCount: db.projects.length,
    versionCount: db.versions.length,
    shareCount: db.shareLinks.length,
    remixCount: db.remixLineages.length
  };
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
