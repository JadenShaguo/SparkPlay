import type { PlayableVersion, Project, PublicProjectCard, User } from "@/types/domain";

type PublicPlayableVersion = Pick<
  PlayableVersion,
  "id" | "projectId" | "parentVersionIds" | "sourceKind" | "createdBy" | "changeSummary" | "manifest" | "htmlBytes" | "createdAt"
>;

export interface PublicProjectView extends Omit<PublicProjectCard, "currentVersion" | "basedOn"> {
  currentVersion: PublicPlayableVersion | null;
  basedOn?: {
    project: Project;
    version: PublicPlayableVersion | null;
    author: User;
  };
  thumbnailUrl?: string;
  authorUrl: string;
  playUrl?: string;
  lineageUrl: string;
  basedOnUrl?: string;
}

export function toPublicProjectView(card: PublicProjectCard): PublicProjectView {
  return {
    ...card,
    currentVersion: toPublicVersion(card.currentVersion),
    basedOn: card.basedOn
      ? {
          ...card.basedOn,
          version: toPublicVersion(card.basedOn.version)
        }
      : undefined,
    thumbnailUrl: card.currentVersion?.thumbnailKey
      ? `/api/projects/${card.project.id}/versions/${card.currentVersion.id}/thumbnail`
      : undefined,
    authorUrl: `/users/${card.author.id}`,
    playUrl: card.shareSlug ? `/play/${card.shareSlug}` : undefined,
    lineageUrl: `/projects/${card.project.id}/lineage`,
    basedOnUrl: card.basedOn ? `/users/${card.basedOn.author.id}` : undefined
  };
}

function toPublicVersion(version: PlayableVersion | null): PublicPlayableVersion | null {
  if (!version) return null;
  return {
    id: version.id,
    projectId: version.projectId,
    parentVersionIds: version.parentVersionIds,
    sourceKind: version.sourceKind,
    createdBy: version.createdBy,
    changeSummary: version.changeSummary,
    manifest: {
      ...version.manifest,
      thumbnail: version.thumbnailKey ? "thumbnail" : undefined,
      assetRefs: []
    },
    htmlBytes: version.htmlBytes,
    createdAt: version.createdAt
  };
}
