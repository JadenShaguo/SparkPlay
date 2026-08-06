export type GenerationMode = "direct" | "plan_once" | "clarify_plan_once" | "staged" | "import";

export type SafetyStatus = "pending" | "approved" | "blocked";

export type VersionSourceKind = "generate" | "remix" | "rollback" | "import" | "repair";

export interface User {
  id: string;
  name: string;
  avatarColor: string;
  createdAt: string;
}

export interface AssetRef {
  id: string;
  kind: "image" | "audio";
  name: string;
  mimeType: string;
  dataUrl: string;
  bytes: number;
}

export interface PlayableManifest {
  title: string;
  description: string;
  category: string;
  tags: string[];
  controls: string[];
  assetRefs: AssetRef[];
  thumbnail?: string;
  sourcePrompt: string;
  remixOf?: {
    projectId: string;
    versionId: string;
  };
  safetyStatus: SafetyStatus;
}

export interface ValidationReport {
  valid: boolean;
  issues: string[];
  warnings: string[];
}

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: "private" | "public";
  currentVersionId: string;
  rootVersionId: string;
  savedAt: string | null;
  createdAt: string;
  updatedAt: string;
  remixOf?: {
    projectId: string;
    versionId: string;
  };
}

export interface PlayableVersion {
  id: string;
  projectId: string;
  parentVersionIds: string[];
  sourceKind: VersionSourceKind;
  createdBy: "user" | "system";
  prompt: string;
  changeSummary: string;
  manifest: PlayableManifest;
  validationReport: ValidationReport;
  artifactPath: string;
  htmlBytes: number;
  generationRunId?: string;
  createdAt: string;
}

export interface GenerationRun {
  id: string;
  projectId: string;
  mode: GenerationMode | "remix";
  prompt: string;
  status: "queued" | "running" | "success" | "failed";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  firstPreviewMs?: number;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    requestCount: number;
  };
  htmlBytes?: number;
  validationFailures: number;
  repairCount: number;
  model: string;
  error?: string;
}

export interface SessionMessage {
  id: string;
  projectId: string;
  role: "user" | "assistant";
  content: string;
  versionId?: string;
  createdAt: string;
}

export interface ShareLink {
  id: string;
  slug: string;
  projectId: string;
  versionId: string;
  visibility: "public" | "unlisted";
  createdAt: string;
  opens: number;
  playStarts: number;
  playCompletes: number;
  remixClicks: number;
}

export interface RemixLineage {
  id: string;
  fromProjectId: string;
  fromVersionId: string;
  toProjectId: string;
  toVersionId: string;
  createdAt: string;
}

export interface Template {
  id: string;
  title: string;
  category: string;
  prompt: string;
  tags: string[];
  recommendedMode: GenerationMode;
}

export interface ModerationReview {
  id: string;
  projectId: string;
  versionId: string;
  status: SafetyStatus;
  reasons: string[];
  createdAt: string;
}

export interface DatabaseShape {
  users: User[];
  projects: Project[];
  versions: PlayableVersion[];
  runs: GenerationRun[];
  messages: SessionMessage[];
  shareLinks: ShareLink[];
  remixLineages: RemixLineage[];
  templates: Template[];
  moderationReviews: ModerationReview[];
}
