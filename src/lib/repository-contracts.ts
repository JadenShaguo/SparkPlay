import type {
  GenerationRun,
  GenerationRunStatus,
  PlayableManifest,
  PlayableVersion,
  Project,
  RemixLineage,
  ShareLink,
  ValidationReport
} from "@/types/domain";

export interface ProjectRepository {
  listProjects(): Promise<Project[]>;
  listPublicProjects(): Promise<Project[]>;
  getProject(projectId: string): Promise<Project | null>;
  setProjectVisibility(projectId: string, visibility: Project["visibility"]): Promise<Project>;
}

export interface VersionRepository {
  getProjectVersions(projectId: string): Promise<PlayableVersion[]>;
  getVersion(projectId: string, versionId: string): Promise<PlayableVersion | null>;
  createImmutable(input: {
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
    moderationReasons?: string[];
  }): Promise<{ project: Project; version: PlayableVersion }>;
  rollback(projectId: string, versionId: string): Promise<{ project: Project; version: PlayableVersion }>;
}

export interface GenerationRunRepository {
  create(input: Pick<GenerationRun, "mode" | "prompt" | "projectId"> & {
    status?: GenerationRunStatus;
  }): Promise<GenerationRun>;
  updateStatus(
    runId: string,
    status: GenerationRunStatus,
    patch?: Partial<Pick<GenerationRun, "projectId" | "error" | "validationFailures" | "repairCount">>
  ): Promise<GenerationRun>;
  complete(
    runId: string,
    patch: Pick<GenerationRun, "status" | "htmlBytes" | "validationFailures" | "repairCount"> & {
      error?: string;
      outputTokens?: number;
    }
  ): Promise<GenerationRun>;
}

export interface ShareRepository {
  createFixedVersionLink(projectId: string, versionId: string): Promise<ShareLink>;
  getBySlug(slug: string): Promise<ShareLink | null>;
  recordOpen(slug: string): Promise<void>;
  recordPlayStart(slug: string): Promise<void>;
  recordPlayComplete(slug: string): Promise<void>;
  fork(slug: string): Promise<Project>;
}

export interface LineageRepository {
  recordRemixLineage(input: {
    fromProjectId: string;
    fromVersionId: string;
    toProjectId: string;
    toVersionId: string;
  }): Promise<RemixLineage>;
  getProjectLineage(projectId: string): Promise<{
    ancestors: RemixLineage[];
    descendants: RemixLineage[];
  }>;
}
