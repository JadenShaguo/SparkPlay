import { readFile } from "node:fs/promises";
import path from "node:path";

let PrismaClient;
try {
  ({ PrismaClient } = await import("@prisma/client"));
} catch (error) {
  console.error("无法加载 @prisma/client。请先执行：npm run prisma:generate");
  throw error;
}

const dbPath = process.argv[2] ?? path.join(process.cwd(), "data", "db.json");
const prisma = new PrismaClient();

try {
  const raw = await readFile(dbPath, "utf8");
  const db = JSON.parse(raw);

  await prisma.$transaction(async (tx) => {
    for (const user of db.users ?? []) {
      await tx.user.upsert({
        where: { id: user.id },
        update: {
          name: user.name,
          avatarColor: user.avatarColor,
          createdAt: toDate(user.createdAt)
        },
        create: {
          id: user.id,
          name: user.name,
          avatarColor: user.avatarColor,
          createdAt: toDate(user.createdAt)
        }
      });
    }

    for (const project of db.projects ?? []) {
      await tx.project.upsert({
        where: { id: project.id },
        update: {
          ownerId: project.ownerId,
          title: project.title,
          description: project.description,
          visibility: project.visibility,
          currentVersionId: project.currentVersionId,
          rootVersionId: project.rootVersionId,
          savedAt: nullableDate(project.savedAt),
          createdAt: toDate(project.createdAt),
          updatedAt: toDate(project.updatedAt),
          remixOf: project.remixOf ?? undefined
        },
        create: {
          id: project.id,
          ownerId: project.ownerId,
          title: project.title,
          description: project.description,
          visibility: project.visibility,
          currentVersionId: project.currentVersionId,
          rootVersionId: project.rootVersionId,
          savedAt: nullableDate(project.savedAt),
          createdAt: toDate(project.createdAt),
          updatedAt: toDate(project.updatedAt),
          remixOf: project.remixOf ?? undefined
        }
      });
    }

    for (const version of db.versions ?? []) {
      await tx.playableVersion.upsert({
        where: { id: version.id },
        update: mapVersion(version),
        create: {
          id: version.id,
          ...mapVersion(version)
        }
      });
    }

    for (const run of db.runs ?? []) {
      await tx.generationRun.upsert({
        where: { id: run.id },
        update: mapRun(run),
        create: {
          id: run.id,
          ...mapRun(run)
        }
      });
    }

    for (const message of db.messages ?? []) {
      await tx.sessionMessage.upsert({
        where: { id: message.id },
        update: mapMessage(message),
        create: {
          id: message.id,
          ...mapMessage(message)
        }
      });
    }

    for (const share of db.shareLinks ?? []) {
      await tx.shareLink.upsert({
        where: { slug: share.slug },
        update: mapShare(share),
        create: {
          id: share.id,
          ...mapShare(share)
        }
      });
    }

    for (const lineage of db.remixLineages ?? []) {
      await tx.remixLineage.upsert({
        where: { id: lineage.id },
        update: mapLineage(lineage),
        create: {
          id: lineage.id,
          ...mapLineage(lineage)
        }
      });
    }

    for (const template of db.templates ?? []) {
      await tx.template.upsert({
        where: { id: template.id },
        update: mapTemplate(template),
        create: {
          id: template.id,
          ...mapTemplate(template)
        }
      });
    }

    for (const review of db.moderationReviews ?? []) {
      await tx.moderationReview.upsert({
        where: { id: review.id },
        update: mapModerationReview(review),
        create: {
          id: review.id,
          ...mapModerationReview(review)
        }
      });
    }

    for (const event of db.analyticsEvents ?? []) {
      await tx.analyticsEvent.upsert({
        where: { id: event.id },
        update: mapAnalyticsEvent(event),
        create: {
          id: event.id,
          ...mapAnalyticsEvent(event)
        }
      });
    }
  });

  console.log(`Imported local JSON database: ${dbPath}`);
} finally {
  await prisma.$disconnect();
}

function mapVersion(version) {
  return {
    projectId: version.projectId,
    parentVersionIds: version.parentVersionIds ?? [],
    sourceKind: version.sourceKind,
    createdBy: version.createdBy,
    prompt: version.prompt,
    changeSummary: version.changeSummary,
    manifest: version.manifest,
    validationReport: version.validationReport,
    artifactPath: version.artifactPath,
    artifactKey: version.artifactKey ?? undefined,
    thumbnailKey: version.thumbnailKey ?? undefined,
    smokeReport: version.smokeReport ?? undefined,
    htmlBytes: version.htmlBytes,
    generationRunId: version.generationRunId ?? undefined,
    createdAt: toDate(version.createdAt)
  };
}

function mapRun(run) {
  return {
    projectId: run.projectId,
    mode: run.mode,
    prompt: run.prompt,
    status: run.status,
    startedAt: toDate(run.startedAt),
    completedAt: nullableDate(run.completedAt),
    durationMs: run.durationMs ?? undefined,
    firstPreviewMs: run.firstPreviewMs ?? undefined,
    tokenUsage: run.tokenUsage,
    htmlBytes: run.htmlBytes ?? undefined,
    validationFailures: run.validationFailures,
    repairCount: run.repairCount,
    model: run.model,
    error: run.error ?? undefined
  };
}

function mapMessage(message) {
  return {
    projectId: message.projectId,
    role: message.role,
    content: message.content,
    versionId: message.versionId ?? undefined,
    createdAt: toDate(message.createdAt)
  };
}

function mapShare(share) {
  return {
    slug: share.slug,
    projectId: share.projectId,
    versionId: share.versionId,
    visibility: share.visibility,
    createdAt: toDate(share.createdAt),
    opens: share.opens ?? 0,
    playStarts: share.playStarts ?? 0,
    playCompletes: share.playCompletes ?? 0,
    remixClicks: share.remixClicks ?? 0
  };
}

function mapLineage(lineage) {
  return {
    fromProjectId: lineage.fromProjectId,
    fromVersionId: lineage.fromVersionId,
    toProjectId: lineage.toProjectId,
    toVersionId: lineage.toVersionId,
    createdAt: toDate(lineage.createdAt)
  };
}

function mapTemplate(template) {
  return {
    title: template.title,
    category: template.category,
    prompt: template.prompt,
    tags: template.tags ?? [],
    recommendedMode: template.recommendedMode
  };
}

function mapModerationReview(review) {
  return {
    projectId: review.projectId,
    versionId: review.versionId,
    status: review.status,
    reasons: review.reasons ?? [],
    createdAt: toDate(review.createdAt)
  };
}

function mapAnalyticsEvent(event) {
  return {
    type: event.type,
    shareSlug: event.shareSlug ?? undefined,
    projectId: event.projectId ?? undefined,
    versionId: event.versionId ?? undefined,
    createdAt: toDate(event.createdAt)
  };
}

function nullableDate(value) {
  return value ? toDate(value) : undefined;
}

function toDate(value) {
  return value ? new Date(value) : new Date(0);
}
