export type GenerationMode = "direct" | "plan_once" | "clarify_plan_once" | "staged" | "import";

export type SafetyStatus = "pending" | "approved" | "blocked";

export type VersionSourceKind = "generate" | "remix" | "rollback" | "import" | "repair";

export type GenerationRunStatus =
  | "queued"
  | "running"
  | "planning"
  | "generating"
  | "validating"
  | "repairing"
  | "smoking"
  | "moderating"
  | "persisting"
  | "success"
  | "failed";

export type AnalyticsEventType = "shareOpen" | "playStart" | "playComplete" | "remixClick";

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
  objectKey?: string;
  bytes: number;
  checksum?: string;
}

export interface PlayableManifest {
  title: string;
  description: string;
  category: string;
  tags: string[];
  controls: string[];
  plan?: PlayablePlan;
  assetRefs: AssetRef[];
  thumbnail?: string;
  sourcePrompt: string;
  remixOf?: {
    projectId: string;
    versionId: string;
  };
  safetyStatus: SafetyStatus;
}

export interface PlayablePlan {
  title: string;
  coreLoop: string;
  goal: string;
  controls: string[];
  scoring: string;
  states: string[];
  endCondition: string;
  restartBehavior: string;
  visualStyle: string;
}

export interface ValidationReport {
  valid: boolean;
  issues: string[];
  warnings: string[];
  contract?: PlayableContractReport;
}

export interface PlayableContractReport {
  valid: boolean;
  checks: Array<{
    key: "goal" | "interaction" | "feedback" | "state" | "endState" | "restart";
    passed: boolean;
    message: string;
  }>;
}

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: "private" | "unlisted" | "public";
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
  artifactKey?: string;
  thumbnailKey?: string;
  smokeReport?: SmokeReport;
  htmlBytes: number;
  generationRunId?: string;
  createdAt: string;
}

export interface SmokeReport {
  status: "passed" | "failed" | "skipped";
  issues: string[];
  warnings: string[];
  durationMs: number;
  checkedAt: string;
  viewport: {
    width: number;
    height: number;
  };
  consoleErrors: string[];
  screenshotBytes?: number;
  interactionTested?: boolean;
  visualChangeDetected?: boolean;
}

export interface GenerationRun {
  id: string;
  projectId: string;
  mode: GenerationMode | "remix";
  prompt: string;
  status: GenerationRunStatus;
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

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  shareSlug?: string;
  projectId?: string;
  versionId?: string;
  createdAt: string;
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

export interface PublicProjectCard {
  project: Project;
  currentVersion: PlayableVersion | null;
  author: User;
  shareSlug?: string;
  remixCount: number;
  shareOpens: number;
  basedOn?: {
    project: Project;
    version: PlayableVersion | null;
    author: User;
  };
}

export interface UserProfile {
  user: User;
  stats: {
    publicProjectCount: number;
    remixProjectCount: number;
    totalShareOpens: number;
    totalRemixCount: number;
  };
  publicProjects: PublicProjectCard[];
  remixProjects: PublicProjectCard[];
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
  reporterId?: string;
  kind?: "precheck" | "user_report" | "takedown";
  createdAt: string;
}

export interface PublicProjectQuery {
  sort?: "latest" | "remixed" | "played";
  query?: string;
  category?: string;
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
  analyticsEvents: AnalyticsEvent[];
}
